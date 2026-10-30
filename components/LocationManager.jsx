"use client";

import { useEffect, useState } from "react";
import LocationPicker from "@/components/LocationPicker";

export default function LocationManager() {
  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    const savedLocation =
      localStorage.getItem("Zeric-location");

    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);

        if (parsed?.address) {
          setSelectedLocation(parsed);
          setOpen(false);
          return;
        }
      } catch {
        localStorage.removeItem("Zeric-location");
      }
    }

    setSelectedLocation(null);
    setOpen(true);
  }, []);

  const handleLocationSelected = (data) => {
    if (!data) return;

    setSelectedLocation(data);
    setOpen(false);

    localStorage.setItem(
      "Zeric-location",
      JSON.stringify(data)
    );
  };

  return (
    <LocationPicker
      open={open}
      onClose={() => setOpen(false)}
      onLocationSelected={handleLocationSelected}
    />
  );
}