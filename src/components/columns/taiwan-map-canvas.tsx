"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { getRegion, type ColumnPin } from "@/lib/expert-columns";

type MapState = { L: typeof Leaflet; map: Leaflet.Map; group?: Leaflet.MarkerClusterGroup; markers: Map<string, Leaflet.Marker> };
const homeBounds: Leaflet.LatLngTuple[] = [[21.85, 119.25], [25.4, 122.05]];

export default function TaiwanMapCanvas({ pins, selectedId, county, resetKey, onSelect }: {
  pins: ColumnPin[]; selectedId: string | null; county: string; resetKey: number; onSelect: (id: string) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const state = useRef<MapState | null>(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  useEffect(() => { select.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    async function start() {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !surface.current) return;
      map = L.map(surface.current, { minZoom: 6, maxZoom: 17, scrollWheelZoom: false, zoomControl: false });
      L.control.zoom({ position: "bottomright", zoomInTitle: "放大地圖", zoomOutTitle: "縮小地圖" }).addTo(map);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).on("tileerror", () => { if (!cancelled) setTileError(true); }).addTo(map);
      map.fitBounds(homeBounds, { padding: [20, 20] });
      state.current = { L, map, markers: new Map() };
      resize = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resize.observe(surface.current);
      setReady(true);
    }
    start().catch(() => { if (!cancelled) setError("地圖暫時無法載入，仍可從右側列表閱讀專欄。"); });
    return () => { cancelled = true; resize?.disconnect(); map?.remove(); state.current = null; };
  }, []);

  useEffect(() => {
    const current = state.current;
    if (!ready || !current) return;
    const { L, map } = current;
    const group = L.markerClusterGroup({
      chunkedLoading: true, chunkInterval: 100, chunkDelay: 30, maxClusterRadius: 42,
      showCoverageOnHover: false, spiderfyOnMaxZoom: true, zoomToBoundsOnClick: true,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      iconCreateFunction: (cluster) => {
        const content = document.createElement("span");
        content.textContent = String(cluster.getChildCount());
        content.setAttribute("aria-label", `${cluster.getChildCount()} 篇專欄，點擊展開`);
        return L.divIcon({ html: content, className: "expert-map-cluster", iconSize: [42, 42] });
      },
    });
    const markers = new Map<string, Leaflet.Marker>();
    for (const pin of pins) {
      const region = getRegion(pin.regionCode);
      if (!region) continue;
      const shape = document.createElement("span");
      shape.className = "expert-pin-shape";
      const marker = L.marker([region.lat, region.lng], {
        icon: L.divIcon({ html: shape, className: "expert-map-pin", iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -32] }),
        title: `${pin.author} · ${region.county}${region.district} · ${pin.title}`,
        alt: `${pin.title}，${region.county}${region.district}`,
      });
      const popup = document.createElement("div");
      popup.className = "expert-map-popup";
      const location = document.createElement("small");
      location.textContent = `${region.county} · ${region.district}`;
      const title = document.createElement("strong");
      title.textContent = pin.title;
      const author = document.createElement("p");
      author.textContent = pin.author;
      const link = document.createElement("a");
      link.href = pin.href;
      link.textContent = "閱讀專欄 →";
      popup.append(location, title, author, link);
      marker.bindPopup(popup, { maxWidth: 260 }).on("click", () => select.current(pin.id));
      markers.set(pin.id, marker);
    }
    current.group = group;
    current.markers = markers;
    group.addTo(map);
    group.addLayers([...markers.values()]);
    if (county && markers.size) map.fitBounds(L.latLngBounds([...markers.values()].map((marker) => marker.getLatLng())), { padding: [45, 45], maxZoom: 11, animate: false });
    else {
      const bounds = L.latLngBounds(homeBounds);
      markers.forEach((marker) => bounds.extend(marker.getLatLng()));
      map.fitBounds(bounds, { padding: [20, 20], animate: false });
    }
    return () => { map.closePopup(); map.removeLayer(group); current.markers.clear(); };
  }, [pins, ready, county, resetKey]);

  useEffect(() => {
    const current = state.current;
    if (!current?.group || !selectedId) return;
    const marker = current.markers.get(selectedId);
    if (!marker) return;
    if (!current.group.hasLayer(marker)) current.group.addLayer(marker);
    current.group.zoomToShowLayer(marker, () => { if (state.current === current) marker.openPopup(); });
  }, [selectedId, pins, ready]);

  return <div className="taiwan-map-frame">
    <div ref={surface} className="taiwan-map-surface" aria-label="台灣達人專欄互動地圖" />
    {!ready && !error && <p className="map-load-message" role="status">正在展開台灣地圖…</p>}
    {error && <p className="map-load-message" role="alert">{error}</p>}
    {tileError && <p className="map-tile-error" role="status">底圖暫時無法載入；圖釘與專欄列表仍可使用。</p>}
  </div>;
}
