 
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import {
  ArrowLeft,
  MapPin,
  Star,
  Users,
  Clock,
  Scissors,
  Navigation,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import GoUpButton from "@/components/GoUpButton";
import LoadingScreen from "@/components/LoadingScreen";

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
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatDistance(distance) {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
}

function getQueueStatus(peopleAhead) {
  if (peopleAhead <= 3) {
    return {
      label: "Short queue",
      className: "bg-green-50 text-green-700 border-green-200",
    };
  }

  if (peopleAhead <= 6) {
    return {
      label: "Moderate queue",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    };
  }

  return {
    label: "Busy",
    className: "bg-red-50 text-red-700 border-red-200",
  };
}

const serviceNames = {
  haircut: "Haircut",
  beard: "Beard Trim",
  "hair-beard": "Haircut + Beard",
  "hair-spa": "Hair Spa",
  facial: "Men's Facial",
  "hair-color": "Hair Color",
};

const serviceDescriptions = {
  haircut: "Professional haircut and styling",
  beard: "Professional beard shaping and trimming",
  "hair-beard": "Complete haircut and beard grooming",
  "hair-spa": "Deep conditioning and hair treatment",
  facial: "Refreshing facial treatment",
  "hair-color": "Professional hair coloring service",
};

function formatTime(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  const date = new Date();

  date.setHours(Number(hour), Number(minute), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getTodaySchedule(schedule) {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const today = days[new Date().getDay()];

  return {
    day: today,
    data: schedule?.[today],
  };
}

function buildServices(staff) {
  const serviceMap = {};

  staff.forEach((member) => {
    member.services.forEach((serviceId) => {
      const duration = member.serviceDuration?.[serviceId];
      const charge = member.serviceCharge?.[serviceId];

      if (duration == null || charge == null) return;

      if (!serviceMap[serviceId]) {
        serviceMap[serviceId] = {
          id: serviceId,
          name: serviceNames[serviceId] || serviceId,
          description:
            serviceDescriptions[serviceId] ||
            "Professional grooming service",
          durations: [],
          charges: [],
          staff: [],
        };
      }

      serviceMap[serviceId].durations.push(duration);
      serviceMap[serviceId].charges.push(charge);
      serviceMap[serviceId].staff.push({
        id: member.id,
        name: member.name,
        startTime: member.startTime,
        endTime: member.endTime,
      });
    });
  });

  return Object.values(serviceMap).map((service) => {
    const minDuration = Math.min(...service.durations);
    const maxDuration = Math.max(...service.durations);

    const minCharge = Math.min(...service.charges);
    const maxCharge = Math.max(...service.charges);

    return {
      ...service,
      minDuration,
      maxDuration,
      minCharge,
      maxCharge,
    };
  });
}

function formatDuration(min, max) {
  if (min === max) {
    return `${min} min`;
  }

  return `${min}-${max} min`;
}

function formatCharge(min, max) {
  if (min === max) {
    return `₹${min}`;
  }

  return `₹${min} - ₹${max}`;
}

export default function SalonDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [location, setLocation] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  const salon = useMemo(() => {
    return salons.find((item) => item.id === params.id);
  }, [params.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("queueease-location");

      if (saved) {
        setLocation(JSON.parse(saved));
      }
    } catch {
      setLocation(null);
    }
  }, []);

  const userLatitude =
    session?.user?.latitude ??
    session?.user?.lat ??
    location?.lat ??
    location?.latitude;

  const userLongitude =
    session?.user?.longitude ??
    session?.user?.lng ??
    location?.lng ??
    location?.longitude;

  const distance = useMemo(() => {
    if (
      !salon ||
      !Number.isFinite(Number(userLatitude)) ||
      !Number.isFinite(Number(userLongitude))
    ) {
      return null;
    }

    return calculateDistance(
      Number(userLatitude),
      Number(userLongitude),
      salon.lat,
      salon.lng
    );
  }, [salon, userLatitude, userLongitude]);

  const services = useMemo(() => {
    if (!salon) return [];

    return buildServices(salon.staff);
  }, [salon]);

  const todaySchedule = useMemo(() => {
    if (!salon) return null;

    return getTodaySchedule(salon.schedule);
  }, [salon]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!salon) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />

        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Scissors className="h-7 w-7 text-gray-400" />
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              Salon not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              The salon you are looking for does not exist.
            </p>

            <button
              onClick={() => router.back()}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const queueStatus = getQueueStatus(salon.peopleAhead);

  const handleBook = (service) => {
    setSelectedService(service);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Salons
        </button>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    {salon.category}
                  </span>

                  <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-800">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {salon.rating}
                  </span>
                </div>

                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {salon.name}
                </h1>

                <div className="mt-3 flex items-start gap-2 text-sm text-indigo-100">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{salon.address}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm sm:min-w-[180px]">
                <div className="flex items-center gap-2 text-indigo-100">
                  <Users className="h-5 w-5" />
                  <span className="text-sm">People ahead</span>
                </div>

                <p className="mt-1 text-3xl font-bold text-white">
                  {salon.peopleAhead}
                </p>

                <span className="text-xs text-indigo-100">
                  {queueStatus.label}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500">Current queue</p>
                <p className="font-semibold text-gray-900">
                  {salon.peopleAhead} people
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                <Clock className="h-5 w-5 text-green-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500">Estimated wait</p>
                <p className="font-semibold text-gray-900">
                  {salon.peopleAhead * 10}-{salon.peopleAhead * 15} min
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Navigation className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500">Distance</p>
                <p className="font-semibold text-gray-900">
                  {distance !== null
                    ? formatDistance(distance)
                    : "Location unavailable"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500">Today</p>

                {todaySchedule?.data?.active ? (
                  <p className="font-semibold text-gray-900">
                    {formatTime(todaySchedule.data.open)} -{" "}
                    {formatTime(todaySchedule.data.close)}
                  </p>
                ) : (
                  <p className="font-semibold text-red-600">
                    Closed today
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[1fr_320px]">
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Available Services
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Service time and charges may vary depending on the staff
                member.
              </p>
            </div>

            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                        <Scissors className="h-5 w-5 text-indigo-600" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">
                          {service.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {service.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDuration(
                              service.minDuration,
                              service.maxDuration
                            )}
                          </span>

                          <span className="inline-flex rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700">
                            {formatCharge(
                              service.minCharge,
                              service.maxCharge
                            )}
                          </span>

                          <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700">
                            {service.staff.length}{" "}
                            {service.staff.length === 1
                              ? "staff"
                              : "staff"}{" "}
                            available
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBook(service)}
                      className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Book
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="h-fit space-y-4 lg:sticky lg:top-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Queue Status
              </h3>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    People currently waiting
                  </span>

                  <span className="text-lg font-bold text-gray-900">
                    {salon.peopleAhead}
                  </span>
                </div>

                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${queueStatus.className}`}
                  >
                    {queueStatus.label}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-gray-600">
                    Join the queue remotely
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-gray-600">
                    Track your token position
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-gray-600">
                    Get notified when your turn is near
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">
                    Working Hours
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Today:{" "}
                    <span className="font-medium capitalize">
                      {todaySchedule?.day}
                    </span>
                  </p>

                  {todaySchedule?.data?.active ? (
                    <p className="mt-2 text-sm font-semibold text-green-600">
                      {formatTime(todaySchedule.data.open)} -{" "}
                      {formatTime(todaySchedule.data.close)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-red-600">
                      Closed today
                    </p>
                  )}

                  <div className="mt-4 space-y-2">
                    {Object.entries(salon.schedule).map(
                      ([day, schedule]) => (
                        <div
                          key={day}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="capitalize text-gray-500">
                            {day}
                          </span>

                          {schedule.active ? (
                            <span className="font-medium text-gray-700">
                              {formatTime(schedule.open)} -{" "}
                              {formatTime(schedule.close)}
                            </span>
                          ) : (
                            <span className="font-medium text-red-500">
                              Closed
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">
                    Location
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    {salon.address}
                  </p>

                  {distance !== null && (
                    <p className="mt-2 text-sm font-medium text-indigo-600">
                      {formatDistance(distance)} away
                    </p>
                  )}

                  <a
                    href={`https://www.google.com/maps?q=${salon.lat},${salon.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <Navigation className="h-4 w-4" />
                    View on Google Maps
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Confirm Service
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Review your selection before joining the queue.
                </p>
              </div>

              <button
                onClick={() => setSelectedService(null)}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-900">
                  {selectedService.name}
                </span>

                <span className="font-bold text-gray-900">
                  {formatCharge(
                    selectedService.minCharge,
                    selectedService.maxCharge
                  )}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                <Clock className="h-4 w-4" />

                {formatDuration(
                  selectedService.minDuration,
                  selectedService.maxDuration
                )}
              </div>

              <p className="mt-2 text-sm text-gray-500">
                {salon.name}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <Users className="h-5 w-5" />

                <span className="font-semibold">
                  {salon.peopleAhead} people currently ahead
                </span>
              </div>

              <p className="mt-1 text-xs text-indigo-600">
                You will receive your queue token after confirmation.
              </p>
            </div>

            <button
              onClick={() => {
                router.push(
                  `/services/salons/${salon.id}/book?service=${selectedService.id}`
                );
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Continue Booking
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <GoUpButton />
    </main>
  );
}

