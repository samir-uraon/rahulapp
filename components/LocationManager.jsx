"use client";

import { useEffect, useState } from "react";
import LocationPicker from "@/components/LocationPicker";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "Zeriy-location";
const LEGACY_STORAGE_KEY = "queueease-location";

export default function LocationManager() {
  const { update } = useSession();

  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [checking, setChecking] = useState(true);

  // Update NextAuth session location fields
  const updateSessionLocation = async (data) => {
    try {
      await update({
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        locationName: data.name || "",
        address: data.address || "",
      });
    } catch (error) {
      console.error("SESSION_LOCATION_UPDATE_ERROR:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      try {
        // Fetch saved location from MongoDB
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

          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedLocation)
          );

          localStorage.removeItem(LEGACY_STORAGE_KEY);

          setSelectedLocation(savedLocation);
          setOpen(false);

          // Synchronize MongoDB location with NextAuth session
          if (!cancelled) {
            await updateSessionLocation(savedLocation);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);

          setSelectedLocation(null);
          setOpen(true);
        }
      } catch (error) {
        console.error("LOCATION_MANAGER_ERROR:", error);

        if (cancelled) return;

        // Use local cache if MongoDB request fails
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          const parsed = JSON.parse(cached || legacy || "null");

          if (parsed?.address) {
            setSelectedLocation(parsed);
            setOpen(false);

            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(parsed)
            );

            await updateSessionLocation(parsed);
          } else {
            setSelectedLocation(null);
            setOpen(true);
          }
        } catch (cacheError) {
          console.error("LOCATION_CACHE_ERROR:", cacheError);
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
  const handleLocationSelected = async (data) => {
    if (!data?.address) return;

    setSelectedLocation(data);
    setOpen(false);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    localStorage.removeItem(LEGACY_STORAGE_KEY);

    await updateSessionLocation(data);
  };

  if (checking) return null;

  return (
    <LocationPicker
      open={open}
      onClose={() => setOpen(false)}
      onLocationSelected={handleLocationSelected}
    />
  );
}