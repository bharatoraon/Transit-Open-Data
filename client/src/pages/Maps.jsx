import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Info, X } from "lucide-react";
import * as turf from "@turf/turf";

// Transit System Colors
const COLORS = {
  cmrl: "#0054a6", // Metro Blue
  mtc: "#e31837", // Bus Red
  sr: "#009a44", // Rail Green
  hub: "#9333ea", // Interchange Purple
  walkshed: "#3b82f6", // Walkshed Blue
};

const LayerToggle = ({ label, layerId, defaultChecked, onToggle }) => {
  return (
    <div className="flex items-center justify-between py-1 hover:bg-gray-50 rounded px-1 transition-colors">
      <label className="text-xs text-gray-700 font-medium cursor-pointer select-none flex-1">
        {label}
      </label>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={() => onToggle(layerId)}
        className="w-3 h-3 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
      />
    </div>
  );
};

const Maps = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [80.2707, 13.0827],
      zoom: 11,
      attributionControl: false,
    });

    // Add standard navigation controls (Zoom, Compass)
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
    // Add scale control
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    // Hover Popup
    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "route-popup"
    });

    let hoveredStateId = null;

    map.current.on("load", async () => {
      // ================= SOURCES =================

      // Internal Helper to load with IDs for State Features
      const loadSourceWithIds = async (id, url) => {
        try {
          const res = await fetch(url);
          const data = await res.json();
          // Inject numeric IDs
          data.features = data.features.map((f, i) => ({ ...f, id: i }));
          if (map.current) map.current.addSource(id, { type: "geojson", data });
        } catch (e) {
          console.error(`Failed to load ${id}`, e);
        }
      };

      // Load Route Sources with IDs (Async)
      await Promise.all([
        loadSourceWithIds("cmrl_shapes", "/data/cmrl_lines_colored.geojson"),
        loadSourceWithIds("sr_corridors", "/data/sr_corridors.geojson"),
        loadSourceWithIds("mtc_routes", "/data/mtc_routes.geojson")
      ]);

      // Static Sources
      map.current.addSource("cmrl_corridors", { type: "geojson", data: "/data/cmrl_corridors.geojson" });
      map.current.addSource("cmrl_station_boundaries", { type: "geojson", data: "/data/cmrl_station_boundaries.geojson" });
      map.current.addSource("cmrl_network_edges", { type: "geojson", data: "/data/cmrl_network_edges.geojson" });
      map.current.addSource("cmrl_stations", { type: "geojson", data: "/data/cmrl_stations.geojson" });
      map.current.addSource("cmrl_station_entries", { type: "geojson", data: "/data/cmrl_station_entries.geojson" });

      map.current.addSource("mtc_stops", { type: "geojson", data: "/data/mtc_stops.geojson" });
      map.current.addSource("mtc_terminus", { type: "geojson", data: "/data/mtc_terminus.geojson" });

      map.current.addSource("sr_stations", { type: "geojson", data: "/data/sr_stations.geojson" });
      map.current.addSource("sr_rail_entries", { type: "geojson", data: "/data/sr_rail_entries.geojson" });

      // --- SPATIAL ANALYSIS (Turf.js) ---
      try {
        const [cmrlRes, srRes] = await Promise.all([
          fetch("/data/cmrl_stations.geojson"),
          fetch("/data/sr_stations.geojson")
        ]);
        const cmrlData = await cmrlRes.json();
        const srData = await srRes.json();

        // 1. Walk Sheds (Buffer)
        const combinedStations = {
          type: "FeatureCollection",
          features: [...cmrlData.features, ...srData.features]
        };
        const walksheds = turf.buffer(combinedStations, 0.5, { units: 'kilometers' });

        map.current.addSource("analysis_walksheds", { type: "geojson", data: walksheds });

        // 2. Interchanges (Hubs)
        const hubs = [];
        cmrlData.features.forEach(metro => {
          srData.features.forEach(rail => {
            const distance = turf.distance(metro, rail, { units: 'kilometers' });
            if (distance < 0.2) { // 200m matching distance
              // Create a hub point (midpoint)
              const midpoint = turf.midpoint(metro, rail);
              midpoint.properties = {
                name: `${metro.properties.station_na} <-> ${rail.properties.station_na}`,
                type: "Interchange Hub"
              };
              hubs.push(midpoint);
            }
          });
        });
        const hubsGeoJSON = { type: "FeatureCollection", features: hubs };
        map.current.addSource("analysis_hubs", { type: "geojson", data: hubsGeoJSON });

      } catch (err) {
        console.error("Analysis Failed:", err);
      }

      // ================= LAYERS =================

      // --- 1. WalkSheds (Underlay) ---
      map.current.addLayer({
        id: "analysis_walksheds_layer",
        type: "fill",
        source: "analysis_walksheds",
        layout: { visibility: "none" },
        paint: {
          "fill-color": COLORS.walkshed,
          "fill-opacity": 0.15,
          "fill-outline-color": COLORS.walkshed
        }
      });

      // --- MTC Heatmap (Underlay) ---
      map.current.addLayer({
        id: "mtc_heatmap_layer",
        type: "heatmap",
        source: "mtc_stops",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": 1,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(255,255,255,0)",
            0.2, "rgb(254,217,118)",
            0.4, "rgb(254,178,76)",
            0.6, "rgb(253,141,60)",
            0.8, "rgb(240,59,32)",
            1, "rgb(189,0,38)"
          ],
          "heatmap-radius": 15,
          "heatmap-opacity": 0.6
        }
      });

      // --- CMRL Layers ---
      map.current.addLayer({
        id: "cmrl_shapes_layer",
        type: "line",
        source: "cmrl_shapes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            10, // Hover width
            6   // Default width
          ],
          "line-opacity": 1.0,
        },
      });

      map.current.addLayer({
        id: "cmrl_stations_layer",
        type: "circle",
        source: "cmrl_stations",
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#ffffff",
          "circle-stroke-color": COLORS.cmrl,
          "circle-stroke-width": 2.5,
        },
      });

      map.current.addLayer({
        id: "cmrl_boundaries_layer",
        type: "fill",
        source: "cmrl_station_boundaries",
        paint: {
          "fill-color": COLORS.cmrl,
          "fill-opacity": 0.1,
          "fill-outline-color": COLORS.cmrl,
        },
      });

      map.current.addLayer({
        id: "cmrl_entries_layer",
        type: "circle",
        source: "cmrl_station_entries",
        paint: {
          "circle-radius": 2.5,
          "circle-color": "#ffffff",
          "circle-stroke-color": COLORS.cmrl,
          "circle-stroke-width": 1.5,
        },
      });

      // --- MTC Layers ---
      map.current.addLayer({
        id: "mtc_routes_layer",
        type: "line",
        source: "mtc_routes",
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: {
          "line-color": COLORS.mtc,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            5,
            2
          ],
          "line-opacity": 0.8,
        },
      });
      map.current.addLayer({
        id: "mtc_stops_layer",
        type: "circle",
        source: "mtc_stops",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 3,
          "circle-color": "#ffffff",
          "circle-stroke-color": COLORS.mtc,
          "circle-stroke-width": 1.5,
        },
      });
      map.current.addLayer({
        id: "mtc_terminus_layer",
        type: "circle",
        source: "mtc_terminus",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 6,
          "circle-color": COLORS.mtc,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // --- SR Layers ---
      map.current.addLayer({
        id: "sr_corridors_layer",
        type: "line",
        source: "sr_corridors",
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: {
          "line-color": COLORS.sr,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            10,
            5
          ],
          "line-opacity": 1.0,
        },
      });
      map.current.addLayer({
        id: "sr_stations_layer",
        type: "circle",
        source: "sr_stations",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 4,
          "circle-color": "#ffffff",
          "circle-stroke-color": COLORS.sr,
          "circle-stroke-width": 2,
        },
      });
      map.current.addLayer({
        id: "sr_entries_layer",
        type: "circle",
        source: "sr_rail_entries",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 2.5,
          "circle-color": "#ffffff",
          "circle-stroke-color": COLORS.sr,
          "circle-stroke-width": 1.5,
        },
      });

      // --- Analysis Hubs Layer (Overlay) ---
      map.current.addLayer({
        id: "analysis_hubs_layer",
        type: "circle",
        source: "analysis_hubs",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 8,
          "circle-color": COLORS.hub,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2
        }
      });
      map.current.addLayer({
        id: "analysis_hubs_label",
        type: "symbol",
        source: "analysis_hubs",
        layout: {
          "text-field": "🔄",
          "text-size": 14,
          "text-allow-overlap": true,
          "visibility": "none" // toggled with layer
        }
      });


      // ================= INTERACTIONS =================

      const routeLayers = ["cmrl_shapes_layer", "sr_corridors_layer", "mtc_routes_layer"];
      const pointLayers = [
        "cmrl_stations_layer", "cmrl_boundaries_layer", "cmrl_entries_layer",
        "mtc_stops_layer", "mtc_terminus_layer",
        "sr_stations_layer", "sr_entries_layer",
        "analysis_hubs_layer"
      ];

      // 1. Click Listener (Sidebar)
      map.current.on("click", [...pointLayers, ...routeLayers], (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          setSelectedFeature(feature);
          setIsSidebarOpen(true);
        }
      });

      // 2. Hover Listener (Feature State + Popup)
      routeLayers.forEach((layerId) => {
        const sourceId = map.current.getLayer(layerId).source;

        map.current.on("mousemove", layerId, (e) => {
          map.current.getCanvas().style.cursor = "pointer";

          if (e.features.length > 0) {
            if (hoveredStateId !== null) {
              map.current.setFeatureState({ source: sourceId, id: hoveredStateId }, { hover: false });
            }
            hoveredStateId = e.features[0].id;
            map.current.setFeatureState({ source: sourceId, id: hoveredStateId }, { hover: true });

            // Popup Logic
            const props = e.features[0].properties;
            let label = props.route_long_name || props.route_name || "Route";

            // Special case for MTC (Bus): Show "Origin ➝ Destination"
            if (props.source && props.destinatio) {
              label = `${props.source} ➝ ${props.destinatio}`;
            }

            hoverPopup.setLngLat(e.lngLat)
              .setHTML(`<div class="font-bold text-xs text-gray-800 px-2 py-1">${label}</div>`)
              .addTo(map.current);
          }
        });

        map.current.on("mouseleave", layerId, () => {
          map.current.getCanvas().style.cursor = "";
          if (hoveredStateId !== null) {
            map.current.setFeatureState({ source: sourceId, id: hoveredStateId }, { hover: false });
          }
          hoveredStateId = null;
          hoverPopup.remove();
        });
      });

      // Point Layers Hover (Cursor only)
      pointLayers.forEach(layer => {
        map.current.on("mouseenter", layer, () => map.current.getCanvas().style.cursor = "pointer");
        map.current.on("mouseleave", layer, () => map.current.getCanvas().style.cursor = "");
      });

    });
  }, []);

  // Toggle Layers logic
  const toggleLayer = (layerId) => {
    if (!map.current) return;
    if (!map.current.getLayer(layerId)) return;

    // Special case for Hubs (layer + label)
    if (layerId === "analysis_hubs_layer") {
      const visibility = map.current.getLayoutProperty("analysis_hubs_layer", "visibility");
      const nextState = (visibility === "visible") ? "none" : "visible";
      map.current.setLayoutProperty("analysis_hubs_layer", "visibility", nextState);
      if (map.current.getLayer("analysis_hubs_label")) {
        map.current.setLayoutProperty("analysis_hubs_label", "visibility", nextState);
      }
      return;
    }

    const visibility = map.current.getLayoutProperty(layerId, "visibility");
    // If it is explicitly "none", it is hidden. Otherwise (undefined or "visible"), it is visible.
    const isHidden = visibility === "none";
    map.current.setLayoutProperty(layerId, "visibility", isHidden ? "visible" : "none");
  };

  return (
    <div className="flex h-[calc(100vh-112px)] font-sans text-gray-900 bg-gray-50 overflow-hidden my-6 mx-6 rounded-xl border border-gray-200 shadow-sm">
      {/* Sidebar - Docked Panel */}
      <div
        className={`w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out z-10 shrink-0 ${isSidebarOpen ? "ml-0" : "-ml-64"
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
            <i className="fi fi-ss-layers text-blue-700 text-lg"></i>
            Layers
          </h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Layer List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3 space-y-4">

          {/* CMRL Group */}
          <div>
            <div className="px-2 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0054a6]"></span>
              <h3 className="text-xs font-bold text-gray-900">Chennai Metro</h3>
            </div>
            <div className="space-y-0.5 ml-3 border-l border-gray-100 pl-2">
              <LayerToggle label="Routes" layerId="cmrl_shapes_layer" defaultChecked={true} onToggle={toggleLayer} />
              <LayerToggle label="Stations" layerId="cmrl_stations_layer" defaultChecked={true} onToggle={toggleLayer} />
              <LayerToggle label="Boundaries" layerId="cmrl_boundaries_layer" defaultChecked={true} onToggle={toggleLayer} />
              <LayerToggle label="Entrances" layerId="cmrl_entries_layer" defaultChecked={true} onToggle={toggleLayer} />
            </div>
          </div>

          {/* MTC Group */}
          <div>
            <div className="px-2 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#e31837]"></span>
              <h3 className="text-xs font-bold text-gray-900">MTC Bus</h3>
            </div>
            <div className="space-y-0.5 ml-3 border-l border-gray-100 pl-2">
              <LayerToggle label="Routes (Freq)" layerId="mtc_routes_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="Stops" layerId="mtc_stops_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="Terminals" layerId="mtc_terminus_layer" defaultChecked={false} onToggle={toggleLayer} />
            </div>
          </div>

          {/* SR Group */}
          <div>
            <div className="px-2 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#009a44]"></span>
              <h3 className="text-xs font-bold text-gray-900">Suburban Rail</h3>
            </div>
            <div className="space-y-0.5 ml-3 border-l border-gray-100 pl-2">
              <LayerToggle label="Corridors" layerId="sr_corridors_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="Stations" layerId="sr_stations_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="Entrances" layerId="sr_entries_layer" defaultChecked={false} onToggle={toggleLayer} />
            </div>
          </div>

          <div className="h-px bg-gray-100 mx-2"></div>

          {/* Advanced Analytics Group */}
          <div>
            <div className="px-2 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              <h3 className="text-xs font-bold text-gray-900">Analytics</h3>
            </div>
            <div className="space-y-0.5 ml-3 border-l border-gray-100 pl-2">
              <LayerToggle label="Heatmap (Bus Stops)" layerId="mtc_heatmap_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="500m Walk Sheds" layerId="analysis_walksheds_layer" defaultChecked={false} onToggle={toggleLayer} />
              <LayerToggle label="Interchange Hubs" layerId="analysis_hubs_layer" defaultChecked={false} onToggle={toggleLayer} />
            </div>
          </div>

        </div>

        {/* Selected Feature Info (Footer of Sidebar) */}
        {selectedFeature && (
          <div className="p-4 border-t border-gray-200 bg-blue-50">
            <h4 className="text-xs font-bold uppercase text-blue-800 mb-2">Selected Feature</h4>
            <div className="text-xs text-gray-700 space-y-1 overflow-x-auto">
              {/* Intelligent Property Display */}
              {selectedFeature.properties.station_na && (
                <div className="font-bold text-sm">{selectedFeature.properties.station_na}</div>
              )}
              {selectedFeature.properties.route_long_name && (
                <div className="font-bold text-sm">{selectedFeature.properties.route_long_name}</div>
              )}
              {/* Fallback Dump */}
              <pre className="text-[10px] bg-white p-2 rounded border border-gray-200 mt-2">
                {JSON.stringify(selectedFeature.properties, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full">
        {/* Toggle Button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute z-10 top-4 left-4 bg-white shadow-md hover:shadow-xl text-gray-700 p-2 rounded border border-gray-200 transition-all"
            aria-label="Open sidebar"
          >
            <i className="fi fi-ss-layers text-xl"></i>
          </button>
        )}
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
};

export default Maps;
