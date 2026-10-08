 
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import {
  Users,
  MapPin,
  Navigation,
  Search,
  ChevronRight,
  X,
} from "lucide-react";
import GoUpButton from "@/components/GoUpButton";

const parlours = [
  {
    id: "parlour-001",
    name: "Aura Glow Beauty Parlour & Spa",
    category: "For Women",
    rating: "4.9",
    address: "80 Feet Road, Koramangala 4th Block",
    lat: 12.9352,
    lng: 77.6245,
    peopleAhead: 2,
  },
  {
    id: "parlour-002",
    name: "Naturals Women Beauty Parlour",
    category: "For Women",
    rating: "4.7",
    address: "Koramangala 5th Block, Bengaluru",
    lat: 12.9347,
    lng: 77.6138,
    peopleAhead: 4,
  },
  {
    id: "parlour-003",
    name: "Rose Petals Ladies Parlour",
    category: "For Women",
    rating: "4.5",
    address: "Tavarekere Main Road, BTM",
    lat: 12.9234,
    lng: 77.6092,
    peopleAhead: 3,
  },
  {
    id: "parlour-004",
    name: "Bliss Glow Herbal Parlour",
    category: "For Women",
    rating: "4.6",
    address: "Ejipura Signal, Inner Ring Road",
    lat: 12.9462,
    lng: 77.6201,
    peopleAhead: 2,
  },
];

function calculateDistance(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export default function ParloursPage() {
  const { data: session, status } = useSession();

  const [location, setLocation] = useState("Select Location");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const savedLocation = localStorage.getItem("queueease-location");

    if (!savedLocation) return;

    try {
      const parsed = JSON.parse(savedLocation);

      if (parsed && typeof parsed === "object") {
        setLocation(
          parsed.name ||
            parsed.address ||
            parsed.location ||
            parsed.display_name ||
            "Selected Location"
        );
      } else {
        setLocation(String(parsed));
      }
    } catch {
      setLocation(savedLocation);
    }
  }, []);

  const userCoordinates = useMemo(() => {
    const latitude = Number(session?.user?.latitude);
    const longitude = Number(session?.user?.longitude);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return {
        lat: latitude,
        lng: longitude,
      };
    }

    return null;
  }, [
    session?.user?.latitude,
    session?.user?.longitude,
  ]);

  const filteredParlours = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return parlours
      .map((parlour) => {
        const distance = userCoordinates
          ? calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              parlour.lat,
              parlour.lng
            )
          : null;

        return {
          ...parlour,
          distance,
        };
      })
      .filter((parlour) =>
        parlour.name.toLowerCase().includes(searchText)
      )
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) {
          return 0;
        }

        if (a.distance === null) {
          return 1;
        }

        if (b.distance === null) {
          return -1;
        }

        return a.distance - b.distance;
      });
  }, [search, userCoordinates]);

  const shortLocation =
    location.split(",")[0].trim() || "Select Location";

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={true} />

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-5 sm:mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-pink-600">
                  Parlour
                </span>

                <span className="text-xs text-gray-400">
                  {filteredParlours.length} parlours nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Beauty Parlours Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Select any parlour to view available beauty and wellness
                services.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search parlour by name..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 focus:border-pink-400 focus:ring-4 focus:ring-pink-50"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              <div className="group relative w-full sm:w-auto">
                <Link
                  href="/profile"
                  className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md active:translate-y-0 sm:min-w-[230px]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50">
                    <MapPin
                      size={17}
                      className="text-pink-600"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {shortLocation}
                    </p>
                  </div>

                  <ChevronRight
                    size={17}
                    className="shrink-0 text-gray-400"
                  />
                </Link>

                {location !== "Select Location" && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
                    <div className="relative max-w-[280px] whitespace-normal break-words rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-medium leading-5 text-white shadow-lg">
                      {location}

                      <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-gray-900" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 sm:text-sm">
          <Navigation
            size={15}
            className="shrink-0 text-pink-500"
          />

          <span>
            {status === "loading"
              ? "Loading your location..."
              : userCoordinates
              ? "Sorted by distance from your location"
              : "Location coordinates unavailable"}
          </span>
        </div>

        {filteredParlours.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search
                size={21}
                className="text-gray-400"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No parlours found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try searching with a different parlour name.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredParlours.map((salon) => (
              <div
                key={salon.name}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
                      <h3 className="min-w-0 text-base font-bold leading-snug text-gray-900 sm:text-lg">
                        {salon.name}
                      </h3>

                      {salon.category && (
                        <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                          {salon.category}
                        </span>
                      )}

                      {salon.rating && (
                        <span className="shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                          ★ {salon.rating}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 items-start gap-1.5 text-sm text-gray-500">
                        <MapPin
                          size={16}
                          className="mt-0.5 shrink-0 text-red-500"
                        />

                        <span className="min-w-0 break-words leading-5">
                          {salon.address}
                        </span>
                      </div>

                      {salon.distance !== null && (
  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200">
                          {salon.distance < 1
                            ? `${Math.round(
                                salon.distance * 1000
                              )} m away`
                            : `${salon.distance.toFixed(
                                1
                              )} km away`}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 sm:text-sm">
                        <Users
                          size={15}
                          className="shrink-0"
                        />

                        <span>
                          {salon.peopleAhead === 0
                            ? "No one ahead"
                            : `${salon.peopleAhead} ${
                                salon.peopleAhead === 1
                                  ? "person"
                                  : "people"
                              } ahead`}
                        </span>
                      </div>

                      {salon.peopleAhead <= 3 && (
                        <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 sm:text-sm">
                          Short queue
                        </span>
                      )}

                      {salon.peopleAhead > 3 && (
                        <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 sm:text-sm">
                          Busy
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-auto md:shrink-0">
                    <Link
                      href={`/services/parlours/${salon.id}`}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] md:w-auto"
                    >
                      View Services
                      <span className="ml-2">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <GoUpButton/>
    </main>
  );
}

