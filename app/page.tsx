"use client";

import { useState, useEffect } from "react";
import OverviewMap, {
  type SelectableLocation,
} from "@/components/OverviewMap";
import DetailMap from "@/components/DetailMap";
import { loadData, type DataLoadResult } from "@/lib/data";

export default function Home() {
  const [data, setData] = useState<DataLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectableLocation | null>(null);

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 text-gray-700">
        Loading data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 text-red-700">
        Failed to load data: {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (selectedLocation) {
    const victims = data.oct7thDB.filter(
      (r) => r.newMaubDeathLoc === selectedLocation.name
    );
    return (
      <DetailMap
        location={selectedLocation}
        victims={victims}
        onBack={() => setSelectedLocation(null)}
      />
    );
  }

  return (
    <OverviewMap
      locations={data.overviewLocations}
      onSelectLocation={setSelectedLocation}
    />
  );
}
