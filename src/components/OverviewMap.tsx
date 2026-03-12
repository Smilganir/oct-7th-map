"use client";

import { useState, useRef, useEffect } from "react";
import type { OverviewLocation } from "@/types/data";

export type SelectableLocation = {
  name: string;
  longitude: number;
  latitude: number;
};

type OverviewMapProps = {
  locations: OverviewLocation[];
  onSelectLocation: (loc: SelectableLocation) => void;
};

const MIN_RADIUS = 8;
const MAX_RADIUS = 32;
const DEFAULT_MAP_CENTER = { lat: 31.4, lon: 34.5 };

/** Hardcoded bounds for the background image: left/right = lon, bottom/top = lat. */
const IMAGE_LEFT = 34.2;
const IMAGE_RIGHT = 34.9;
const IMAGE_BOTTOM = 31.15;
const IMAGE_TOP = 31.75;

/** Convert Visual_Lon (X) and Visual_Lat (Y) to overlay (x%, y%). Image: left 34.2, right 34.9, bottom 31.15, top 31.75. */
function visualToOverlayPercent(visualLonX: number, visualLatY: number): { x: number; y: number } {
  const x = ((visualLonX - IMAGE_LEFT) / (IMAGE_RIGHT - IMAGE_LEFT)) * 100;
  const y = ((IMAGE_TOP - visualLatY) / (IMAGE_TOP - IMAGE_BOTTOM)) * 100;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}

function getRadius(dotSize: number, minCount: number, maxCount: number): number {
  if (maxCount <= minCount) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (dotSize - minCount) / (maxCount - minCount);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

function DotShape({
  shapeDisplay,
  size,
  className,
}: {
  shapeDisplay: string;
  size: number;
  className?: string;
}) {
  const s = size * 2;
  const common =
    "cursor-pointer transition-transform hover:scale-110 bg-red-600/90 ring-2 ring-white shadow-md " +
    (className ?? "");
  switch (shapeDisplay.toLowerCase()) {
    case "square":
      return (
        <div
          className={common}
          style={{ width: s, height: s, borderRadius: 2, marginLeft: -s / 2, marginTop: -s / 2 }}
        />
      );
    case "triangle":
      return (
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          style={{
            width: 0,
            height: 0,
            borderLeft: `${s / 2}px solid transparent`,
            borderRight: `${s / 2}px solid transparent`,
            borderBottom: `${s}px solid rgba(220, 38, 38, 0.9)`,
            marginLeft: -s / 2,
            marginTop: -s / 2,
          }}
        />
      );
    case "diamond":
      return (
        <div
          className={common}
          style={{
            width: s,
            height: s,
            transform: "rotate(45deg)",
            marginLeft: -s / 2,
            marginTop: -s / 2,
          }}
        />
      );
    case "rest":
    default:
      return (
        <div
          className={common + " rounded-full"}
          style={{ width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }}
        />
      );
  }
}

type ImageRect = { left: number; top: number; width: number; height: number } | null;

export default function OverviewMap({
  locations,
  onSelectLocation,
}: OverviewMapProps) {
  const [imageError, setImageError] = useState(false);
  const [imageRect, setImageRect] = useState<ImageRect>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const updateImageRect = () => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.complete) return;
    const cr = container.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    setImageRect({
      left: ir.left - cr.left,
      top: ir.top - cr.top,
      width: ir.width,
      height: ir.height,
    });
  };

  useEffect(() => {
    updateImageRect();
    const ro = new ResizeObserver(updateImageRect);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateImageRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateImageRect);
    };
  }, []);

  const maxCount = Math.max(1, ...locations.map((l) => l.dotSize));
  const minCount = Math.min(...locations.map((l) => l.dotSize));

  /** Position from Map Locations: Visual_Lon (X) and Visual_Lat (Y) using hardcoded image bounds. */
  const getOverlayPercent = (loc: OverviewLocation) =>
    visualToOverlayPercent(Number(loc.visualLonX), Number(loc.visualLatY));

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-900">
      {/* Static map image: use public path; if missing, show neutral background + hint */}
      <div ref={containerRef} className="relative h-screen w-full bg-gray-800">
        <img
          ref={imgRef}
          src="/overview-map.png"
          alt="Overview map"
          className="absolute inset-0 z-0 h-full w-full object-contain object-center"
          onLoad={updateImageRect}
          onError={() => setImageError(true)}
        />
        {imageError && (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 z-[2] -translate-x-1/2 rounded bg-gray-900/80 px-3 py-2 text-center text-xs text-gray-400"
            aria-hidden
          >
            Add overview-map.png to public/ for the static map.
          </div>
        )}

        {/* Overlay: same size/position as the image so dot % align with the map */}
        {imageRect && (
          <div
            className="absolute z-[5]"
            style={{
              left: imageRect.left,
              top: imageRect.top,
              width: imageRect.width,
              height: imageRect.height,
              pointerEvents: "none",
            }}
          >
            <div className="relative h-full w-full" style={{ pointerEvents: "auto" }}>
              {locations.map((loc, index) => {
              const radius = getRadius(loc.dotSize, minCount, maxCount);
              const { x, y } = getOverlayPercent(loc);
              const lat = loc.centerLat ?? DEFAULT_MAP_CENTER.lat;
              const lon = loc.centerLon ?? DEFAULT_MAP_CENTER.lon;
              return (
                <button
                  key={`${loc.location}-${loc.visualLonX}-${loc.visualLatY}-${index}`}
                  type="button"
                  className="absolute border-0 bg-transparent p-0 text-red-600 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "auto",
                  }}
                  onClick={() =>
                    onSelectLocation({ name: loc.location, longitude: lon, latitude: lat })
                  }
                  title={`${loc.location} (${loc.dotSize})`}
                >
                  <DotShape
                    shapeDisplay={loc.shapeDisplay}
                    size={radius}
                    className="bg-red-600/90 text-red-600/90"
                  />
                </button>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
