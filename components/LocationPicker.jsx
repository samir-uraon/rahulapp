
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

const STORAGE_KEY = "Zeriy-location";
const LEGACY_STORAGE_KEY = "queueease-location";

const ALLOWED_LOCATION_TYPES = ["current", "search", "manual"];

function normalizeLocationType(type) {
  if (type === "gps") return "current";
  return ALLOWED_LOCATION_TYPES.includes(type) ? type : "search";
}

function getCachedLocation() {
  try {
    const value =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!value) return null;

    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object") {
      const normalized = {
        ...parsed,
        type: normalizeLocationType(parsed.type),
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalized)
      );

      localStorage.removeItem(LEGACY_STORAGE_KEY);

      return normalized;
    }

    return {
      type: "manual",
      name: String(parsed),
      address: String(parsed),
      latitude: null,
      longitude: null,
    };
  } catch (error) {
    console.error("READ_LOCATION_CACHE_ERROR:", error);
    return null;
  }
}

function validCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export default function LocationPicker({
  open,
  onClose,
  onLocationSelected,
}) {
  const { data: session, status, update } = useSession();

  const userRole = String(session?.user?.role || "").toLowerCase();

  const isAuthenticated =
    status === "authenticated" && userRole === "user";

  const [location, setLocation] = useState("");
  const [originalLocation, setOriginalLocation] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const searchRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);
  const gpsRequestRef = useRef(false);
  const nativeLocationRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // =====================================================
  // FETCH SAVED LOCATION
  // =====================================================

  useEffect(() => {
    if (!open || status === "loading") return;

    let cancelled = false;

    async function loadSavedLocation() {
      try {
        if (!isAuthenticated) {
          const cached = getCachedLocation();

          if (cancelled) return;

          setLocation(cached?.address || "");
          setOriginalLocation(cached?.address || "");
          setSelectedLocation(null);
          return;
        }

        const response = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 401) {
          const cached = getCachedLocation();

          if (cancelled) return;

          setLocation(cached?.address || "");
          setOriginalLocation(cached?.address || "");
          setSelectedLocation(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to fetch profile");
        }

        const result = await response.json();

        if (cancelled) return;

        const user = result.user || result.profile || {};

        const saved = {
          type: normalizeLocationType(user.locationType),
          name: user.locationName || "",
          address: user.address || "",
          latitude:
            user.location?.latitude != null
              ? Number(user.location.latitude)
              : null,
          longitude:
            user.location?.longitude != null
              ? Number(user.location.longitude)
              : null,
          city: user.city || "",
          state: user.state || "",
          pinCode: user.pinCode || "",
        };

        if (saved.address) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(saved)
          );

          localStorage.removeItem(LEGACY_STORAGE_KEY);

          setLocation(saved.address);
          setOriginalLocation(saved.address);
        } else {
          const cached = getCachedLocation();

          setLocation(cached?.address || "");
          setOriginalLocation(cached?.address || "");
        }

        setSelectedLocation(null);
      } catch (error) {
        if (cancelled) return;

        console.error("LOAD_PROFILE_LOCATION_ERROR:", error);

        const cached = getCachedLocation();

        setLocation(cached?.address || "");
        setOriginalLocation(cached?.address || "");
        setSelectedLocation(null);
      }
    }

    loadSavedLocation();

    return () => {
      cancelled = true;
    };
  }, [open, status, isAuthenticated]);

  // =====================================================
  // UPDATE NEXTAUTH SESSION
  // =====================================================

  const updateSessionLocation = async (data) => {
    if (!isAuthenticated) return;

    try {
      await update({
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        locationName: data.name || "",
        address: data.address || "",
        locationType: data.type || "search",
        city: data.city || "",
        state: data.state || "",
        pinCode: data.pinCode || "",
      });
    } catch (error) {
      console.error("SESSION_LOCATION_UPDATE_ERROR:", error);
    }
  };

  // =====================================================
  // SEARCH LOCATIONS
  // =====================================================

  const searchLocation = async (query) => {
    const requestId = ++searchRequestRef.current;

    try {
      setSearching(true);

      const response = await fetch(
        `/api/location/search?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();
      const results = Array.isArray(data) ? data : [];

      if (
        mountedRef.current &&
        requestId === searchRequestRef.current
      ) {
        setSuggestions(results);
      }

      return results;
    } catch (error) {
      console.error("LOCATION_SEARCH_ERROR:", error);

      if (
        mountedRef.current &&
        requestId === searchRequestRef.current
      ) {
        setSuggestions([]);
      }

      return [];
    } finally {
      if (
        mountedRef.current &&
        requestId === searchRequestRef.current
      ) {
        setSearching(false);
      }
    }
  };

  // =====================================================
  // DEBOUNCED SEARCH
  // =====================================================

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
  }, [location, originalLocation, selectedLocation, open]);

  // =====================================================
  // SAVE LOCATION
  // =====================================================

  const saveLocation = async (data) => {
    if (!data?.address?.trim()) {
      toast.error("Please select a valid location.");
      return false;
    }

    if (savingRef.current) return false;

    savingRef.current = true;
    setSaving(true);

    try {
      const locationType = normalizeLocationType(data.type);

      if (!ALLOWED_LOCATION_TYPES.includes(locationType)) {
        throw new Error("Invalid location type.");
      }

      const latitude =
        data.latitude != null && data.latitude !== ""
          ? Number(data.latitude)
          : null;

      const longitude =
        data.longitude != null && data.longitude !== ""
          ? Number(data.longitude)
          : null;

      const hasCoordinates =
        latitude !== null &&
        longitude !== null &&
        validCoordinates(latitude, longitude);

      // Current/GPS location must have valid coordinates.
      if (locationType === "current" && !hasCoordinates) {
        throw new Error(
          "Invalid GPS coordinates. Please try detecting your location again."
        );
      }

      // Reject partial or invalid coordinates.
      if (
        (latitude !== null || longitude !== null) &&
        !hasCoordinates
      ) {
        throw new Error(
          "Invalid location coordinates. Please select the location again."
        );
      }

      const locationData = {
        type: locationType,
        placeId: data.placeId || null,
        name: data.name || "",
        address: data.address.trim(),
        latitude: hasCoordinates ? latitude : null,
        longitude: hasCoordinates ? longitude : null,
        city: data.city || "",
        state: data.state || "",
        pinCode: String(data.pinCode || ""),
        ...(data.accuracy != null
          ? { accuracy: Number(data.accuracy) }
          : {}),
      };

      // Guest user: save in localStorage.
      if (!isAuthenticated) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(locationData)
        );

        localStorage.removeItem(LEGACY_STORAGE_KEY);

        setLocation(locationData.address);
        setOriginalLocation(locationData.address);
        setSuggestions([]);
        setSelectedLocation(null);

        onLocationSelected?.(locationData);
        onClose?.();

        return true;
      }

      // Authenticated user: save in MongoDB.
      const payload = {
        address: locationData.address,
        locationName: locationData.name,
        locationType: locationData.type,
        location: hasCoordinates
          ? {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
            }
          : null,
        city: locationData.city,
        state: locationData.state,
        pinCode: locationData.pinCode,
      };

      console.log("ZERIY LOCATION SAVE PAYLOAD:", payload);

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("PROFILE LOCATION SAVE FAILED:", {
          status: response.status,
          response: result,
          payload,
        });

        throw new Error(
          result.message ||
          result.error ||
          `Failed to save location (${response.status})`
        );
      }

      // Cache only after server confirms success.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(locationData)
      );

      localStorage.removeItem(LEGACY_STORAGE_KEY);

      setLocation(locationData.address);
      setOriginalLocation(locationData.address);
      setSuggestions([]);
      setSelectedLocation(null);

      await updateSessionLocation(locationData);

      onLocationSelected?.(locationData);
      onClose?.();

      return true;
    } catch (error) {
      console.error("SAVE_LOCATION_ERROR:", error);

      toast.error(
        error.message || "Failed to save location."
      );

      return false;
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  // =====================================================
  // REVERSE GEOCODING
  // =====================================================

  async function reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(
        `/api/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("REVERSE GEOCODING API FAILED:", {
          status: response.status,
          result,
        });

        throw new Error(
          result.message || "Reverse geocoding failed"
        );
      }

      const address = result.address || {};

      return {
        address: result.display_name || "",
        city:
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          "",
        state: address.state || "",
        pincode: address.postcode || "",
        country: address.country || "",
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    } catch (error) {
      console.error("REVERSE_GEOCODING_ERROR:", error);
      return null;
    }
  }

  // =====================================================
  // EXPO NATIVE LOCATION BRIDGE
  // =====================================================

  const requestNativeMobileLocation = () => {
    if (
      typeof window === "undefined" ||
      typeof window.ReactNativeWebView?.postMessage !== "function"
    ) {
      return Promise.resolve({ available: false });
    }

    const requestId =
      `${Date.now()}-${++nativeLocationRequestRef.current}`;

    return new Promise((resolve) => {
      let timeoutId;

      const cleanup = () => {
        window.removeEventListener(
          "zeriy:native-location",
          handleLocation
        );

        window.clearTimeout(timeoutId);
      };

      const handleLocation = (event) => {
        const result = event.detail;

        if (result?.requestId !== requestId) return;

        cleanup();

        resolve({
          available: true,
          result,
        });
      };

      window.addEventListener(
        "zeriy:native-location",
        handleLocation
      );

      timeoutId = window.setTimeout(() => {
        cleanup();

        resolve({
          available: true,
          result: {
            success: false,
            error:
              "Mobile location request timed out. Please try again.",
          },
        });
      }, 25000);

      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "ZERIY_GET_CURRENT_LOCATION",
            requestId,
          })
        );
      } catch (error) {
        cleanup();

        resolve({
          available: true,
          result: {
            success: false,
            error: "Unable to communicate with the mobile app.",
          },
        });
      }
    });
  };

  // =====================================================
  // GET CURRENT LOCATION
  // =====================================================

  const getCurrentLocation = async () => {
    if (gpsRequestRef.current || savingRef.current) return;

    gpsRequestRef.current = true;
    setLoading(true);
    setSuggestions([]);
    setSelectedLocation(null);

    try {
      let coords;

      // First try Expo native GPS.
      const nativeResponse =
        await requestNativeMobileLocation();

      if (nativeResponse.available) {
        const result = nativeResponse.result;

        if (!result?.success) {
          throw new Error(
            result?.error || "Unable to get mobile location."
          );
        }

        const latitude = Number(result.latitude);
        const longitude = Number(result.longitude);

        if (!validCoordinates(latitude, longitude)) {
          throw new Error(
            "The mobile app returned invalid GPS coordinates."
          );
        }

        coords = {
          latitude,
          longitude,
          accuracy:
            result.accuracy != null
              ? Number(result.accuracy)
              : null,
        };
      } else {
        // Browser GPS for normal website usage.
        if (!navigator.geolocation) {
          throw new Error(
            "Geolocation is not supported by this browser."
          );
        }

        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: Number(position.coords.latitude),
                longitude: Number(position.coords.longitude),
                accuracy: position.coords.accuracy ?? null,
              });
            },
            (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                reject(
                  new Error(
                    "Location permission denied. Allow location access."
                  )
                );
              } else if (
                error.code === error.POSITION_UNAVAILABLE
              ) {
                reject(
                  new Error(
                    "Unable to detect your location. Check GPS settings."
                  )
                );
              } else if (error.code === error.TIMEOUT) {
                reject(
                  new Error(
                    "Location request timed out. Please try again."
                  )
                );
              } else {
                reject(
                  new Error(
                    "Unable to get your current location."
                  )
                );
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 0,
            }
          );
        });
      }

      const { latitude, longitude, accuracy } = coords;

      if (!validCoordinates(latitude, longitude)) {
        throw new Error("Invalid GPS coordinates.");
      }

      console.log("ZERIY GPS COORDINATES:", {
        latitude,
        longitude,
        accuracy,
      });

      const addressData = await reverseGeocode(
        latitude,
        longitude
      );

      // IMPORTANT: GPS is stored as "current", not "gps".
      const locationData = {
        type: "current",
        name: addressData?.city || "Current location",
        address:
          addressData?.address ||
          `Current location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
        latitude,
        longitude,
        city: addressData?.city || "",
        state: addressData?.state || "",
        pinCode: addressData?.pincode || "",
        accuracy,
      };

      console.log("ZERIY FINAL GPS LOCATION:", locationData);

      const saved = await saveLocation(locationData);

      if (saved) {
        toast.success(
          "Current location detected and saved successfully."
        );
      }
    } catch (error) {
      console.error("CURRENT_LOCATION_ERROR:", error);

      toast.error(
        error.message ||
        "Unable to get or save your current location."
      );
    } finally {
      gpsRequestRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // =====================================================
  // SELECT SEARCH SUGGESTION
  // =====================================================

  const selectSuggestion = (item) => {
    const latitude =
      item.latitude != null ? Number(item.latitude) : null;

    const longitude =
      item.longitude != null ? Number(item.longitude) : null;

    const hasCoordinates =
      latitude !== null &&
      longitude !== null &&
      validCoordinates(latitude, longitude);

    const selected = {
      type: "search",
      placeId: item.placeId || null,
      name: item.name || "",
      address: item.address || item.name || "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null,
      city: item.city || "",
      state: item.state || "",
      pinCode: item.pinCode || item.postcode || "",
    };

    setSelectedLocation(selected);
    setLocation(selected.address);
    setSuggestions([]);
  };

  // =====================================================
  // CONTINUE
  // =====================================================

  const handleContinue = async () => {
    if (!selectedLocation || savingRef.current) return;

    const saved = await saveLocation(selectedLocation);

    if (saved) {
      toast.success("Location saved successfully.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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

    if (searching || savingRef.current) return;

    const results = await searchLocation(value);

    if (results.length > 0) {
      selectSuggestion(results[0]);
      return;
    }

    setSelectedLocation({
      type: "manual",
      name: value,
      address: value,
      latitude: null,
      longitude: null,
      city: "",
      state: "",
      pinCode: "",
    });
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
      return;
    }

    handleSubmit(event);
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
                <MapPin size={19} className="text-indigo-600" />
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
              disabled={saving}
              aria-label="Close location picker"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="location-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">

          {/* Current location */}
          <div className="px-4 pt-4 sm:px-6 sm:pt-5">
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={loading || saving}
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
                  Allow location access on your phone or browser
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
                  ) : (
                    <Search
                      size={18}
                      className="shrink-0 text-gray-400"
                    />
                  )}

                  <input
                    type="text"
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value);
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
                      aria-label="Clear location"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
                    {suggestions.map((item, index) => (
                      <button
                        key={
                          item.placeId ||
                          `${item.name}-${index}`
                        }
                        type="button"
                        onClick={() => selectSuggestion(item)}
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

              {selectedLocation && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                  <MapPin size={15} className="mt-0.5 shrink-0" />

                  <span>
                    Location selected. Tap Continue to save it.
                  </span>
                </div>
              )}

              {locationChanged &&
                location.trim() &&
                !searching && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
                  >
                    {saving && (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    )}

                    {saving ? "Saving..." : "Continue"}
                  </button>
                )}
            </form>
          </div>

          <div className="h-40 px-4 py-6 sm:px-6">
            <p className="text-center text-xs leading-5 text-gray-400">
              Search for your area, street, locality or city
              to find nearby services.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <p className="text-center text-[11px] leading-4 text-gray-400 sm:text-xs sm:leading-5">
            Your location helps us show nearby services.
          </p>
        </div>
      </div>
    </div>
  );
}
