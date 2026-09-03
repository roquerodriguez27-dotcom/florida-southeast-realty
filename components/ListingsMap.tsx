"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  LayerGroup,
  LatLng,
  LatLngBounds,
  Map as LeafletMap,
  Polygon,
  Polyline,
  Rectangle,
  TileLayer,
} from "leaflet";
import type { Feature, MultiPolygon, Polygon as GeoJsonPolygon } from "geojson";
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
  image: string;
}

type MapBounds = NonNullable<ListingFilters["bounds"]>;
type MapPoint = NonNullable<ListingFilters["polygon"]>[number];
type LeafletModule = typeof import("leaflet");
type MapView = "street" | "satellite";
type PlaceCategory = "schools" | "shopping" | "parks" | "healthcare" | "worship";
const CENSUS_BOUNDARY_ATTRIBUTION = '<a href="https://tigerweb.geo.census.gov/">U.S. Census Bureau</a>';
const NEARBY_PLACE_ATTRIBUTION = 'Nearby places: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_SHAPE_POINTS = 40;
const PLACE_CATEGORIES: Array<{ category: PlaceCategory; label: string; shortLabel: string; color: string }> = [
  { category: "schools", label: "Schools", shortLabel: "S", color: "#316c91" },
  { category: "shopping", label: "Shopping", shortLabel: "$", color: "#9a5d25" },
  { category: "parks", label: "Parks", shortLabel: "P", color: "#3f6f4e" },
  { category: "healthcare", label: "Healthcare", shortLabel: "+", color: "#a63838" },
  { category: "worship", label: "Places of worship", shortLabel: "W", color: "#72548f" },
];
type BoundaryFeature = Feature<GeoJsonPolygon | MultiPolygon, {
  kind: "ZIP" | "County" | "City";
  label: string;
  source: string;
}>;

interface BoundaryResponse {
  boundaries?: Array<{
    feature: BoundaryFeature;
    kind: "ZIP" | "County" | "City";
    location: string;
  }>;
  unavailable?: string[];
}

interface MapPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  detail?: string;
}

interface PlacesResponse {
  places?: MapPlace[];
  message?: string;
}

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
  return points.slice(0, MAX_SHAPE_POINTS).map(({ lat, lng }) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
}

function sampleShapePoints(points: LatLng[]): MapPoint[] {
  if (points.length <= MAX_SHAPE_POINTS) return points.map(({ lat, lng }) => ({ lat, lng }));
  return Array.from({ length: MAX_SHAPE_POINTS }, (_, index) => {
    const point = points[Math.round((index * (points.length - 1)) / (MAX_SHAPE_POINTS - 1))];
    return { lat: point.lat, lng: point.lng };
  });
}

