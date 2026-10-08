
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import {
  MapPin,
  Navigation,
  Search,
  ChevronRight,
  X,
  Users,
  Clock,
} from "lucide-react";
import GoUpButton from "@/components/GoUpButton";

const salons = [
  {
    id: "salon-001",
    name: "StyleCraze Grooming Saloon",
    category: "For Men",
    rating: "4.8",
    address: "14th Main, Indiranagar, Bengaluru",
    lat: 12.9719,
    lng: 77.6412,
    peopleAhead: 7,

    schedule: {
      monday: { open: "09:00", close: "20:00", active: true },
      tuesday: { open: "09:00", close: "20:00", active: true },
      wednesday: { open: "09:00", close: "20:00", active: true },
      thursday: { open: "09:00", close: "20:00", active: true },
      friday: { open: "09:00", close: "20:00", active: true },
      saturday: { open: "09:00", close: "21:00", active: true },
      sunday: { open: null, close: null, active: false },
    },

    staff: [
      {
        id: "staff-001",
        name: "Rahul Kumar",
        services: ["haircut", "beard", "hair-beard"],
        startTime: "10:00",
        endTime: "18:00",
        serviceDuration: {
          haircut: 30,
          beard: 20,
          "hair-beard": 45,
        },
        serviceCharge: {
          haircut: 250,
          beard: 150,
          "hair-beard": 350,
        },
      },
      {
        id: "staff-002",
        name: "Amit Sharma",
        services: ["haircut", "hair-spa"],
        startTime: "11:00",
        endTime: "19:00",
        serviceDuration: {
          haircut: 30,
          "hair-spa": 45,
        },
        serviceCharge: {
          haircut: 300,
          "hair-spa": 550,
        },
      },
      {
        id: "staff-003",
        name: "Vikash Singh",
        services: ["beard", "hair-beard", "hair-spa"],
        startTime: "10:00",
        endTime: "17:00",
        serviceDuration: {
          beard: 20,
          "hair-beard": 45,
          "hair-spa": 45,
        },
        serviceCharge: {
          beard: 180,
          "hair-beard": 400,
          "hair-spa": 500,
        },
      },
    ],
  },

  {
    id: "salon-002",
    name: "Envi Men Hair Lounge",
    category: "For Men",
    rating: "4.7",
    address: "100 Feet Road, HAL 2nd Stage, Bengaluru",
    lat: 12.9716,
    lng: 77.6498,
    peopleAhead: 3,

    schedule: {
      monday: { open: "10:00", close: "20:00", active: true },
      tuesday: { open: "10:00", close: "20:00", active: true },
      wednesday: { open: "10:00", close: "20:00", active: true },
      thursday: { open: "10:00", close: "20:00", active: true },
      friday: { open: "10:00", close: "20:00", active: true },
      saturday: { open: "10:00", close: "21:00", active: true },
      sunday: { open: "10:00", close: "18:00", active: true },
    },

    staff: [
      {
        id: "staff-004",
        name: "Arjun Das",
        services: ["haircut", "beard", "hair-beard"],
        startTime: "10:00",
        endTime: "18:00",
        serviceDuration: {
          haircut: 30,
          beard: 20,
          "hair-beard": 45,
        },
        serviceCharge: {
          haircut: 250,
          beard: 150,
          "hair-beard": 350,
        },
      },
      {
        id: "staff-005",
        name: "Rohit Mehta",
        services: ["haircut", "facial"],
        startTime: "12:00",
        endTime: "20:00",
        serviceDuration: {
          haircut: 30,
          facial: 45,
        },
        serviceCharge: {
          haircut: 300,
          facial: 450,
        },
      },
    ],
  },

  {
    id: "salon-003",
    name: "Jawad Habib Men Saloon",
    category: "For Men",
    rating: "4.6",
    address: "CMH Road, Indiranagar, Bengaluru",
    lat: 12.9784,
    lng: 77.6387,
    peopleAhead: 5,

    schedule: {
      monday: { open: "10:00", close: "20:00", active: true },
      tuesday: { open: "10:00", close: "20:00", active: true },
      wednesday: { open: "10:00", close: "20:00", active: true },
      thursday: { open: "10:00", close: "20:00", active: true },
      friday: { open: "10:00", close: "20:00", active: true },
      saturday: { open: "10:00", close: "21:00", active: true },
      sunday: { open: "11:00", close: "18:00", active: true },
    },

    staff: [
      {
        id: "staff-006",
        name: "Sahil Khan",
        services: ["haircut", "beard", "hair-beard"],
        startTime: "10:00",
        endTime: "18:00",
        serviceDuration: {
          haircut: 30,
          beard: 20,
          "hair-beard": 45,
        },
        serviceCharge: {
          haircut: 250,
          beard: 150,
          "hair-beard": 350,
        },
      },
      {
        id: "staff-007",
        name: "Imran Ali",
        services: ["haircut", "hair-color", "hair-beard"],
        startTime: "11:00",
        endTime: "19:00",
        serviceDuration: {
          haircut: 30,
          "hair-color": 60,
          "hair-beard": 45,
        },
        serviceCharge: {
          haircut: 300,
          "hair-color": 700,
          "hair-beard": 400,
        },
      },
    ],
  },

  {
    id: "salon-004",
    name: "The Barber Club & Grooming",
    category: "For Men",
    rating: "4.9",
    address: "Domlur Layout, Bengaluru",
    lat: 12.9602,
    lng: 77.6387,
    peopleAhead: 2,

    schedule: {
      monday: { open: "09:00", close: "19:00", active: true },
      tuesday: { open: "09:00", close: "19:00", active: true },
      wednesday: { open: "09:00", close: "19:00", active: true },
      thursday: { open: "09:00", close: "19:00", active: true },
      friday: { open: "09:00", close: "19:00", active: true },
      saturday: { open: "09:00", close: "20:00", active: true },
      sunday: { open: "10:00", close: "18:00", active: true },
    },

    staff: [
      {
        id: "staff-008",
        name: "Karan Verma",
        services: ["haircut", "beard", "hair-beard"],
        startTime: "09:00",
        endTime: "17:00",
        serviceDuration: {
          haircut: 35,
          beard: 25,
          "hair-beard": 50,
        },
        serviceCharge: {
          haircut: 300,
          beard: 180,
          "hair-beard": 400,
        },
      },
      {
        id: "staff-009",
        name: "Deepak Roy",
        services: ["haircut", "facial", "beard"],
        startTime: "11:00",
        endTime: "20:00",
        serviceDuration: {
          haircut: 35,
          facial: 40,
          beard: 25,
        },
        serviceCharge: {
          haircut: 350,
          facial: 500,
          beard: 200,
        },
      },
    ],
  },

  {
    id: "salon-005",
    name: "Urban Cut Saloon",
    category: "For Men",
    rating: "4.5",
    address: "Thippasandra Main Road, Bengaluru",
    lat: 12.9787,
    lng: 77.6536,
    peopleAhead: 8,

    schedule: {
      monday: { open: "10:00", close: "20:00", active: true },
      tuesday: { open: "10:00", close: "20:00", active: true },
      wednesday: { open: "10:00", close: "20:00", active: true },
      thursday: { open: "10:00", close: "20:00", active: true },
      friday: { open: "10:00", close: "20:00", active: true },
      saturday: { open: "10:00", close: "21:00", active: true },
      sunday: { open: "10:00", close: "18:00", active: true },
    },

    staff: [
      {
        id: "staff-010",
        name: "Manish Kumar",
        services: ["haircut", "beard", "hair-beard"],
        startTime: "10:00",
        endTime: "18:00",
        serviceDuration: {
          haircut: 30,
          beard: 20,
          "hair-beard": 45,
        },
        serviceCharge: {
          haircut: 250,
          beard: 150,
          "hair-beard": 350,
        },
      },
      {
        id: "staff-011",
        name: "Ankit Sharma",
        services: ["haircut", "hair-spa"],
        startTime: "11:00",
        endTime: "19:00",
        serviceDuration: {
          haircut: 30,
          "hair-spa": 45,
        },
        serviceCharge: {
          haircut: 300,
          "hair-spa": 550,
        },
      },
    ],
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

function getTodayKey() {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return days[new Date().getDay()];
}

function formatTime(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":").map(Number);

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function getTodayStatus(salon) {
  const todayKey = getTodayKey();
  const today = salon.schedule?.[todayKey];

  if (!today || !today.active) {
    return {
      status: "closed",
      label: "Today Closed",
      time: null,
    };
  }

  const now = new Date();

  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  const [openHour, openMinute] = today.open
    .split(":")
    .map(Number);

  const [closeHour, closeMinute] = today.close
    .split(":")
    .map(Number);

  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  const isOpenNow =
    currentMinutes >= openMinutes &&
    currentMinutes < closeMinutes;

  return {
    status: isOpenNow ? "open" : "closed",
    label: isOpenNow ? "Open Now" : "Closed Now",
    time: `${formatTime(today.open)} - ${formatTime(today.close)}`,
  };
}

export default function SalonsPage() {
  const { data: session, status } = useSession();

  const [location, setLocation] = useState("Select Location");
  const [search, setSearch] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(timer);
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

  const filteredSalons = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return salons
      .map((salon) => {
        const distance = userCoordinates
          ? calculateDistance(
              userCoordinates.lat,
              userCoordinates.lng,
              salon.lat,
              salon.lng
            )
          : null;

        return {
          ...salon,
          distance,
          todayStatus: getTodayStatus(salon),
        };
      })
      .filter((salon) =>
        salon.name.toLowerCase().includes(searchText)
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
  }, [search, userCoordinates, currentTime]);

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
                  Saloon
                </span>

                <span className="text-xs text-gray-400">
                  {filteredSalons.length} saloons nearby
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                Saloons Near You
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Select any saloon to view available grooming and
                beauty services.
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
                  placeholder="Search saloon by name..."
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
                  className="flex h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md sm:min-w-[230px]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <MapPin
                      size={17}
                      className="text-indigo-600"
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

        {filteredSalons.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Search size={21} className="text-gray-400" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No saloons found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try searching with a different saloon name.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredSalons.map((salon) => (
              <div
                key={salon.id}
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

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          salon.todayStatus.status === "open"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {salon.todayStatus.label}
                      </span>
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
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
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
                      <div
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${
                          salon.todayStatus.status === "open"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <Clock size={15} />

                        {salon.todayStatus.time
                          ? `Today: ${salon.todayStatus.time}`
                          : "Not working today"}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 sm:text-sm">
                        <Users size={15} />

                        {salon.peopleAhead === 0
                          ? "No one ahead"
                          : `${salon.peopleAhead} ${
                              salon.peopleAhead === 1
                                ? "person"
                                : "people"
                            } ahead`}
                      </div>

                      {/*{salon.peopleAhead <= 3 && (
                        <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 sm:text-sm">
                          Short queue
                        </span>
                      )}

                      {salon.peopleAhead > 3 && (
                        <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 sm:text-sm">
                          Busy
                        </span>
                      )}*/}
                    </div>
                  </div>

                  <div className="w-full md:w-auto md:shrink-0">
                    <Link
                      href={`/services/saloons/${salon.id
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "")}`}
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

      <GoUpButton />
    </main>
  );
}

