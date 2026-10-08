"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Navigation,
  X,
  Search,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

const STORAGE_KEY = "queueease-location";

export default function LocationPicker({
  open,
  onClose,
  onLocationSelected,
}) {
  const { update } = useSession();

  const [location, setLocation] = useState("");
  const [originalLocation, setOriginalLocation] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const searchRequestRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    const savedLocation = localStorage.getItem(STORAGE_KEY);

    if (!savedLocation) {
      setLocation("");
      setOriginalLocation("");
      setSelectedLocation(null);
      return;
    }

    try {
      const parsed = JSON.parse(savedLocation);

      if (parsed?.address) {
        setLocation(parsed.address);
        setOriginalLocation(parsed.address);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [open]);

  const updateSessionLocation = async (data) => {
    try {
      await update({
        location: data.address || "",
        latitude:
          data.latitude !== undefined ? data.latitude : null,
        longitude:
          data.longitude !== undefined ? data.longitude : null,
      });
    } catch {
      toast.error("Failed to update session location.");
    }
  };

  const searchLocation = async (query) => {
    const requestId = ++searchRequestRef.current;

    try {
      setSearching(true);

      const response = await fetch(
        `/api/location/search?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();

      const results = Array.isArray(data) ? data : [];

      if (requestId === searchRequestRef.current) {
        setSuggestions(results);
      }

      return results;
    } catch {
      if (requestId === searchRequestRef.current) {
        setSuggestions([]);
      }

      return [];
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    const query = location.trim();

    if (!query) {
      setSuggestions([]);
      setSelectedLocation(null);
      return;
    }

    if (selectedLocation) return;

    if (query === originalLocation.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      searchLocation(query);
    }, 450);

    return () => clearTimeout(timer);
  }, [
    location,
    originalLocation,
    selectedLocation,
    open,
  ]);

  const saveLocation = async (data) => {
    if (!data?.address) return;

    const locationData = {
      type: data.type || "search",
      placeId: data.placeId || null,
      name: data.name || null,
      address: data.address,
      latitude:
        data.latitude !== undefined ? data.latitude : null,
      longitude:
        data.longitude !== undefined ? data.longitude : null,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(locationData)
    );

    await updateSessionLocation(locationData);

    setLocation(locationData.address);
    setOriginalLocation(locationData.address);
    setSuggestions([]);
    setSelectedLocation(null);

    onLocationSelected?.(locationData);
    onClose?.();
  };

  const getCurrentLocation = () => {
    if (loading) return;

    if (!navigator.geolocation) {
      toast.error(
        "Location is not supported by this browser."
      );
      return;
    }

    setLoading(true);
    setSuggestions([]);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const {
          latitude,
          longitude,
          accuracy,
        } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                Accept: "application/json",
              },
            }
          );

          if (!response.ok) {
            throw new Error("Failed to get address");
          }

          const data = await response.json();

          const address =
            data?.display_name ||
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

          await saveLocation({
            type: "current",
            address,
            latitude,
            longitude,
            accuracy,
          });

          toast.success("Current location selected");
        } catch {
          await saveLocation({
            type: "current",
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
            accuracy,
          });

          toast.success("Current location selected");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);

        if (error.code === error.PERMISSION_DENIED) {
          toast.error(
            "Location permission was denied. Please allow location access in your browser."
          );
        } else if (
          error.code === error.POSITION_UNAVAILABLE
        ) {
          toast.error(
            "Unable to detect your current location. Please turn on GPS/location services."
          );
        } else if (error.code === error.TIMEOUT) {
          toast.error(
            "Location request timed out. Please try again."
          );
        } else {
          toast.error(
            "Unable to get your current location."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      }
    );
  };

  const selectSuggestion = (item) => {
    const selected = {
      type: "search",
      placeId: item.placeId || null,
      name: item.name || "",
      address:
        item.address ||
        item.name ||
        "",
      latitude:
        item.latitude !== undefined
          ? item.latitude
          : null,
      longitude:
        item.longitude !== undefined
          ? item.longitude
          : null,
    };

    setSelectedLocation(selected);
    setLocation(selected.address);
    setSuggestions([]);
  };

  const handleContinue = async () => {
    if (!selectedLocation) return;

    await saveLocation(selectedLocation);

    toast.success("Location selected");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const value = location.trim();

    if (!value) {
      toast.error("Please enter a location.");
      return;
    }

    if (selectedLocation) {
      await handleContinue();
      return;
    }

    if (value === originalLocation.trim()) {
      setSuggestions([]);
      onClose?.();
      return;
    }

    if (searching) return;

    const results = await searchLocation(value);

    if (results.length > 0) {
      selectSuggestion(results[0]);
      return;
    }

    setSelectedLocation({
      type: "manual",
      address: value,
      latitude: null,
      longitude: null,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }

    handleSubmit(e);
  };

  const clearLocation = () => {
    searchRequestRef.current += 1;

    setLocation("");
    setSuggestions([]);
    setSelectedLocation(null);
    setSearching(false);
  };

  if (!open) return null;

  const locationChanged =
    location.trim() !== originalLocation.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[1px] sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">

        {/* Header */}
        <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                <MapPin
                  size={19}
                  className="text-indigo-600"
                />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                  Choose your location
                </h2>

                <p className="text-xs text-gray-500 sm:text-sm">
                  Find services near you
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="location-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">

          {/* Current Location */}
          <div className="px-4 pt-4 sm:px-6 sm:pt-5">

            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-left transition hover:bg-indigo-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:gap-4 sm:p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white sm:h-11 sm:w-11">

                {loading ? (
                  <Loader2
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <Navigation size={19} />
                )}

              </div>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-semibold text-gray-900 sm:text-base">
                  {loading
                    ? "Detecting your location..."
                    : "Use current location"}
                </p>

                <p className="mt-1 text-[11px] leading-4 text-gray-500 sm:text-xs">
                  Allow location access from your phone browser
                </p>

              </div>
            </button>

            <div className="my-4 flex items-center gap-3 sm:my-5">
              <div className="h-px flex-1 bg-gray-200" />

              <span className="text-[11px] font-medium text-gray-400">
                OR
              </span>

              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </div>

          {/* Search */}
          <div className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 pb-3 pt-1 shadow-sm sm:px-6">

            <form onSubmit={handleSubmit}>

              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Search location
              </label>

              <div className="relative">

                <div
                  className={`flex items-center rounded-xl border bg-white px-3 transition ${
                    selectedLocation
                      ? "border-emerald-300 ring-2 ring-emerald-50"
                      : "border-gray-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"
                  }`}
                >

                  {searching ? (
                    <Loader2
                      size={18}
                      className="shrink-0 animate-spin text-indigo-500"
                    />
                  ) : selectedLocation ? (
                    <MapPin
                      size={18}
                      className="shrink-0 text-emerald-500"
                    />
                  ) : (
                    <Search
                      size={18}
                      className="shrink-0 text-gray-400"
                    />
                  )}

                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setSelectedLocation(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Area, street or city"
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    autoComplete="off"
                    enterKeyHint="search"
                  />

                  {location && (
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                    >
                      <X size={16} />
                    </button>
                  )}

                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">

                    {suggestions.map((item, index) => (
                      <button
                        key={
                          item.placeId ||
                          `${item.name}-${index}`
                        }
                        type="button"
                        onClick={() =>
                          selectSuggestion(item)
                        }
                        className="flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 active:bg-gray-100 sm:px-4"
                      >

                        <MapPin
                          size={18}
                          className="mt-0.5 shrink-0 text-indigo-500"
                        />

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-sm font-semibold text-gray-900">
                            {item.name}
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs leading-4 text-gray-500">
                            {item.address}
                          </p>

                        </div>

                      </button>
                    ))}

                  </div>
                )}

              </div>

              {/* Selected location */}
              {selectedLocation && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">

                  <MapPin
                    size={15}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    Location selected. Tap Continue to save it.
                  </span>

                </div>
              )}

              {/* Continue */}
              {locationChanged &&
                location.trim() &&
                !searching && (
                  <button
                    type="submit"
                    className="mt-3 w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.99]"
                  >
                    Continue
                  </button>
                )}

            </form>
          </div>

          <div className="h-40 px-4 py-6 sm:px-6">
            <p className="text-center text-xs leading-5 text-gray-400">
              Search for your area, street,
              locality or city to find nearby
              services.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">

          <p className="text-center text-[11px] leading-4 text-gray-400 sm:text-xs sm:leading-5">
            Your location helps us show nearby
            services.
          </p>

        </div>

      </div>
    </div>
  );
}