export default function ListingsMap({
  listings,
  locations,
  initialBounds,
  initialShape,
}: {
  listings: MapListing[];
  locations?: string[];
  initialBounds?: MapBounds;
  initialShape?: MapPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const baseLayersRef = useRef<Record<MapView, TileLayer> | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const placeLayerRef = useRef<LayerGroup | null>(null);
  const locationBoundaryLayerRef = useRef<LayerGroup | null>(null);
  const viewportRef = useRef<LatLngBounds | null>(null);
  const areaLayerRef = useRef<Polygon | Rectangle | null>(null);
  const draftLineRef = useRef<Polyline | null>(null);
  const drawRef = useRef<{ enabled: boolean; active: boolean; pointerId: number | null; points: LatLng[] }>({
    enabled: false,
    active: false,
    pointerId: null,
    points: [],
  });
  const startupListingsRef = useRef(listings);
  const startupBoundsRef = useRef(initialBounds);
  const startupShapeRef = useRef(initialShape);
  const fittedLocationKeyRef = useRef("");
  const boundaryRequestKeyRef = useRef("");
  const suppressNextMoveEndRef = useRef(false);
  const suppressMoveEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userMovedMapRef = useRef(false);
  const mapInteractionRef = useRef(false);
  const lastMapPointerMoveAtRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [mapView, setMapView] = useState<MapView>("street");
  const [drawing, setDrawing] = useState(false);
  const [viewportChanged, setViewportChanged] = useState(false);
  const [drawMessage, setDrawMessage] = useState("");
  const [activePlaceCategories, setActivePlaceCategories] = useState<PlaceCategory[]>([]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [placesStatus, setPlacesStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [placesMessage, setPlacesMessage] = useState("");
  const [boundaryResult, setBoundaryResult] = useState<{
    key: string;
    locations: string[];
    status: "ready" | "unavailable";
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationKey = (locations ?? []).map((location) => location.trim()).filter(Boolean).join("\u0000");
  const hasExplicitArea = Boolean(initialBounds || initialShape);
  const boundaryStatus = !locationKey
    ? "idle"
    : boundaryResult?.key === locationKey
      ? boundaryResult.status
      : "loading";
  const outlinedLocations = boundaryResult?.key === locationKey ? boundaryResult.locations : [];
  const nearbyEnabled = activePlaceCategories.length > 0;
  const areaRequestKey = initialBounds
    ? `${initialBounds.north},${initialBounds.south},${initialBounds.east},${initialBounds.west}`
    : initialShape?.length
      ? serializeShape(initialShape)
      : "initial";

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

  function selectMapView(nextView: MapView) {
    const map = mapRef.current;
    const layers = baseLayersRef.current;
    if (!map || !layers || mapView === nextView) return;

    const nextLayer = layers[nextView];
    for (const layer of Object.values(layers)) {
      if (layer !== nextLayer && map.hasLayer(layer)) map.removeLayer(layer);
    }
    if (!map.hasLayer(nextLayer)) nextLayer.addTo(map);
    nextLayer.bringToBack();
    setMapView(nextView);
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
    drawRef.current = { enabled: false, active: false, pointerId: null, points: [] };
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
        boxZoom: true,
        keyboard: true,
      });
      mapRef.current = map;

      const streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
      const satelliteLayer = L.tileLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a> / USDA',
        maxNativeZoom: 16,
        maxZoom: 19,
      });
      baseLayersRef.current = { street: streetLayer, satellite: satelliteLayer };
      streetLayer.addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);

      const startupShape = startupShapeRef.current;
      const startupBounds = startupBoundsRef.current;
      const startupListings = startupListingsRef.current;
      if (startupShape && startupShape.length >= 3) {
        map.fitBounds(L.latLngBounds(startupShape.map(({ lat, lng }) => [lat, lng])), { padding: [24, 24] });
        setDrawMessage("Showing homes inside the drawn area. Hover over a price marker for a quick preview.");
      } else if (startupBounds) {
        map.fitBounds([
          [startupBounds.south, startupBounds.west],
          [startupBounds.north, startupBounds.east],
        ], { padding: [24, 24] });
        setDrawMessage("Showing homes in this map area. Hover over a price marker for a quick preview.");
      } else if (startupListings.length > 0) {
        const listingBounds = L.latLngBounds(startupListings.map((listing) => [listing.lat, listing.lng]));
        if (startupListings.length === 1) map.setView(listingBounds.getCenter(), 14);
        else map.fitBounds(listingBounds, { padding: [32, 32], maxZoom: 14 });
        setDrawMessage("Hover over a price marker for a quick preview. Use the mouse wheel or + / − buttons to zoom.");
      } else {
        map.setView([26.2, -80.13], 9);
      }

      viewportRef.current = map.getBounds();
      map.on("moveend", () => {
        viewportRef.current = map.getBounds();
        if (suppressNextMoveEndRef.current) {
          suppressNextMoveEndRef.current = false;
          if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
          suppressMoveEndTimerRef.current = null;
          return;
        }
        if (drawRef.current.enabled) return;
        userMovedMapRef.current = true;
        setViewportChanged(true);
        setDrawMessage("Map moved. Press “Search this area” to refresh the homes.");
      });

      map.on("dragstart zoomstart", () => {
        mapInteractionRef.current = true;
        lastMapPointerMoveAtRef.current = 0;
        map.closePopup();
      });
      map.on("dragend zoomend", () => {
        mapInteractionRef.current = false;
      });

      map.on("autopanstart", () => {
        if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
        suppressNextMoveEndRef.current = true;
        suppressMoveEndTimerRef.current = setTimeout(() => {
          suppressNextMoveEndRef.current = false;
          suppressMoveEndTimerRef.current = null;
          viewportRef.current = map.getBounds();
        }, 1_000);
      });

      setReady(true);
    }

    void initializeMap();
    return () => {
      cancelled = true;
      if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      baseLayersRef.current = null;
      markerLayerRef.current = null;
      placeLayerRef.current = null;
      locationBoundaryLayerRef.current = null;
      areaLayerRef.current = null;
      draftLineRef.current = null;
    };
  // Keep the Leaflet instance stable while refreshed MLS results replace only its markers.
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    const requestedLocations = locationKey ? locationKey.split("\u0000") : [];
    const controller = new AbortController();
    let cancelled = false;
    if (boundaryRequestKeyRef.current !== locationKey) {
      boundaryRequestKeyRef.current = locationKey;
      userMovedMapRef.current = false;
    }
    locationBoundaryLayerRef.current?.remove();
    locationBoundaryLayerRef.current = null;

    if (requestedLocations.length === 0) {
      fittedLocationKeyRef.current = "";
      boundaryRequestKeyRef.current = "";
      return () => controller.abort();
    }

    const query = new URLSearchParams();
    for (const location of requestedLocations) query.append("location", location);

    void fetch(`/api/map-boundaries?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Boundary request failed with HTTP ${response.status}.`);
        return response.json() as Promise<BoundaryResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        const boundaries = payload.boundaries ?? [];
        if (boundaries.length === 0) {
          setBoundaryResult({ key: locationKey, locations: [], status: "unavailable" });
          return;
        }

        const group = L.layerGroup().addTo(map);
        const combinedBounds = L.latLngBounds([]);
        for (const boundary of boundaries) {
          const layer = L.geoJSON(boundary.feature, {
            interactive: true,
            style: {
              color: "#d13d32",
              fillColor: "#d13d32",
              fillOpacity: 0.055,
              opacity: 0.95,
              weight: 4,
            },
          }).bindTooltip(boundary.location, {
            direction: "top",
            sticky: true,
          }).addTo(group);
          combinedBounds.extend(layer.getBounds());
        }
        locationBoundaryLayerRef.current = group;
        map.attributionControl.addAttribution(CENSUS_BOUNDARY_ATTRIBUTION);
        setBoundaryResult({
          key: locationKey,
          locations: boundaries.map((boundary) => boundary.location),
          status: "ready",
        });

        if (
          combinedBounds.isValid()
          && !hasExplicitArea
          && !userMovedMapRef.current
          && fittedLocationKeyRef.current !== locationKey
        ) {
          fittedLocationKeyRef.current = locationKey;
          if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
          suppressNextMoveEndRef.current = true;
          map.fitBounds(combinedBounds, { padding: [30, 30], maxZoom: 14 });
          suppressMoveEndTimerRef.current = setTimeout(() => {
            suppressNextMoveEndRef.current = false;
            suppressMoveEndTimerRef.current = null;
            viewportRef.current = map.getBounds();
          }, 1_000);
        }
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setBoundaryResult({ key: locationKey, locations: [], status: "unavailable" });
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
      suppressMoveEndTimerRef.current = null;
      suppressNextMoveEndRef.current = false;
      locationBoundaryLayerRef.current?.remove();
      locationBoundaryLayerRef.current = null;
      map.attributionControl.removeAttribution(CENSUS_BOUNDARY_ATTRIBUTION);
    };
  }, [hasExplicitArea, locationKey, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !nearbyEnabled) {
      setPlaces([]);
      setPlacesStatus("idle");
      setPlacesMessage("");
      return;
    }

    if (map.getZoom() < 12) {
      setPlaces([]);
      setPlacesStatus("unavailable");
      setPlacesMessage("Zoom in closer, then choose a nearby layer again.");
      return;
    }

    const bounds = viewportRef.current ?? map.getBounds();
    const query = new URLSearchParams({
      north: bounds.getNorth().toFixed(4),
      south: bounds.getSouth().toFixed(4),
      east: bounds.getEast().toFixed(4),
      west: bounds.getWest().toFixed(4),
    });
    const controller = new AbortController();
    let cancelled = false;
    setPlacesStatus("loading");
    setPlacesMessage("Loading nearby places…");

    void fetch(`/api/map-places?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as PlacesResponse;
        if (!response.ok) throw new Error(payload.message || `Nearby-place request failed with HTTP ${response.status}.`);
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setPlaces(payload.places ?? []);
        setPlacesStatus("ready");
        setPlacesMessage(payload.places?.length
          ? "Showing nearby places in this map view."
          : "No nearby places in the selected categories were found here.");
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setPlaces([]);
        setPlacesStatus("unavailable");
        setPlacesMessage(error instanceof Error ? error.message : "Nearby places are temporarily unavailable.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [areaRequestKey, nearbyEnabled, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    placeLayerRef.current?.remove();
    placeLayerRef.current = null;
    map.attributionControl.removeAttribution(NEARBY_PLACE_ATTRIBUTION);
    if (!nearbyEnabled || places.length === 0) return;

    const group = L.layerGroup().addTo(map);
    for (const place of places) {
      if (!activePlaceCategories.includes(place.category)) continue;
      const category = PLACE_CATEGORIES.find((option) => option.category === place.category);
      if (!category) continue;
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: category.color,
        fillOpacity: 0.95,
      });
      const popup = document.createElement("div");
      popup.className = "nearby-place-popup";
      const label = document.createElement("span");
      label.textContent = category.label;
      const name = document.createElement("strong");
      name.textContent = place.name;
      popup.append(label, name);
      if (place.detail) {
        const detail = document.createElement("small");
        detail.textContent = place.detail;
        popup.append(detail);
      }
      marker.bindTooltip(place.name, { direction: "top", sticky: true }).bindPopup(popup).addTo(group);
    }
    placeLayerRef.current = group;
    map.attributionControl.addAttribution(NEARBY_PLACE_ATTRIBUTION);

    return () => {
      group.remove();
      if (placeLayerRef.current === group) placeLayerRef.current = null;
      map.attributionControl.removeAttribution(NEARBY_PLACE_ATTRIBUTION);
    };
  }, [activePlaceCategories, nearbyEnabled, places, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!ready || !L || !map || !markerLayer) return;

    const currentPropertyHref = (slug: string) => {
      const query = new URLSearchParams(searchParams.toString());
      query.set("view", "map");

      const visibleBounds = viewportRef.current;
      if (visibleBounds) {
        query.set("north", visibleBounds.getNorth().toFixed(6));
        query.set("south", visibleBounds.getSouth().toFixed(6));
        query.set("east", visibleBounds.getEast().toFixed(6));
        query.set("west", visibleBounds.getWest().toFixed(6));
      }

      const returnTo = `${pathname}?${query.toString()}#property-results`;
      return `/properties/${encodeURIComponent(slug)}?returnTo=${encodeURIComponent(returnTo)}`;
    };

    const hoverTimers = new Set<ReturnType<typeof setTimeout>>();
    markerLayer.clearLayers();
    for (const listing of listings) {
      const initialPropertyHref = currentPropertyHref(listing.slug);
      const markerIcon = L.divIcon({
        className: "listing-map-marker",
        html: `<span>${formatPrice(listing.price)}</span>`,
        iconSize: [86, 30],
        iconAnchor: [43, 15],
      });
      const popupLink = document.createElement("a");
      popupLink.className = "listing-map-popup";
      popupLink.href = initialPropertyHref;
      popupLink.setAttribute("aria-label", `View ${listing.address}, ${listing.city}`);

      const thumbnail = document.createElement("img");
      thumbnail.src = listing.image || "/property-placeholder.svg";
      thumbnail.alt = `${listing.address}, ${listing.city}`;
      thumbnail.width = 280;
      thumbnail.height = 158;
      thumbnail.loading = "lazy";
      thumbnail.addEventListener("error", () => {
        thumbnail.src = "/property-placeholder.svg";
      }, { once: true });

      const details = document.createElement("span");
      details.className = "listing-map-popup-details";
      const price = document.createElement("strong");
      price.textContent = formatPrice(listing.price);
      const address = document.createElement("span");
      address.textContent = `${listing.address}, ${listing.city}`;
      const callToAction = document.createElement("span");
      callToAction.className = "listing-map-popup-cta";
      callToAction.textContent = "View photos & details →";
      details.append(price, address, callToAction);
      popupLink.append(thumbnail, details);
      popupLink.addEventListener("click", (event) => {
        const nextHref = currentPropertyHref(listing.slug);
        popupLink.href = nextHref;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.push(nextHref);
      });

      const marker = L.marker([listing.lat, listing.lng], {
        icon: markerIcon,
        keyboard: true,
        riseOnHover: true,
        title: `${formatPrice(listing.price)} — ${listing.address}, ${listing.city}`,
      })
        .addTo(markerLayer)
        .bindPopup(popupLink, {
          className: "listing-map-popup-shell",
          minWidth: 230,
          maxWidth: 280,
          autoPan: true,
          autoPanPaddingTopLeft: [28, 28],
          autoPanPaddingBottomRight: [28, 28],
        });
      const previewListing = () => {
        if (drawRef.current.enabled || mapInteractionRef.current) return;
        popupLink.href = currentPropertyHref(listing.slug);
        marker.openPopup();
      };
      let hoverTimer: ReturnType<typeof setTimeout> | null = null;
      marker.on("mouseover", () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          if (hoverTimer) hoverTimers.delete(hoverTimer);
          hoverTimer = null;
          if (performance.now() - lastMapPointerMoveAtRef.current <= 350) previewListing();
        }, 160);
        hoverTimers.add(hoverTimer);
      });
      marker.on("mouseout", () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimers.delete(hoverTimer);
        }
        hoverTimer = null;
      });
      marker.on("click", () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimers.delete(hoverTimer);
          hoverTimer = null;
        }
        previewListing();
      });
    }

    return () => hoverTimers.forEach((timer) => clearTimeout(timer));
  }, [listings, pathname, ready, router, searchParams]);

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

  function setDrawingMode(active: boolean) {
    const container = containerRef.current;
    if (!container) return;
    container.classList.toggle("map-freehand-active", active);
    container.setAttribute(
      "aria-label",
      active ? "Draw a property search area" : "Interactive map of property search results",
    );
  }

  function beginDrawing() {
    const map = mapRef.current;
    if (!map) return;
    clearDraft();
    drawRef.current = { enabled: true, active: false, pointerId: null, points: [] };
    map.closePopup();
    map.stop();
    setDrawingMode(true);
    map.dragging.disable();
    map.doubleClickZoom.disable();
    setDrawing(true);
    setViewportChanged(false);
    setDrawMessage("Hold the mouse button and draw around the area. Release to search.");

    window.requestAnimationFrame(() => {
      if (mapRef.current !== map) return;
      map.invalidateSize({ animate: false, pan: false });
      const hasLoadedTiles = Boolean(containerRef.current?.querySelector(".leaflet-tile-loaded"));
      if (!hasLoadedTiles) baseLayersRef.current?.[mapView].redraw();
    });
  }

  function cancelDrawing() {
    const map = mapRef.current;
    if (!map) return;
    clearDraft();
    setDrawingMode(false);
    map.dragging.enable();
    map.doubleClickZoom.enable();
    setDrawing(false);
    setDrawMessage(initialBounds || initialShape ? "The current map-area filter is still active." : "Move the map, then press “Search this area” to update the homes.");
  }

  function finishDrawing(points: LatLng[]) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (points.length < 3) {
      clearDraft();
      drawRef.current = { enabled: true, active: false, pointerId: null, points: [] };
      setDrawMessage("That area was too small. Hold the mouse button and draw a larger loop.");
      return;
    }
    const shape = sampleShapePoints(points);
    clearDraft();
    areaLayerRef.current?.remove();
    areaLayerRef.current = L.polygon(shape.map(({ lat, lng }) => [lat, lng]), {
      color: "#c8402f",
      weight: 3,
      fillColor: "#c8402f",
      fillOpacity: 0.1,
    }).addTo(map);
    setDrawingMode(false);
    map.dragging.enable();
    map.doubleClickZoom.enable();
    setDrawing(false);
    searchBounds(asMapBounds(areaLayerRef.current.getBounds()), { shape });
  }

  function handleDrawStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawRef.current.enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = map.mouseEventToLatLng(event.nativeEvent as unknown as MouseEvent);
    drawRef.current = { enabled: true, active: true, pointerId: event.pointerId, points: [point] };
    draftLineRef.current?.remove();
    draftLineRef.current = L.polyline([point], {
      color: "#c8402f",
      weight: 4,
      opacity: 0.95,
      interactive: false,
    }).addTo(map);
    setDrawMessage("Keep holding and trace the area. Release when the loop is complete.");
  }

  function handleDrawMove(event: ReactPointerEvent<HTMLDivElement>) {
    lastMapPointerMoveAtRef.current = performance.now();
    const drawState = drawRef.current;
    const map = mapRef.current;
    if (!drawState.enabled || !drawState.active || drawState.pointerId !== event.pointerId || !map) return;
    event.preventDefault();
    event.stopPropagation();
    const point = map.mouseEventToLatLng(event.nativeEvent as unknown as MouseEvent);
    const previous = drawState.points.at(-1);
    if (previous && map.latLngToContainerPoint(previous).distanceTo(map.latLngToContainerPoint(point)) < 6) return;
    const points = [...drawState.points, point].slice(0, 600);
    drawRef.current.points = points;
    draftLineRef.current?.setLatLngs(points);
  }

  function handleDrawEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drawState = drawRef.current;
    if (!drawState.enabled || !drawState.active || drawState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    finishDrawing(drawState.points);
  }

  function togglePlaceCategory(category: PlaceCategory) {
    setActivePlaceCategories((current) => current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category]);
  }

  function searchVisibleArea() {
    const bounds = viewportRef.current ?? mapRef.current?.getBounds();
    if (bounds) searchBounds(asMapBounds(bounds));
  }

  function resetMap() {
    const map = mapRef.current;
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["location", "q", "north", "south", "east", "west", "shape", "page"]) query.delete(key);
    query.set("view", "map");
    clearDraft();
    setDrawingMode(false);
    map?.dragging.enable();
    map?.doubleClickZoom.enable();
    map?.closePopup();
    map?.stop();
    areaLayerRef.current?.remove();
    areaLayerRef.current = null;
    locationBoundaryLayerRef.current?.remove();
    locationBoundaryLayerRef.current = null;
    fittedLocationKeyRef.current = "";
    boundaryRequestKeyRef.current = "";
    userMovedMapRef.current = false;
    lastMapPointerMoveAtRef.current = 0;
    setDrawing(false);
    setViewportChanged(false);
    setActivePlaceCategories([]);
    setDrawMessage("Map reset. Move or zoom, then search this area, or draw a new area.");
    if (map) {
      if (suppressMoveEndTimerRef.current) clearTimeout(suppressMoveEndTimerRef.current);
      suppressNextMoveEndRef.current = true;
      map.setView([26.2, -80.13], 9);
      viewportRef.current = map.getBounds();
      suppressMoveEndTimerRef.current = setTimeout(() => {
        suppressNextMoveEndRef.current = false;
        suppressMoveEndTimerRef.current = null;
        viewportRef.current = map.getBounds();
      }, 500);
    }
    startTransition(() => router.push(`${pathname}?${query.toString()}#property-results`, { scroll: false }));
  }

  return (
    <div className="rounded-sm border border-ink/10 bg-white p-3 md:p-4" aria-busy={isPending}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={drawing ? cancelDrawing : beginDrawing} disabled={!ready || isPending} className="min-h-11 rounded-sm border border-tide/25 px-3 py-2 text-sm font-medium text-tide hover:bg-tide/5 disabled:opacity-50">
          {drawing ? "Cancel drawing" : "Draw area"}
        </button>
        {!drawing ? (
          <button type="button" onClick={searchVisibleArea} disabled={!ready || isPending || !viewportChanged} className="min-h-11 rounded-sm bg-hibiscus px-3 py-2 text-sm font-medium text-sand hover:bg-hibiscus-dark disabled:cursor-default disabled:bg-tide/10 disabled:text-ink/45">
            {isPending ? "Updating homes…" : viewportChanged ? "Search this area" : "Move map to update"}
          </button>
        ) : null}
        <button type="button" onClick={resetMap} disabled={!ready || isPending} className="min-h-11 px-2 py-2 text-sm text-tide underline underline-offset-4 disabled:text-ink/40">
          Reset map
        </button>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Map view">
          <span className="mr-1 hidden text-xs font-medium text-ink/55 sm:inline">Map view</span>
          <button
            type="button"
            aria-pressed={mapView === "street"}
            disabled={!ready}
            onClick={() => selectMapView("street")}
            className={`min-h-11 rounded-sm border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${mapView === "street" ? "border-tide bg-tide text-sand" : "border-ink/15 bg-white text-tide hover:bg-tide/5"}`}
          >
            Street
          </button>
          <button
            type="button"
            aria-pressed={mapView === "satellite"}
            disabled={!ready}
            onClick={() => selectMapView("satellite")}
            className={`min-h-11 rounded-sm border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${mapView === "satellite" ? "border-tide bg-tide text-sand" : "border-ink/15 bg-white text-tide hover:bg-tide/5"}`}
          >
            Satellite
          </button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Nearby places">
        <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">Nearby</span>
        {PLACE_CATEGORIES.map((option) => {
          const active = activePlaceCategories.includes(option.category);
          return (
            <button
              key={option.category}
              type="button"
              aria-pressed={active}
              disabled={!ready || drawing}
              onClick={() => togglePlaceCategory(option.category)}
              className={`nearby-layer-button ${active ? "is-active" : ""}`}
            >
              <span aria-hidden style={{ backgroundColor: option.color }}>{option.shortLabel}</span>
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 min-h-5 text-xs text-ink/55" aria-live="polite">
        {drawMessage || "Hover over a price marker for a quick preview. Move the map, then search this area to update the homes."}
      </p>
      {nearbyEnabled ? (
        <p className={`mb-3 text-xs ${placesStatus === "unavailable" ? "text-hibiscus" : "text-ink/55"}`} aria-live="polite">
          {placesMessage} Nearby-place data may be incomplete; school markers are not attendance boundaries or ratings.
        </p>
      ) : null}
      <div className="relative overflow-hidden rounded-sm border border-tide/10 bg-keystone">
        <div
          ref={containerRef}
          className="h-[52svh] min-h-[360px] max-h-[620px] w-full bg-keystone sm:h-[60vh] sm:min-h-[440px] xl:h-[68vh] xl:max-h-[720px]"
          aria-label="Interactive map of property search results"
          onPointerDownCapture={handleDrawStart}
          onPointerMoveCapture={handleDrawMove}
          onPointerUpCapture={handleDrawEnd}
          onPointerCancelCapture={handleDrawEnd}
        />
        {boundaryStatus !== "idle" ? (
          <div className="map-boundary-status" aria-live="polite">
            <span aria-hidden className={boundaryStatus === "loading" ? "is-loading" : ""} />
            {boundaryStatus === "loading"
              ? "Loading area outline…"
              : boundaryStatus === "ready"
                ? `Red outline: ${outlinedLocations.join(", ")}`
                : "Official area outline unavailable"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
