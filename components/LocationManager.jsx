"use client";

import { useEffect, useState } from "react";
import LocationPicker from "@/components/LocationPicker";

const STORAGE_KEY = "Zeric-location";

export default function LocationManager() {
  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      try {
        // 1. Fetch saved location from MongoDB
        const response = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to fetch saved location");
        }

        const result = await response.json();
        if (cancelled) return;

        const user = result.user || result.profile || {};

        // 2. Check whether MongoDB has a saved address
        if (user.address?.trim()) {
          const savedLocation = {
            type: user.locationType || "search",
            name: user.locationName || "",
            address: user.address,
            latitude: user.location?.latitude ?? null,
            longitude: user.location?.longitude ?? null,
            city: user.city || "",
            state: user.state || "",
            pinCode: user.pinCode || "",
          };

          // Update local cache
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedLocation)
          );

          setSelectedLocation(savedLocation);
          setOpen(false);
        } else {
          // 3. No location in MongoDB: ask user to select one
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem("queueease-location");

          setSelectedLocation(null);
          setOpen(true);
        }
      } catch (error) {
        console.error("LOCATION_MANAGER_ERROR:", error);

        if (cancelled) return;

        // 4. If API fails, use local cache as fallback
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          const parsed = cached ? JSON.parse(cached) : null;

          if (parsed?.address) {
            setSelectedLocation(parsed);
            setOpen(false);
          } else {
            setSelectedLocation(null);
            setOpen(true);
          }
        } catch {
          setSelectedLocation(null);
          setOpen(true);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  // Location successfully saved by LocationPicker
  const handleLocationSelected = (data) => {
    if (!data?.address) return;

    setSelectedLocation(data);
    setOpen(false);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  };

  // Avoid rendering the picker before checking MongoDB
  if (checking) return null;

  return (
    <LocationPicker
      open={open}
      onClose={() => setOpen(false)}
      onLocationSelected={handleLocationSelected}
    />
  );
}