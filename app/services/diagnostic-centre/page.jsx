"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import {
  MapPin,
  Navigation,
  Search,
  ChevronRight,
  X,
  Users,
} from "lucide-react";

const diagnosticLabs = [
  {
    id: "diagnostic-001",
    name: "Apex Diagnostic & Pathology Lab",
    rating: "4.8",
    address: "BTM 2nd Stage, Outer Ring Road, Bengaluru",
    lat: 12.9166,
    lng: 77.6101,
    doctor: "Dr. Arvind Swaminathan",
    specialization: "MD Pathology",
    peopleAhead: 4,
  },
  {
    id: "diagnostic-002",
    name: "ThyroScan Path Lab & Imaging",
    rating: "4.7",
    address: "Madiwala Main Road, Bengaluru",
    lat: 12.9226,
    lng: 77.6174,
    doctor: "Dr. Malini Kapoor",
    specialization: "MD Biochemistry & Endocrinology Lab Specialist",
    peopleAhead: 2,
  },
  {
    id: "diagnostic-003",
    name: "Metropolis Healthcare Diagnostics",
    rating: "4.9",
    address: "BTM 1st Stage, Bengaluru",
    lat: 12.9165,
    lng: 77.6101,
    doctor: "Dr. Suresh Nambiar",
    specialization: "MD Microbiology & Pathology Diagnostics",
    peopleAhead: 6,
  },
  {
    id: "diagnostic-004",
    name: "Dr. Lal PathLabs Express Counter",
    rating: "4.6",
    address: "Silk Board Junction, Bengaluru",
    lat: 12.9177,
    lng: 77.6238,
    doctor: "Dr. Deepa Nair",
    specialization: "Consultant Clinical Pathologist",
    peopleAhead: 1,
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

export default function DiagnosticLabsPage() {
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

  const filteredLabs = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return diagnosticLabs
      .map((lab) => {
        const distance = userCoordinates
          ? calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              lab.lat,
              lab.lng
            )
          : null;

        return {
          ...lab,
          distance,
        };
      })
      .filter((lab) =>
        lab.name.toLowerCase().includes(searchText)
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
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                  Diagnostic Centre
                </span>

                <span className="text-xs text-gray-400">
                  {filteredLabs.length} diagnostic centres nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Diagnostic Centres Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Find nearby diagnostic centres and book your tests without
                waiting in long queues.
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
                  placeholder="Search diagnostic centre by name..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
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
                  className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:translate-y-0 sm:min-w-[230px]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 transition-all duration-200 group-hover:bg-indigo-100">
                    <MapPin
                      size={17}
                      className="text-indigo-600 transition-transform duration-200 group-hover:scale-110"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {shortLocation}
                    </p>
                  </div>

                  <ChevronRight
                    size={17}
                    className="shrink-0 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-500"
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
            className="shrink-0 text-indigo-500"
          />

          <span>
            {status === "loading"
              ? "Loading your location..."
              : userCoordinates
              ? "Sorted by distance from your location"
              : "Location coordinates unavailable"}
          </span>
        </div>

        {filteredLabs.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search
                size={21}
                className="text-gray-400"
              />
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No diagnostic centres found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try searching with a different diagnostic centre name.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredLabs.map((lab) => (
              <div
                key={lab.name}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
                      <h3 className="min-w-0 text-base font-bold leading-snug text-gray-900 sm:text-lg">
                        {lab.name}
                      </h3>

                      <span className="shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                        ★ {lab.rating}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 items-start gap-1.5 text-sm text-gray-500">
                        <MapPin
                          size={16}
                          className="mt-0.5 shrink-0 text-red-500"
                        />

                        <span className="min-w-0 break-words leading-5">
                          {lab.address}
                        </span>
                      </div>

                      {lab.distance !== null && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                          {lab.distance < 1
                            ? `${Math.round(
                                lab.distance * 1000
                              )} m away`
                            : `${lab.distance.toFixed(
                                1
                              )} km away`}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 sm:text-sm">
                        <span>🧑‍⚕️</span>

                        <span>{lab.doctor}</span>
                      </div>

                      <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 sm:text-sm">
                        {lab.specialization}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 sm:text-sm">
                        <Users
                          size={15}
                          className="shrink-0"
                        />

                        <span>
                          {lab.peopleAhead === 0
                            ? "No one ahead"
                            : `${lab.peopleAhead} ${
                                lab.peopleAhead === 1
                                  ? "person"
                                  : "people"
                              } ahead`}
                        </span>
                      </div>

                      {lab.peopleAhead <= 3 && (
                        <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 sm:text-sm">
                          Short queue
                        </span>
                      )}

                      {lab.peopleAhead > 3 && (
                        <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 sm:text-sm">
                          Busy
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-auto md:shrink-0">
                    <Link
                      href={`/services/diagnostic-centre/${lab.id}`}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] md:w-auto"
                    >
                      View Doctor
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