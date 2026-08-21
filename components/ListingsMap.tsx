"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type {
  CircleMarker,
  LatLng,
  LatLngBounds,
  Map as LeafletMap,
  Polygon,
  Polyline,
  Rectangle,
} from "leaflet";
import { formatPrice } from "@/lib/format";
import type { ListingFilters } from "@/lib/types";

export interface MapListing {
  slug: string;
  address: string;
  city: string;
  price: number;
  lat: number;
  lng: number;
  status: string;
}

type MapBounds = NonNullable<ListingFilters["bounds"]>;
type MapPoint = NonNullable<ListingFilters["polygon"]>[number];
type LeafletModule = typeof import("leaflet");

function asMapBounds(bounds: LatLngBounds): MapBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

function sameBounds(left: MapBounds, right: MapBounds) {
  return Math.abs(left.north - right.north) < 0.00002
    && Math.abs(left.south - right.south) < 0.00002
    && Math.abs(left.east - right.east) < 0.00002
    && Math.abs(left.west - right.west) < 0.00002;
}

function serializeShape(points: MapPoint[]) {
  return points.slice(0, 20).map(({ lat, lng }) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
}

export default function ListingsMap({
  listings,
  initialBounds,
  initialShape,
}: {
  listings: MapListing[];
  initialBounds?: MapBounds;
  initialShape?: MapPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const viewportRef = useRef<LatLngBounds | null>(null);
  const areaLayerRef = useRef<Polygon | Rectangle | null>(null);
  const draftLineRef = useRef<Polyline | null>(null);
  const draftMarkersRef = useRef<CircleMarker[]>([]);
  const drawRef = useRef<{ enabled: boolean; points: LatLng[] }>({ enabled: false, points: [] });
  const autoSearchRef = useRef(true);
  const searchBoundsRef = useRef<(bounds: MapBounds, options?: { replace?: boolean; shape?: MapPoint[] }) => void>(() => undefined);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [areaSelected, setAreaSelected] = useState(Boolean(initialBounds));
  const [viewportChanged, setViewportChanged] = useState(false);
  const [autoSearch, setAutoSearch] = useState(true);
  const [drawMessage, setDrawMessage] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(listings[0]?.slug ?? "");
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function currentUrlBounds(): MapBounds | null {
    const bounds = {
      north: Number(searchParams.get("north")),
      south: Number(searchParams.get("south")),
      east: Number(searchParams.get("east")),
      west: Number(searchParams.get("west")),
    };
    return Object.values(bounds).every(Number.isFinite) && bounds.north > bounds.south && bounds.east > bounds.west
      ? bounds
      : null;
  }

  function searchBounds(bounds: MapBounds, options: { replace?: boolean; shape?: MapPoint[] } = {}) {
    const shapeValue = options.shape?.length ? serializeShape(options.shape) : "";
    const urlBounds = currentUrlBounds();
    if (urlBounds && sameBounds(urlBounds, bounds) && (searchParams.get("shape") ?? "") === shapeValue) {
      setViewportChanged(false);
      setDrawMessage(shapeValue ? "Showing homes inside the drawn area." : "Showing homes in this map view.");
      return;
    }

    const query = new URLSearchParams(searchParams.toString());
    query.set("north", bounds.north.toFixed(6));
    query.set("south", bounds.south.toFixed(6));
    query.set("east", bounds.east.toFixed(6));
    query.set("west", bounds.west.toFixed(6));
    if (shapeValue) query.set("shape", shapeValue);
    else query.delete("shape");
    query.set("view", "map");
    query.delete("page");
    setViewportChanged(false);
    setDrawMessage("Updating homes for this map area…");
    const target = `${pathname}?${query.toString()}#property-results`;
    startTransition(() => {
      if (options.replace) router.replace(target, { scroll: false });
      else router.push(target, { scroll: false });
    });
  }
  useEffect(() => {
    searchBoundsRef.current = searchBounds;
  });

  function clearDraft() {
    draftLineRef.current?.remove();
    draftLineRef.current = null;
    for (const marker of draftMarkersRef.current) marker.remove();
    draftMarkersRef.current = [];
    drawRef.current = { enabled: false, points: [] };
    setPointCount(0);
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;
      setReady(false);
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      for (const listing of listings) {
        const markerIcon = L.divIcon({
          className: "listing-map-marker",
          html: `<span>${formatPrice(listing.price)}</span>`,
          iconSize: [86, 30],
          iconAnchor: [43, 15],
        });
        L.marker([listing.lat, listing.lng], { icon: markerIcon })
          .addTo(map)
          .on("click", () => setSelectedSlug(listing.slug));
      }

      if (initialShape && initialShape.length >= 3) {
        areaLayerRef.current = L.polygon(initialShape.map(({ lat, lng }) => [lat, lng]), {
          color: "#c8402f",
          weight: 3,
          fillColor: "#c8402f",
          fillOpacity: 0.1,
        }).addTo(map);
        map.fitBounds(areaLayerRef.current.getBounds(), { padding: [24, 24] });
        setAreaSelected(true);
        setDrawMessage("Showing homes inside the drawn area. Move or zoom the map to search a different view.");
      } else if (initialBounds) {
        areaLayerRef.current = L.rectangle([
          [initialBounds.south, initialBounds.west],
          [initialBounds.north, initialBounds.east],
        ], { color: "#c8402f", weight: 2, fillColor: "#c8402f", fillOpacity: 0.06 }).addTo(map);
        map.fitBounds(areaLayerRef.current.getBounds(), { padding: [24, 24] });
        setAreaSelected(true);
        setDrawMessage("Showing homes in this map area. Pan or zoom and the results will update automatically.");
      } else if (listings.length > 0) {
        const listingBounds = L.latLngBounds(listings.map((listing) => [listing.lat, listing.lng]));
        if (listings.length === 1) map.setView(listingBounds.getCenter(), 14);
        else map.fitBounds(listingBounds, { padding: [32, 32], maxZoom: 14 });
        setAreaSelected(false);
        setDrawMessage("Pan or zoom the map and the homes will update automatically.");
      } else {
        map.setView([26.2, -80.13], 9);
      }

      viewportRef.current = map.getBounds();
      map.on("moveend", () => {
        viewportRef.current = map.getBounds();
        if (drawRef.current.enabled) return;
        setViewportChanged(true);
        if (!autoSearchRef.current) {
          setDrawMessage("Map moved. Press “Search this map area” to refresh the homes.");
          return;
        }
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
        setDrawMessage("Map moved. Updating homes…");
        autoTimerRef.current = setTimeout(() => {
          const viewport = viewportRef.current;
          if (viewport) searchBoundsRef.current(asMapBounds(viewport), { replace: true });
        }, 700);
      });

      map.on("click", (event) => {
        if (!drawRef.current.enabled) return;
        const points = [...drawRef.current.points, event.latlng].slice(0, 20);
        drawRef.current.points = points;
        const pointMarker = L.circleMarker(event.latlng, {
          radius: 5,
          color: "#c8402f",
          fillColor: "#c8402f",
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
        draftMarkersRef.current.push(pointMarker);
        draftLineRef.current?.remove();
        draftLineRef.current = L.polyline(points, { color: "#c8402f", weight: 3, dashArray: "7 6", interactive: false }).addTo(map);
        setPointCount(points.length);
        setDrawMessage(points.length < 3
          ? `Add ${3 - points.length} more ${3 - points.length === 1 ? "point" : "points"} to make an area.`
          : "Keep adding boundary points, or press “Finish area”.");
      });

      setReady(true);
    }

    void initializeMap();
    return () => {
      cancelled = true;
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      areaLayerRef.current = null;
      draftLineRef.current = null;
      draftMarkersRef.current = [];
    };
  // The map is deliberately rebuilt when the server returns a new set of MLS markers.
  }, [initialBounds, initialShape, listings]);

  function beginDrawing() {
    const map = mapRef.current;
    if (!map) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    clearDraft();
    drawRef.current = { enabled: true, points: [] };
    map.dragging.disable();
    map.doubleClickZoom.disable();
    setDrawing(true);
    setViewportChanged(false);
    setDrawMessage("Click around the boundary. Use at least three points, then press “Finish area”.");
  }

  function cancelDrawing() {
    const map = mapRef.current;
    if (!map) return;
    clearDraft();
    map.dragging.enable();
    map.doubleClickZoom.enable();
    setDrawing(false);
    setDrawMessage(areaSelected ? "The current map-area filter is still active." : "Pan or zoom the map and the homes will update automatically.");
  }

  function undoPoint() {
    const L = leafletRef.current;
    if (!L || drawRef.current.points.length === 0) return;
    drawRef.current.points = drawRef.current.points.slice(0, -1);
    draftMarkersRef.current.pop()?.remove();
    draftLineRef.current?.remove();
    draftLineRef.current = drawRef.current.points.length
      ? L.polyline(drawRef.current.points, { color: "#c8402f", weight: 3, dashArray: "7 6", interactive: false }).addTo(mapRef.current!)
      : null;
    setPointCount(drawRef.current.points.length);
    setDrawMessage("Boundary point removed. Continue drawing or finish the area.");
  }

  function finishDrawing() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const points = drawRef.current.points;
    if (!L || !map || points.length < 3) return;
    const shape = points.map(({ lat, lng }) => ({ lat, lng }));
    clearDraft();
    areaLayerRef.current?.remove();
    areaLayerRef.current = L.polygon(shape.map(({ lat, lng }) => [lat, lng]), {
      color: "#c8402f",
      weight: 3,
      fillColor: "#c8402f",
      fillOpacity: 0.1,
    }).addTo(map);
    map.dragging.enable();
    map.doubleClickZoom.enable();
    setDrawing(false);
    setAreaSelected(true);
    searchBounds(asMapBounds(areaLayerRef.current.getBounds()), { shape });
  }

  function searchVisibleArea() {
    const bounds = viewportRef.current ?? mapRef.current?.getBounds();
    if (bounds) searchBounds(asMapBounds(bounds));
  }

  function clearArea() {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["north", "south", "east", "west", "shape", "page"]) query.delete(key);
    query.set("view", "map");
    areaLayerRef.current?.remove();
    areaLayerRef.current = null;
    setAreaSelected(false);
    setDrawMessage("Map-area filter cleared. Pan or zoom to search a new view.");
    startTransition(() => router.push(`${pathname}?${query.toString()}#property-results`, { scroll: false }));
  }

  const selected = listings.find((listing) => listing.slug === selectedSlug) ?? listings[0];

  return (
    <div className="rounded-sm border border-ink/10 bg-white p-3 md:p-4" aria-busy={isPending}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={drawing ? cancelDrawing : beginDrawing} disabled={!ready || isPending} className="rounded-sm border border-tide/25 px-3 py-2 text-sm font-medium text-tide hover:bg-tide/5 disabled:opacity-50">
          {drawing ? "Cancel drawing" : "Draw a search area"}
        </button>
        {drawing ? (
          <>
            <button type="button" onClick={undoPoint} disabled={pointCount === 0} className="rounded-sm border border-ink/15 px-3 py-2 text-sm text-ink/65 disabled:opacity-40">Undo point</button>
            <button type="button" onClick={finishDrawing} disabled={pointCount < 3} className="rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand disabled:opacity-40">Finish area ({pointCount})</button>
          </>
        ) : (
          <button type="button" onClick={searchVisibleArea} disabled={!ready || isPending || (!viewportChanged && Boolean(initialBounds))} className="rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand hover:bg-hibiscus-dark disabled:opacity-50">
            {isPending ? "Updating homes…" : "Search this map area"}
          </button>
        )}
        {initialBounds || areaSelected ? <button type="button" onClick={clearArea} className="px-2 py-2 text-sm text-tide underline underline-offset-4">Clear area</button> : null}
        <label className="ml-auto flex items-center gap-2 rounded-full bg-tide/5 px-3 py-2 text-xs font-medium text-tide">
          <input
            type="checkbox"
            checked={autoSearch}
            onChange={(event) => {
              const checked = event.target.checked;
              setAutoSearch(checked);
              autoSearchRef.current = checked;
              if (!checked && autoTimerRef.current) clearTimeout(autoTimerRef.current);
              if (checked && viewportChanged) searchVisibleArea();
            }}
            className="h-4 w-4 accent-hibiscus"
          />
          Update as map moves
        </label>
      </div>
      <p className="mb-3 min-h-5 text-xs text-ink/55" aria-live="polite">
        {drawMessage || "Pan or zoom the map and the homes will update automatically."}
      </p>
      <div ref={containerRef} className="h-[60vh] min-h-[440px] w-full rounded-sm bg-keystone xl:h-[68vh]" aria-label="Interactive map of property search results" />
      {selected ? (
        <div className="mt-3 flex flex-col justify-between gap-2 rounded-sm bg-keystone/60 p-3 sm:flex-row sm:items-center">
          <div><p className="font-display text-lg text-ink">{formatPrice(selected.price)}</p><p className="text-sm text-ink/70">{selected.address}, {selected.city}</p></div>
          <Link href={`/properties/${selected.slug}`} className="text-sm font-medium text-tide underline underline-offset-4">View photos &amp; details</Link>
        </div>
      ) : null}
    </div>
  );
}
