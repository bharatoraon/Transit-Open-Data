import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, X, BarChart3, Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const Maps = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [selectedOrigin, setSelectedOrigin] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState({
    cmrl_lines_layer: true,
    cmrl_stations_layer: true,
    cmrl_stations_labels: true,
    mtc_lines_layer: false,
    mtc_stops_layer: false,
    mtc_terminals_layer: false,
    mtc_stops_labels: false,
    suburban_lines_layer: true,
    suburban_stops_layer: true,
    suburban_stops_labels: false,
    mtc_stops_labels: false,
  });

  // Load network statistics
  useEffect(() => {
    fetch("/data/network_statistics.json")
      .then(res => res.json())
      .then(data => setNetworkStats(data))
      .catch(err => console.error("Error loading statistics:", err));
  }, []);



  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [80.2707, 13.0827],
      zoom: 15, // Higher zoom to see buildings
      pitch: 45, // Tilt for 3D
      bearing: -17.6,
      antialias: true, // Smooth edges for 3D
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        visualizePitch: true
      }),
      "top-right"
    );

    map.current.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
      }),
      "bottom-left"
    );

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "route-popup"
    });

    map.current.on("load", async () => {
      setIsMapLoaded(true);
      // Add 3D building layer from the basemap
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout["text-field"]
      )?.id;

      map.current.addLayer(
        {
          id: "3d-buildings",
          source: "carto", // Correct source for Positron style
          "source-layer": "building", // Check if this is the correct layer name for Carto
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#e0e0e0",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 0,
              14.05, ["get", "render_height"]
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 0,
              14.05, ["get", "render_min_height"]
            ],
            "fill-extrusion-opacity": 1.0
          }
        },
        labelLayerId
      );

      try {
        map.current.addSource("cmrl_lines", {
          type: "geojson",
          data: "http://localhost:3000/api/routes?system=CMRL"
        });

        map.current.addSource("cmrl_stations", {
          type: "geojson",
          data: "http://localhost:3000/api/stations?system=CMRL"
        });

        // Add MTC Bus data sources
        map.current.addSource("mtc_lines", {
          type: "geojson",
          data: "/data/mtc_routes.geojson"
        });

        map.current.addSource("mtc_stops", {
          type: "geojson",
          data: "http://localhost:3000/api/stations?system=MTC"
        });

        map.current.addSource("mtc_terminals", {
          type: "geojson",
          data: "/data/mtc_terminus.geojson"
        });



        // Suburban Rail Lines Source
        if (!map.current.getSource("suburban_lines")) {
          map.current.addSource("suburban_lines", {
            type: "geojson",
            data: "/data/suburban_lines.geojson",
          });
        }

        // Suburban Rail Stops Source
        if (!map.current.getSource("suburban_stops")) {
          map.current.addSource("suburban_stops", {
            type: "geojson",
            data: "/data/suburban_stops.geojson",
          });
        }

        // --- SUBURBAN RAIL LAYERS ---

        // Lines - Casing (Black track)
        if (!map.current.getLayer("suburban_lines_casing")) {
          map.current.addLayer(
            {
              id: "suburban_lines_casing",
              type: "line",
              source: "suburban_lines",
              layout: {
                "line-join": "round",
                "line-cap": "round",
                visibility: layerVisibility.suburban_lines_layer ? "visible" : "none",
              },
              paint: {
                "line-color": "#000000",
                "line-width": 4,
              },
            },
            labelLayerId
          );
        }

        // Lines - Inner (Dashed)
        if (!map.current.getLayer("suburban_lines_inner")) {
          map.current.addLayer(
            {
              id: "suburban_lines_inner",
              type: "line",
              source: "suburban_lines",
              layout: {
                "line-join": "round",
                "line-cap": "round",
                visibility: layerVisibility.suburban_lines_layer ? "visible" : "none",
              },
              paint: {
                "line-color": "#ffffff", // White dashes
                "line-width": 2,
                "line-dasharray": [2, 2],
              },
            },
            labelLayerId
          );
        }

        // Stops
        if (!map.current.getLayer("suburban_stops_layer")) {
          map.current.addLayer(
            {
              id: "suburban_stops_layer",
              type: "circle",
              source: "suburban_stops",
              layout: {
                visibility: layerVisibility.suburban_stops_layer ? "visible" : "none",
              },
              paint: {
                "circle-color": "#ffffff",
                "circle-radius": 4,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#009933",
              },
            },
            labelLayerId
          );
        }

        // Stop Labels
        if (!map.current.getLayer("suburban_stops_labels")) {
          map.current.addLayer({
            id: "suburban_stops_labels",
            type: "symbol",
            source: "suburban_stops",
            layout: {
              "text-field": ["get", "STATION NA"],
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              "text-radial-offset": 0.5,
              "text-justify": "auto",
              "text-size": 10,
              visibility: layerVisibility.suburban_stops_labels ? "visible" : "none",
            },
            paint: {
              "text-color": "#006622",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1,
            },
          });
        }

        // 1. MTC Bus Layers (Bottom)
        map.current.addLayer({
          id: "mtc_lines_layer",
          type: "line",
          source: "mtc_lines",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            "visibility": layerVisibility.mtc_lines_layer ? "visible" : "none"
          },
          paint: {
            "line-color": "#FFA726",  // Lighter orange color for buses
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 1,
              14, 2,
              18, 4
            ],
            "line-opacity": 0.4  // Lower opacity for lighter appearance
          }
        });

        map.current.addLayer({
          id: "mtc_stops_layer",
          type: "circle",
          source: "mtc_stops",
          layout: {
            "visibility": layerVisibility.mtc_stops_layer ? "visible" : "none"
          },
          paint: {
            "circle-radius": 2, // Smaller for regular stops
            "circle-color": "#FFA726",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.7
          },
          minzoom: 12
        });

        map.current.addLayer({
          id: "mtc_terminals_layer",
          type: "circle",
          source: "mtc_terminals",
          layout: {
            "visibility": layerVisibility.mtc_terminals_layer ? "visible" : "none"
          },
          paint: {
            "circle-radius": 5, // Larger for terminals
            "circle-color": "#ffffff",
            "circle-stroke-color": "#E65100", // Darker orange for terminals
            "circle-stroke-width": 2,
            "circle-opacity": 1
          }
        });

        map.current.addLayer({
          id: "mtc_stops_labels",
          type: "symbol",
          source: "mtc_terminals", // Labels primarily for terminals
          layout: {
            "text-field": ["get", "Name of th"],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 9,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-max-width": 10,
            "visibility": layerVisibility.mtc_stops_labels ? "visible" : "none"
          },
          paint: {
            "text-color": "#E65100",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
            "text-halo-blur": 0.5,
            "text-opacity": 0.9
          }
        });

        // 2. Chennai Metro Layers (Top)
        map.current.addLayer({
          id: "cmrl_lines_layer",
          type: "line",
          source: "cmrl_lines",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            "visibility": layerVisibility.cmrl_lines_layer ? "visible" : "none"
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 3,
              14, 8,
              18, 12
            ],
            "line-opacity": 0.9
          }
        });

        map.current.addLayer({
          id: "cmrl_stations_layer",
          type: "circle",
          source: "cmrl_stations",
          layout: {
            "visibility": layerVisibility.cmrl_stations_layer ? "visible" : "none"
          },
          paint: {
            "circle-radius": [
              "match",
              ["get", "station_name"],
              ["PURATCHI THALAIVAR DR.M.G.RAMACHANDRAN CENTRAL METRO", "ARIGNAR ANNA ALANDUR"],
              9,  // Larger size for interchange stations
              6   // Normal size for other stations
            ],
            "circle-color": "#ffffff",
            "circle-stroke-color": [
              "match",
              ["get", "station_name"],
              ["PURATCHI THALAIVAR DR.M.G.RAMACHANDRAN CENTRAL METRO", "ARIGNAR ANNA ALANDUR"],
              "#FF6B35",  // Orange color for interchange stations
              "#0054a6"   // Blue for normal stations
            ],
            "circle-stroke-width": [
              "match",
              ["get", "station_name"],
              ["PURATCHI THALAIVAR DR.M.G.RAMACHANDRAN CENTRAL METRO", "ARIGNAR ANNA ALANDUR"],
              4,  // Thicker stroke for interchange stations
              3   // Normal stroke for other stations
            ]
          }
        });

        map.current.addLayer({
          id: "cmrl_stations_labels",
          type: "symbol",
          source: "cmrl_stations",
          layout: {
            "text-field": ["get", "station_name"],
            "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
            "text-size": 11,
            "text-offset": [0, 1.5],
            "text-anchor": "top",
            "text-max-width": 10,
            "visibility": layerVisibility.cmrl_stations_labels ? "visible" : "none"
          },
          paint: {
            "text-color": "#1a1a1a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
            "text-halo-blur": 0.5
          }
        });



        const stationPopup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: "station-popup",
          maxWidth: "300px"
        });

        map.current.on("click", "cmrl_stations_layer", (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const { station_name, zone_id, system } = feature.properties;

          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div class="min-w-[150px] font-sans pl-3 pr-2 py-2">
              <div class="flex flex-col gap-0.5 mb-3">
                <span class="text-[9px] font-extrabold text-[#0038A8] uppercase tracking-widest opacity-90">
                  ${system || 'CMRL'}
                </span>
                <h3 class="text-sm font-black text-zinc-900 uppercase leading-tight tracking-wide">
                  ${station_name}
                </h3>
              </div>
              
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-2.5">
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Zone</div>
                    <div class="text-xs font-bold text-zinc-700 font-mono">${zone_id || 'N/A'}</div>
                 </div>
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Type</div>
                    <div class="text-xs font-bold text-zinc-700">Station</div>
                 </div>
              </div>
            </div>
          `;

          stationPopup
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);

          // Close other panels if open
          // setShowStats(false); // Assuming these states exist elsewhere if needed
          // setShowTravelTime(false);
        });

        map.current.on("click", "suburban_stops_layer", (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const { "STATION NA": stationName, "PT TYPE": type } = feature.properties;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div class="min-w-[150px] font-sans pl-3 pr-2 py-2">
              <div class="flex flex-col gap-0.5 mb-3">
                <span class="text-[9px] font-extrabold text-[#009933] uppercase tracking-widest opacity-90">
                  SUBURBAN RAIL
                </span>
                <h3 class="text-sm font-black text-zinc-900 uppercase leading-tight tracking-wide">
                  ${stationName}
                </h3>
              </div>
              
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-2.5">
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Type</div>
                    <div class="text-xs font-bold text-zinc-700 font-mono">${type || 'Station'}</div>
                 </div>
              </div>
            </div>
          `;

          stationPopup
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        map.current.on("mouseenter", "suburban_stops_layer", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "suburban_stops_layer", () => {
          map.current.getCanvas().style.cursor = "";
        });

        map.current.on("click", "mtc_terminals_layer", (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const { "Name of th": stopName, Ownership } = feature.properties;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div class="min-w-[150px] font-sans pl-3 pr-2 py-2">
              <div class="flex flex-col gap-0.5 mb-3">
                <span class="text-[9px] font-extrabold text-[#E65100] uppercase tracking-widest opacity-90">
                  MTC BUS TERMINUS
                </span>
                <h3 class="text-sm font-black text-zinc-900 uppercase leading-tight tracking-wide">
                  ${stopName}
                </h3>
              </div>
              
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-2.5">
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Ownership</div>
                    <div class="text-xs font-bold text-zinc-700 font-mono">${Ownership || 'MTC'}</div>
                 </div>
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Type</div>
                    <div class="text-xs font-bold text-zinc-700">Terminus</div>
                 </div>
              </div>
            </div>
          `;

          stationPopup
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        map.current.on("click", "mtc_stops_layer", (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const { station_name, system } = feature.properties;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const popupContent = `
            <div class="min-w-[150px] font-sans pl-3 pr-2 py-2">
              <div class="flex flex-col gap-0.5 mb-3">
                <span class="text-[9px] font-extrabold text-[#FFA726] uppercase tracking-widest opacity-90">
                  ${system || 'MTC BUS'}
                </span>
                <h3 class="text-sm font-black text-zinc-900 uppercase leading-tight tracking-wide">
                  ${station_name}
                </h3>
              </div>
              
              <div class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-100 pt-2.5">
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Source</div>
                    <div class="text-xs font-bold text-zinc-700">GTFS API</div>
                 </div>
                 <div>
                    <div class="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Type</div>
                    <div class="text-xs font-bold text-zinc-700">Bus Stop</div>
                 </div>
              </div>
            </div>
          `;

          stationPopup
            .setLngLat(coordinates)
            .setHTML(popupContent)
            .addTo(map.current);
        });

        map.current.on("mouseenter", "mtc_terminals_layer", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "mtc_terminals_layer", () => {
          map.current.getCanvas().style.cursor = "";
        });

        map.current.on("mouseenter", "mtc_stops_layer", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "mtc_stops_layer", () => {
          map.current.getCanvas().style.cursor = "";
        });

        map.current.on("mouseenter", "mtc_lines_layer", (e) => {
          map.current.getCanvas().style.cursor = "pointer";
          const feature = e.features[0];
          hoverPopup
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${feature.properties.route_name || 'MTC Route'}</strong><br/><small>${feature.properties.source} → ${feature.properties.destinatio}</small>`)
            .addTo(map.current);
        });

        map.current.on("mouseleave", "mtc_lines_layer", () => {
          map.current.getCanvas().style.cursor = "";
          hoverPopup.remove();
        });

        map.current.on("mouseenter", "cmrl_lines_layer", (e) => {
          map.current.getCanvas().style.cursor = "pointer";
          const feature = e.features[0];
          hoverPopup
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${feature.properties.line_name}</strong>`)
            .addTo(map.current);
        });

        map.current.on("mouseleave", "cmrl_lines_layer", () => {
          map.current.getCanvas().style.cursor = "";
          hoverPopup.remove();
        });

        map.current.on("mouseenter", "cmrl_stations_layer", () => {
          map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "cmrl_stations_layer", () => {
          map.current.getCanvas().style.cursor = "";
        });

      } catch (error) {
        console.error("Error loading map data:", error);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const toggleLayer = (layerId) => {
    if (!map.current) return;

    // Update State
    setLayerVisibility(prev => {
      const newState = { ...prev, [layerId]: !prev[layerId] };

      // Update Map
      const visibility = newState[layerId] ? "visible" : "none";

      // Check if layer exists before setting property to avoid errors
      if (layerId === "suburban_lines_layer") {
        if (map.current.getLayer("suburban_lines_casing")) map.current.setLayoutProperty("suburban_lines_casing", "visibility", visibility);
        if (map.current.getLayer("suburban_lines_inner")) map.current.setLayoutProperty("suburban_lines_inner", "visibility", visibility);
      } else if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, "visibility", visibility);
      }

      return newState;
    });
  };

  const calculateTravelTime = () => {
    if (!networkStats || !selectedOrigin || !selectedDestination) return null;

    // Find travel time from complete matrix
    const travelTime = networkStats.all_travel_times?.find(
      tt => tt.origin === selectedOrigin && tt.destination === selectedDestination
    );

    return travelTime;
  };

  const travelTime = calculateTravelTime();

  return (
    <div className="flex flex-col w-full bg-white h-[calc(100vh-64px)]">
      <div className="flex-grow flex w-full border-t border-b border-zinc-100 my-[2px] overflow-hidden relative">
        {/* Left Sidebar - Layers */}
        <div
          className={`
            bg-white border-r border-zinc-200 flex-shrink-0 flex flex-col h-full overflow-y-auto z-20 shadow-sm transition-all duration-300 ease-in-out
            ${isLayersOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden border-r-0"}
          `}
        >
          <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0038A8]" />
              <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-widest leading-none">Layers</h2>
            </div>
            <button
              onClick={() => setIsLayersOpen(false)}
              className="p-1 hover:bg-zinc-100 rounded-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#0038A8]"></div>
                <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-widest">Chennai Metro</h3>
              </div>
              <div className="ml-4 space-y-3">
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#0038A8] font-medium transition-colors">Metro Lines</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.cmrl_lines_layer}
                      onChange={() => toggleLayer("cmrl_lines_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0038A8]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#0038A8] font-medium transition-colors">Stations</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.cmrl_stations_layer}
                      onChange={() => toggleLayer("cmrl_stations_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0038A8]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#0038A8] font-medium transition-colors">Labels</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.cmrl_stations_labels}
                      onChange={() => toggleLayer("cmrl_stations_labels")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0038A8]"></div>
                  </div>
                </label>

              </div>
            </div>



            {/* MTC Bus Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#FFA726]"></div>
                <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-widest">MTC Bus</h3>
              </div>
              <div className="ml-4 space-y-3">
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#FFA726] font-medium transition-colors">Bus Routes</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.mtc_lines_layer}
                      onChange={() => toggleLayer("mtc_lines_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFA726]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#FFA726] font-medium transition-colors">Bus Terminals</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.mtc_terminals_layer}
                      onChange={() => toggleLayer("mtc_terminals_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFA726]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#FFA726] font-medium transition-colors">Bus Stops</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.mtc_stops_layer}
                      onChange={() => toggleLayer("mtc_stops_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFA726]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#FFA726] font-medium transition-colors">Labels</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.mtc_stops_labels}
                      onChange={() => toggleLayer("mtc_stops_labels")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFA726]"></div>
                  </div>
                </label>
              </div>
            </div>
            {/* Suburban Rail Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#009933]"></div>
                <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-widest">Suburban Rail</h3>
              </div>
              <div className="ml-4 space-y-3">
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#009933] font-medium transition-colors">Rail Lines</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.suburban_lines_layer}
                      onChange={() => toggleLayer("suburban_lines_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009933]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#009933] font-medium transition-colors">Stations</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.suburban_stops_layer}
                      onChange={() => toggleLayer("suburban_stops_layer")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009933]"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between text-sm text-zinc-600 cursor-pointer hover:bg-zinc-50 p-2 -ml-2 rounded transition-colors group">
                  <span className="group-hover:text-[#009933] font-medium transition-colors">Labels</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layerVisibility.suburban_stops_labels}
                      onChange={() => toggleLayer("suburban_stops_labels")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009933]"></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Map */}
        <div className="flex-1 relative h-full bg-zinc-100">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Layer Toggle Button (Visible when sidebar is closed) */}
          {!isLayersOpen && (
            <button
              onClick={() => setIsLayersOpen(true)}
              className="absolute top-4 left-4 z-10 bg-white p-2 rounded-md shadow-md hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-[#0038A8] transition-colors"
              title="Show Layers"
            >
              <Layers className="w-5 h-5" />
            </button>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-zinc-200 z-10 max-w-[200px]">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Legend</h4>
            <div className="space-y-2.5">

              {/* Metro */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#0057B8] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Metro Blue Line</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#00A550] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Metro Green Line</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-[3px] border-[#0054a6] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Metro Station</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-[3px] border-[#FF6B35] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Interchange</span>
                </div>

              </div>

              <div className="h-px bg-zinc-200 my-2"></div>

              {/* Suburban Rail */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-2 bg-black relative overflow-hidden rounded-full">
                    <div className="absolute inset-y-0 inset-x-0 border-t-2 border-b-2 border-dashed border-white top-[2px]"></div>
                  </div>
                  <span className="text-xs font-medium text-zinc-700">Suburban Railway</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 border-[#009933] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Suburban Station</span>
                </div>
              </div>

              <div className="h-px bg-zinc-200 my-2"></div>

              {/* MTC */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#FFA726] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Bus Route</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 border-[#FFA726] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Bus Terminal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#FFA726] rounded-full"></div>
                  <span className="text-xs font-medium text-zinc-700">Bus Stop</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Sidebar - Travel Time Calculator */}
        {networkStats && (
          <div className="w-80 bg-white border-l border-zinc-200 flex-shrink-0 flex flex-col h-full overflow-y-auto z-20 shadow-sm">
            <div className="p-5 border-b border-zinc-200 bg-white">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0038A8]" />
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest leading-none">Travel Time</h3>
              </div>
            </div>

            <div className="p-5 space-y-8">
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Origin</label>
                  <div className="relative">
                    <select
                      value={selectedOrigin}
                      onChange={(e) => setSelectedOrigin(e.target.value)}
                      className="w-full text-sm font-medium text-zinc-800 border-zinc-200 rounded-sm shadow-sm focus:border-[#0038A8] focus:ring-[#0038A8] py-2.5 pl-3 pr-8 bg-zinc-50/50"
                    >
                      <option value="">Select Station</option>
                      {networkStats.all_travel_times && Array.from(new Set(networkStats.all_travel_times.map(tt => tt.origin))).sort().map(station => (
                        <option key={station} value={station}>{station}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Destination</label>
                  <div className="relative">
                    <select
                      value={selectedDestination}
                      onChange={(e) => setSelectedDestination(e.target.value)}
                      className="w-full text-sm font-medium text-zinc-800 border-zinc-200 rounded-sm shadow-sm focus:border-[#0038A8] focus:ring-[#0038A8] py-2.5 pl-3 pr-8 bg-zinc-50/50"
                    >
                      <option value="">Select Station</option>
                      {networkStats.all_travel_times && selectedOrigin &&
                        Array.from(new Set(
                          networkStats.all_travel_times
                            .filter(tt => tt.origin === selectedOrigin)
                            .map(tt => tt.destination)
                        )).sort().map(station => (
                          <option key={station} value={station}>{station}</option>
                        ))
                      }
                      {networkStats.all_travel_times && !selectedOrigin &&
                        Array.from(new Set(networkStats.all_travel_times.map(tt => tt.destination))).sort().map(station => (
                          <option key={station} value={station}>{station}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>

              {travelTime ? (
                <div className="bg-[#0038A8]/5 p-6 rounded-sm border border-[#0038A8]/10">
                  <div className="text-center mb-4">
                    <span className="text-[10px] font-bold text-[#0038A8] uppercase tracking-widest">Estimated Duration</span>
                    <div className="flex items-baseline justify-center gap-1 mt-2">
                      <span className="text-5xl font-bold font-mono text-[#0038A8]">{travelTime.travel_time_minutes}</span>
                      <span className="text-sm font-bold text-[#0038A8] uppercase tracking-wider">min</span>
                    </div>
                    <p className="text-xs text-[#0038A8]/80 mt-2 font-mono font-medium">{travelTime.num_stops} STOPS</p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-[#0038A8] px-3 py-3 bg-white rounded-sm border border-[#0038A8]/10 shadow-sm">
                    <strong className="truncate max-w-[45%] tracking-tight">{travelTime.origin}</strong>
                    <ArrowRight className="w-3 h-3 text-[#0038A8]/40" />
                    <strong className="truncate max-w-[45%] tracking-tight text-right">{travelTime.destination}</strong>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 rounded-sm p-8 text-center border border-zinc-100 border-dashed">
                  <Clock className="w-6 h-6 text-zinc-300 mx-auto mb-3" />
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Select stations to view time</p>
                </div>
              )}


            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Maps;
