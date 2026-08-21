"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type {
  CircleMarker,
  LatLng,
  LatLngBounds,
  Map as LeafletMap,
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

function asMapBounds(bounds: LatLngBounds): MapBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

export default function ListingsMap({
  listings,
  initialBounds,
}: {
  listings: MapListing[];
  initialBounds?: MapBounds;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const viewportRef = useRef<LatLngBounds | null>(null);
  const rectangleRef = useRef<Rectangle | null>(null);
  const firstCornerMarkerRef = useRef<CircleMarker | null>(null);
  const drawRef = useRef<{ enabled: boolean; firstCorner: LatLng | null }>({ enabled: false, firstCorner: null });
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [areaSelected, setAreaSelected] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(listings[0]?.slug ?? "");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
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

      if (initialBounds) {
        map.fitBounds([
          [initialBounds.south, initialBounds.west],
          [initialBounds.north, initialBounds.east],
        ], { padding: [24, 24] });
      } else if (listings.length > 0) {
        const listingBounds = L.latLngBounds(listings.map((listing) => [listing.lat, listing.lng]));
        if (listings.length === 1) map.setView(listingBounds.getCenter(), 14);
        else map.fitBounds(listingBounds, { padding: [32, 32], maxZoom: 14 });
      } else {
        map.setView([26.2, -80.13], 9);
      }

      viewportRef.current = map.getBounds();
      map.on("moveend", () => {
        viewportRef.current = map.getBounds();
      });
      map.on("click", (event) => {
        if (!drawRef.current.enabled) return;
        if (!drawRef.current.firstCorner) {
          drawRef.current.firstCorner = event.latlng;
          firstCornerMarkerRef.current?.remove();
          firstCornerMarkerRef.current = L.circleMarker(event.latlng, {
            radius: 6,
            color: "#c8402f",
            fillColor: "#c8402f",
            fillOpacity: 1,
          }).addTo(map);
          setDrawMessage("Now tap the opposite corner of the area.");
          return;
        }

        const bounds = L.latLngBounds(drawRef.current.firstCorner, event.latlng);
        firstCornerMarkerRef.current?.remove();
        firstCornerMarkerRef.current = null;
        rectangleRef.current?.remove();
        rectangleRef.current = L.rectangle(bounds, {
          color: "#c8402f",
          weight: 3,
          fillColor: "#c8402f",
          fillOpacity: 0.1,
        }).addTo(map);
        viewportRef.current = bounds;
        drawRef.current = { enabled: false, firstCorner: null };
        map.dragging.enable();
        setDrawing(false);
        setAreaSelected(true);
        setDrawMessage("Area selected. Press “Search selected area” to update the homes.");
      });

      setAreaSelected(false);
      setReady(true);
    }

    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialBounds, listings]);

  function beginDrawing() {
    const map = mapRef.current;
    if (!map) return;
    rectangleRef.current?.remove();
    rectangleRef.current = null;
    firstCornerMarkerRef.current?.remove();
    firstCornerMarkerRef.current = null;
    drawRef.current = { enabled: true, firstCorner: null };
    map.dragging.disable();
    setDrawing(true);
    setAreaSelected(false);
    setDrawMessage("Tap one corner of the area you want to search.");
  }

  function cancelDrawing() {
    const map = mapRef.current;
    if (!map) return;
    firstCornerMarkerRef.current?.remove();
    firstCornerMarkerRef.current = null;
    drawRef.current = { enabled: false, firstCorner: null };
    map.dragging.enable();
    setDrawing(false);
    setAreaSelected(false);
    setDrawMessage("");
  }

  function searchBounds(bounds: MapBounds) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("north", bounds.north.toFixed(6));
    query.set("south", bounds.south.toFixed(6));
    query.set("east", bounds.east.toFixed(6));
    query.set("west", bounds.west.toFixed(6));
    query.set("view", "map");
    query.delete("page");
    router.push(`${pathname}?${query.toString()}#property-results`);
  }

  function searchVisibleArea() {
    const bounds = rectangleRef.current?.getBounds() ?? viewportRef.current ?? mapRef.current?.getBounds();
    if (bounds) searchBounds(asMapBounds(bounds));
  }

  function clearArea() {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["north", "south", "east", "west", "page"]) query.delete(key);
    query.set("view", "map");
    setAreaSelected(false);
    router.push(`${pathname}?${query.toString()}#property-results`);
  }

  const selected = listings.find((listing) => listing.slug === selectedSlug);

  return (
    <div className="rounded-sm border border-ink/10 bg-white p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={drawing ? cancelDrawing : beginDrawing}
          disabled={!ready}
          className="rounded-sm border border-tide/25 px-3 py-2 text-sm font-medium text-tide hover:bg-tide/5 disabled:opacity-50"
        >
          {drawing ? "Cancel drawing" : "Draw a search area"}
        </button>
        <button
          type="button"
          onClick={searchVisibleArea}
          disabled={!ready}
          className="rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand hover:bg-hibiscus-dark disabled:opacity-50"
        >
          {areaSelected ? "Search selected area" : "Search this map area"}
        </button>
        {initialBounds ? (
          <button type="button" onClick={clearArea} className="px-2 py-2 text-sm text-tide underline underline-offset-4">
            Clear map area
          </button>
        ) : null}
      </div>
      <p className="mb-3 min-h-5 text-xs text-ink/55" aria-live="polite">
        {drawMessage || "Pan or zoom the map, then search that view—or draw a box around a specific neighborhood."}
      </p>
      <div ref={containerRef} className="h-[58vh] min-h-[420px] w-full rounded-sm bg-keystone" aria-label="Interactive map of property search results" />
      {selected ? (
        <div className="mt-3 flex flex-col justify-between gap-2 rounded-sm bg-keystone/60 p-3 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-lg text-ink">{formatPrice(selected.price)}</p>
            <p className="text-sm text-ink/70">{selected.address}, {selected.city}</p>
          </div>
          <Link href={`/properties/${selected.slug}`} className="text-sm font-medium text-tide underline underline-offset-4">
            View photos &amp; details
          </Link>
        </div>
      ) : null}
    </div>
  );
}
