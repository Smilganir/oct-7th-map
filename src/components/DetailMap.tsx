"use client";

import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Oct7thDBRow } from "@/types/data";

const MAP_STYLE = "mapbox://styles/smilganir/cmm698oih004t01s49c9f5pxb";

/** Status (column P) to marker color. Align with status-legend.png when available. */
const STATUS_COLORS: Record<string, string> = {
  Killed: "#b91c1c",
  Wounded: "#ea580c",
  Missing: "#ca8a04",
  Hostage: "#4f46e5",
  Other: "#6b7280",
};

function getStatusColor(status: string): string {
  const key = status.trim() || "Other";
  return STATUS_COLORS[key] ?? STATUS_COLORS.Other;
}

export type Location = {
  name: string;
  longitude: number;
  latitude: number;
};

type DetailMapProps = {
  location: Location;
  victims: Oct7thDBRow[];
  onBack: () => void;
};

export default function DetailMap({ location, victims, onBack }: DetailMapProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const withCoords = victims.filter(
    (v) => v.latAlternate && v.longAlternate
  );

  return (
    <div className="relative flex h-screen w-full">
      <div className="relative h-full flex-1">
        {mapboxToken ? (
          <Map
            mapboxAccessToken={mapboxToken}
            initialViewState={{
              longitude: location.longitude,
              latitude: location.latitude,
              zoom: 12,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLE}
          >
            {withCoords.map((v) => (
              <Marker
                key={v.pid}
                longitude={v.longAlternate}
                latitude={v.latAlternate}
                anchor="center"
              >
                <div
                  className="h-3 w-3 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: getStatusColor(v.status) }}
                  title={`${v.pid} – ${v.status}`}
                />
              </Marker>
            ))}
          </Map>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-700">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to show the map.
          </div>
        )}
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 z-10 rounded-lg bg-white px-4 py-2 font-medium shadow-md transition-colors hover:bg-gray-100"
        >
          Back to Overview
        </button>
        {/* Status legend: image if present, else small color key */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-white/95 p-2 shadow">
          <img
            src="/status-legend.png"
            alt="Status legend"
            className="max-h-16 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(STATUS_COLORS).map(([label, color]) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Victim list: age + picture */}
      <aside className="flex h-full w-72 flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 font-semibold text-gray-800">
          {location.name}
        </h2>
        <div className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-3">
            {victims.map((v) => (
              <li
                key={v.pid}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-2"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400 text-xs">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    Age {v.age || "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
