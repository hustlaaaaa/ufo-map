import React, { useEffect, useRef, useState } from "react";
import { PanelRight, MapPin } from "lucide-react";

// --- Add this block at the top for TS compatibility ---
declare global {
  interface Window {
    L: any;
    rembeddit?: {
      init: () => void;
    };
  }
}
// ------------------------------------------------------

type MarkerData = {
  id?: number;
  lat: number;
  lon: number;
  title?: string;
  description?: string;
  url: string;
};

type ClusterData = {
  clusterId: string;
  markers: MarkerData[];
  lat: number;
  lon: number;
};

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });

const loadCss = (href: string) => {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

const MAPBOX_DARK_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const CLUSTER_SOCKET_ICON = `<div style="width:{width}px;height:{height}px;display:flex;align-items:center;justify-content:center;">
  <div style="width:100%;height:100%;border-radius:50%;background:#6935e7;opacity:0.85;display:flex;align-items:center;justify-content:center;">
    <div style="width:{innerWidth}px;height:{innerWidth}px;border-radius:50%;background:#181B24;opacity:0.94;display:flex;align-items:center;justify-content:center;">
      <div style="color:white;font-family:Arial;font-size:{fontSize}px;font-weight:bold;position:relative;top:1px;">{count}</div>
    </div>
  </div>
</div>`;

const MARKERS_PER_PAGE = 25;

export default function MapView() {
  const mapRef = useRef<any>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null);
  const [visibleMarkers, setVisibleMarkers] = useState<MarkerData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load marker data from JSON
  useEffect(() => {
    fetch("/data/markers1.json")
      .then(r => r.json())
      .then(setMarkers);
  }, []);

  // Reset pagination when selected cluster changes
  useEffect(() => {
    if (selectedCluster) {
      setPage(1);
      const initialMarkers = selectedCluster.markers.slice(0, MARKERS_PER_PAGE);
      setVisibleMarkers(initialMarkers);
      setHasMore(selectedCluster.markers.length > MARKERS_PER_PAGE);
    } else {
      setVisibleMarkers([]);
      setHasMore(false);
    }
  }, [selectedCluster]);

  // Load more markers when page changes
  useEffect(() => {
    if (selectedCluster && page > 1) {
      setLoadingMore(true);
      // Simulate loading delay to prevent UI jank
      setTimeout(() => {
        const endIndex = page * MARKERS_PER_PAGE;
        const newVisibleMarkers = selectedCluster.markers.slice(0, endIndex);
        setVisibleMarkers(newVisibleMarkers);
        setHasMore(endIndex < selectedCluster.markers.length);
        setLoadingMore(false);
      }, 300);
    }
  }, [page, selectedCluster]);

  // Handle scroll event to detect when user reaches bottom
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      // Load more when user is within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setPage(prevPage => prevPage + 1);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore]);

  // Add Reddit widget script
  useEffect(() => {
    // Load script only once when component mounts
    // but re-run when visible markers change to reinitialize
    const existingScript = document.getElementById('reddit-widget-script');
    if (existingScript) {
      existingScript.remove();
    }
    
    if (visibleMarkers.length > 0) {
      const script = document.createElement('script');
      script.id = 'reddit-widget-script';
      script.src = 'https://embed.reddit.com/widgets.js';
      script.async = true;
      script.charset = 'UTF-8';
      document.body.appendChild(script);
    }
    
    return () => {
      // Cleanup on unmount
      const scriptToRemove = document.getElementById('reddit-widget-script');
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, [visibleMarkers]); // Re-run when visible markers change

  // Dynamically load Leaflet and markercluster libraries + CSS
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Load CSS first
      loadCss("https://unpkg.com/leaflet/dist/leaflet.css");
      loadCss("https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css");
      
      try {
        // Make sure Leaflet loads first
        await loadScript("https://unpkg.com/leaflet/dist/leaflet.js");
        console.log("Leaflet loaded successfully");
        
        // Then load MarkerCluster after Leaflet is confirmed to be loaded
        await loadScript("https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js");
        console.log("MarkerCluster loaded successfully");

        // Give a small delay to ensure scripts are fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        // Debug logging to verify library load status
        if (window.L) {
          if (typeof window.L.markerClusterGroup === "function") {
            console.log("Leaflet and MarkerCluster loaded successfully.");
          } else {
            console.warn("MarkerCluster plugin missing! typeof window.L.markerClusterGroup:", 
              typeof window.L.markerClusterGroup);
            // Try to reload MarkerCluster if it's missing
            await loadScript("https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js");
            console.log("Attempted to reload MarkerCluster. Status:", 
              typeof window.L.markerClusterGroup === "function" ? "Success" : "Failed");
          }
        } else {
          console.error("Leaflet (window.L) failed to load!");
        }

        if (window.L && typeof window.L.markerClusterGroup === "function" && markers.length > 0) {
          mountMap();
        } else {
          console.error("Cannot mount map: Libraries not loaded properly");
        }
      } catch (error) {
        console.error("Error loading map libraries:", error);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [markers]);

  // Helper: creates custom HTML cluster icon
  function makeClusterIcon(count:number) {
    // Use a more conservative scaling approach
    const baseSize = 32;
    const maxSize = 48; // Reduced maximum size
    const minCount = 2;
    const maxCount = 100;
    
    // More subtle scaling formula with smaller growth rate
    const size = baseSize + Math.min(
      Math.sqrt(count - minCount) / Math.sqrt(maxCount - minCount) * (maxSize - baseSize),
      maxSize - baseSize
    );
    
    const width = Math.max(Math.round(size), baseSize);
    const height = width;
    const innerWidth = Math.round(width * 0.8); // Increased inner circle size for thinner border
    const fontSize = Math.max(11, Math.min(14, Math.round(width * 0.35))); // Limit font size range
    
    const html = CLUSTER_SOCKET_ICON
      .replace(/{width}/g, String(width))
      .replace(/{height}/g, String(height))
      .replace(/{innerWidth}/g, String(innerWidth))
      .replace(/{fontSize}/g, String(fontSize))
      .replace(/{count}/g, String(count));
    
    return window.L.divIcon({
      html: html,
      className: "",
      iconSize: [width, width],
      iconAnchor: [width/2, width/2]
    });
  }

  // Renders the map and adds clusters
  function mountMap() {
    if (!window.L || typeof window.L.markerClusterGroup !== "function") {
      console.error("Cannot mount map: Leaflet or MarkerCluster plugin missing");
      return;
    }

    mapRef.current = window.L.map("leaflet-map", {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxBounds: [
        [-90, -180],
        [90, 180]
      ],
      zoomControl: true,
      attributionControl: false
    });

    // Add dark tile layer
    window.L.tileLayer(MAPBOX_DARK_URL, {
      attribution: "",
      detectRetina: true
    }).addTo(mapRef.current);

    // Instantiate markercluster group
    const markersLayer = window.L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => makeClusterIcon(cluster.getChildCount())
    });

    // Attach individual markers
    markers.forEach((m) => {
      if(!m.lat || !m.lon) return;
      const el = window.L.divIcon({
        html: `<div style="background:#8ed6fb4f;border-radius:50%;padding:7px 7px;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 21s-6-5.686-6-10A6 6 0 0 1 18 11c0 4.314-6 10-6 10Z" stroke="#8ed6fb" stroke-width="2" fill="#8ed6fb"/></svg>
        </div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });
      const marker = window.L.marker([m.lat, m.lon], { icon: el });
      marker.options.markerData = m;
      marker.on("click", () => {
        setSelectedCluster({
          clusterId: String(m.id),
          lat: m.lat,
          lon: m.lon,
          markers: [m]
        });
        setShowPanel(true);
      });
      markersLayer.addLayer(marker);
    });

    // Listen for cluster clicks
    markersLayer.on("clusterclick", function (e: any) {
      const children = e.layer.getAllChildMarkers();
      const contained: MarkerData[] = [];
      let avgLat = 0, avgLng = 0;
      children.forEach((marker: any) => {
        contained.push(marker.options.markerData);
        avgLat += marker.options.markerData.lat;
        avgLng += marker.options.markerData.lon;
      });
      avgLat /= children.length;
      avgLng /= children.length;
      setSelectedCluster({
        clusterId: String(e.layer._leaflet_id),
        markers: contained,
        lat: avgLat,
        lon: avgLng
      });
      setShowPanel(true);
      // Prevent zoom on cluster click
      e.originalEvent.preventDefault();
      e.propagationStopped = true;
    });

    markersLayer.addTo(mapRef.current);

    setTimeout(() => {
      mapRef.current.invalidateSize(true);
    }, 400);

    // Sometimes needed to focus map after mount
    window.addEventListener('resize', () => {
      mapRef.current.invalidateSize(true);
    });
  }

  // Panel close handler
  const closePanel = () => {
    setShowPanel(false);
    setTimeout(() => {
      setSelectedCluster(null);
      setVisibleMarkers([]);
      setPage(1);
    }, 300);
  };

  // Click outside to close
  useEffect(() => {
    if (!showPanel || !panelRef.current) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line
  }, [showPanel]);

  return (
    <div className="w-full h-full relative bg-background overflow-hidden">
      {/* Fullscreen Map */}
      <div id="leaflet-map" className="absolute inset-0 z-0" style={{ minHeight: "100svh" }} />
      {/* Loading spinner overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {/* Floating Glass Panel */}
      {selectedCluster && (
        <div
          ref={panelRef}
          className={`fixed top-0 right-0 h-full max-w-md w-[570px] bg-panelglass glass-panel z-40 shadow-glass transition-all ease-in-out duration-300 
            ${showPanel ? "translate-x-0 animate-slide-in-right" : "translate-x-full opacity-0"}
          `}
          style={{
            backdropFilter: "blur(28px)",
            background: "rgba(32,35,49,0.93)"
          }}
        >
          <div className="flex items-center justify-between px-6 pt-7 pb-2 border-b border-white/10">
            <div className="flex gap-2 items-center">
              <PanelRight className="text-accent" size={26} />
              <span className="text-lg font-semibold text-gray-100">Sightings</span>
              <span className="ml-2 text-xs text-gray-400 bg-black/30 rounded px-2 py-0.5">
                {selectedCluster.markers.length} {selectedCluster.markers.length === 1 ? "Result" : "Results"}
              </span>
            </div>
            <button
              className="transition hover:text-red-400 text-gray-300 rounded-full px-1 py-1 ml-1"
              aria-label="Close"
              onClick={closePanel}
            >
              &#10005;
            </button>
          </div>
          <div 
            ref={scrollContainerRef}
            className="overflow-y-auto max-h-[calc(100vh-60px)] px-4 py-5 space-y-3"
          >
            {visibleMarkers.map((marker, index) => (
              <div 
                key={marker.id ? `marker-${marker.id}` : `marker-${marker.url}-${index}`}
                className="glass-panel bg-white/2 card-glow border border-gray-700/50 rounded-lg flex flex-col gap-3 shadow-lg transition">
                <div className="w-full">
                  <blockquote data-embed-theme="dark" className="reddit-embed-bq" style={{height: "240px"}} data-embed-height="240">
                    <a href={"https://www.reddit.com" + marker.url}></a>
                  </blockquote>
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {!loadingMore && !hasMore && visibleMarkers.length > 0 && (
              <div className="text-center text-gray-400 text-sm py-3">
                No more results to load
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
