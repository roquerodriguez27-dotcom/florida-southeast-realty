"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type {
  CircleMarker,
  LayerGroup,
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
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const viewportRef = useRef<LatLngBounds | null>(null);
  const areaLayerRef = useRef<Polygon | Rectangle | null>(null);
  const draftLineRef = useRef<Polyline | null>(null);
  const draftMarkersRef = useRef<CircleMarker[]>([]);
  const drawRef = useRef<{ enabled: boolean; points: LatLng[] }>({ enabled: false, points: [] });
  const startupListingsRef = useRef(listings);
  const startupBoundsRef = useRef(initialBounds);
  const startupShapeRef = useRef(initialShape);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [viewportChanged, setViewportChanged] = useState(false);
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
        scrollWheelZoom: false,
        doubleClickZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);

      const startupShape = startupShapeRef.current;
      const startupBounds = startupBoundsRef.current;
      const startupListings = startupListingsRef.current;
      if (startupShape && startupShape.length >= 3) {
        map.fitBounds(L.latLngBounds(startupShape.map(({ lat, lng }) => [lat, lng])), { padding: [24, 24] });
        setDrawMessage("Showing homes inside the drawn area. Move or zoom the map to search a different view.");
      } else if (startupBounds) {
        map.fitBounds([
          [startupBounds.south, startupBounds.west],
          [startupBounds.north, startupBounds.east],
        ], { padding: [24, 24] });
        setDrawMessage("Showing homes in this map area. Move the map, then press “Search this area” to update.");
      } else if (startupListings.length > 0) {
        const listingBounds = L.latLngBounds(startupListings.map((listing) => [listing.lat, listing.lng]));
        if (startupListings.length === 1) map.setView(listingBounds.getCenter(), 14);
        else map.fitBounds(listingBounds, { padding: [32, 32], maxZoom: 14 });
        setDrawMessage("Move the map, then press “Search this area” to update the homes.");
      } else {
        map.setView([26.2, -80.13], 9);
      }

      viewportRef.current = map.getBounds();
      map.on("moveend", () => {
        viewportRef.current = map.getBounds();
        if (drawRef.current.enabled) return;
        setViewportChanged(true);
        setDrawMessage("Map moved. Press “Search this area” to refresh the homes.");
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
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markerLayerRef.current = null;
      areaLayerRef.current = null;
      draftLineRef.current = null;
      draftMarkersRef.current = [];
    };
  // Keep the Leaflet instance stable while refreshed MLS results replace only its markers.
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!ready || !L || !map || !markerLayer) return;

    markerLayer.clearLayers();
    for (const listing of listings) {
      const markerIcon = L.divIcon({
        className: "listing-map-marker",
        html: `<span>${formatPrice(listing.price)}</span>`,
        iconSize: [86, 30],
        iconAnchor: [43, 15],
      });
      L.marker([listing.lat, listing.lng], {
        icon: markerIcon,
        keyboard: true,
        riseOnHover: true,
        title: `${formatPrice(listing.price)} — ${listing.address}, ${listing.city}`,
      })
        .addTo(markerLayer)
        .on("click", () => setSelectedSlug(listing.slug));
    }
    setSelectedSlug((current) => listings.some((listing) => listing.slug === current) ? current : listings[0]?.slug ?? "");
  }, [listings, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    areaLayerRef.current?.remove();
    areaLayerRef.current = null;
    if (initialShape && initialShape.length >= 3) {
      areaLayerRef.current = L.polygon(initialShape.map(({ lat, lng }) => [lat, lng]), {
        color: "#c8402f",
        weight: 3,
        fillColor: "#c8402f",
        fillOpacity: 0.1,
      }).addTo(map);
    } else if (initialBounds) {
      areaLayerRef.current = L.rectangle([
        [initialBounds.south, initialBounds.west],
        [initialBounds.north, initialBounds.east],
      ], { color: "#c8402f", weight: 2, fillColor: "#c8402f", fillOpacity: 0.06 }).addTo(map);
    }
  }, [initialBounds, initialShape, ready]);

  function beginDrawing() {
    const map = mapRef.current;
    if (!map) return;
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
    setDrawMessage(initialBounds || initialShape ? "The current map-area filter is still active." : "Move the map, then press “Search this area” to update the homes.");
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
    setDrawMessage("Map-area filter cleared. Pan or zoom to search a new view.");
    startTransition(() => router.push(`${pathname}?${query.toString()}#property-results`, { scroll: false }));
  }

  const selected = listings.find((listing) => listing.slug === selectedSlug) ?? listings[0];

  return (
    <div className="rounded-sm border border-ink/10 bg-white p-3 md:p-4" aria-busy={isPending}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={drawing ? cancelDrawing : beginDrawing} disabled={!ready || isPending} className="min-h-11 rounded-sm border border-tide/25 px-3 py-2 text-sm font-medium text-tide hover:bg-tide/5 disabled:opacity-50">
          {drawing ? "Cancel drawing" : "Draw area"}
        </button>
        {drawing ? (
          <>
            <button type="button" onClick={undoPoint} disabled={pointCount === 0} className="min-h-11 rounded-sm border border-ink/15 px-3 py-2 text-sm text-ink/65 disabled:opacity-40">Undo point</button>
            <button type="button" onClick={finishDrawing} disabled={pointCount < 3} className="min-h-11 rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand disabled:opacity-40">Finish area ({pointCount})</button>
          </>
        ) : (
          <button type="button" onClick={searchVisibleArea} disabled={!ready || isPending || !viewportChanged} className="min-h-11 rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand hover:bg-hibiscus-dark disabled:cursor-default disabled:bg-tide/10 disabled:text-ink/45">
            {isPending ? "Updating homes…" : viewportChanged ? "Search this area" : "Move map to update"}
          </button>
        )}
        {initialBounds || initialShape ? <button type="button" onClick={clearArea} className="ml-auto min-h-11 px-2 py-2 text-sm text-tide underline underline-offset-4">Clear area</button> : null}
      </div>
      <p className="mb-3 min-h-5 text-xs text-ink/55" aria-live="polite">
        {drawMessage || "Move the map, then press “Search this area” to update the homes."}
      </p>
      <div ref={containerRef} className="h-[52svh] min-h-[360px] max-h-[620px] w-full rounded-sm bg-keystone sm:h-[60vh] sm:min-h-[440px] xl:h-[68vh] xl:max-h-[720px]" aria-label="Interactive map of property search results" />
      {selected ? (
        <div className="mt-3 flex flex-col justify-between gap-2 rounded-sm bg-keystone/60 p-3 sm:flex-row sm:items-center">
          <div><p className="font-display text-lg text-ink">{formatPrice(selected.price)}</p><p className="text-sm text-ink/70">{selected.address}, {selected.city}</p></div>
          <Link href={`/properties/${selected.slug}`} className="text-sm font-medium text-tide underline underline-offset-4">View photos &amp; details</Link>
        </div>
      ) : null}
    </div>
  );
}
