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
  Sparkles,
  Navigation,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import GoUpButton from "@/components/GoUpButton";
import LoadingScreen from "@/components/LoadingScreen";

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
    services: [
      {
        id: "haircut",
        name: "Haircut & Styling",
        description: "Professional haircut with styling",
        duration: "40 min",
        price: 350,
      },
      {
        id: "facial",
        name: "Glow Facial",
        description: "Refreshing facial for healthy glowing skin",
        duration: "45 min",
        price: 600,
      },
      {
        id: "waxing",
        name: "Full Arm Waxing",
        description: "Smooth and gentle full arm waxing",
        duration: "30 min",
        price: 300,
      },
      {
        id: "cleanup",
        name: "Face Cleanup",
        description: "Deep cleansing and skin cleanup",
        duration: "30 min",
        price: 400,
      },
      {
        id: "hair-spa",
        name: "Hair Spa",
        description: "Nourishing hair spa and conditioning",
        duration: "50 min",
        price: 700,
      },
    ],
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
    services: [
      {
        id: "haircut",
        name: "Haircut",
        description: "Classic and modern haircut",
        duration: "35 min",
        price: 300,
      },
      {
        id: "facial",
        name: "Classic Facial",
        description: "Complete facial cleansing and massage",
        duration: "45 min",
        price: 550,
      },
      {
        id: "threading",
        name: "Eyebrow Threading",
        description: "Precise eyebrow shaping",
        duration: "15 min",
        price: 100,
      },
      {
        id: "waxing",
        name: "Full Leg Waxing",
        description: "Smooth full leg waxing service",
        duration: "40 min",
        price: 450,
      },
      {
        id: "manicure",
        name: "Manicure",
        description: "Nail shaping, cleaning and massage",
        duration: "40 min",
        price: 350,
      },
    ],
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
    services: [
      {
        id: "haircut",
        name: "Haircut & Styling",
        description: "Haircut with professional styling",
        duration: "40 min",
        price: 280,
      },
      {
        id: "facial",
        name: "Herbal Facial",
        description: "Natural herbal facial treatment",
        duration: "50 min",
        price: 500,
      },
      {
        id: "threading",
        name: "Eyebrow & Upper Lip",
        description: "Eyebrow and upper lip threading",
        duration: "20 min",
        price: 120,
      },
      {
        id: "pedicure",
        name: "Pedicure",
        description: "Relaxing foot care and nail treatment",
        duration: "45 min",
        price: 400,
      },
    ],
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
    services: [
      {
        id: "haircut",
        name: "Haircut",
        description: "Professional haircut and styling",
        duration: "35 min",
        price: 300,
      },
      {
        id: "facial",
        name: "Herbal Glow Facial",
        description: "Herbal skin treatment for natural glow",
        duration: "50 min",
        price: 650,
      },
      {
        id: "hair-spa",
        name: "Herbal Hair Spa",
        description: "Natural hair nourishment and conditioning",
        duration: "50 min",
        price: 600,
      },
      {
        id: "manicure",
        name: "Manicure",
        description: "Complete hand and nail care",
        duration: "40 min",
        price: 350,
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
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (peopleAhead <= 6) {
    return {
      label: "Moderate queue",
      className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    };
  }

  return {
    label: "Busy",
    className: "border-red-200 bg-red-50 text-red-700",
  };
}

export default function ParlourDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [location, setLocation] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  const parlour = useMemo(() => {
    return parlours.find((item) => item.id === params.id);
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
      !parlour ||
      typeof userLatitude !== "number" ||
      typeof userLongitude !== "number"
    ) {
      return null;
    }

    return calculateDistance(
      userLatitude,
      userLongitude,
      parlour.lat,
      parlour.lng
    );
  }, [parlour, userLatitude, userLongitude]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!parlour) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header />

        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
              <Sparkles className="h-7 w-7 text-pink-500" />
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              Parlour not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              The parlour you are looking for does not exist.
            </p>

            <button
              onClick={() => router.back()}
              className="mt-6 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
            >
              Go Back
            </button>
          </div>
        </div>

        <GoUpButton />
      </main>
    );
  }

  const queueStatus = getQueueStatus(parlour.peopleAhead);

  const handleBook = (service) => {
    setSelectedService(service);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <Header />

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-pink-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Parlours
        </button>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-5 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                    {parlour.category}
                  </span>

                  <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-800">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {parlour.rating}
                  </span>
                </div>

                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {parlour.name}
                </h1>

                <div className="mt-3 flex items-start gap-2 text-sm text-pink-100">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{parlour.address}</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm sm:min-w-[180px]">
                <div className="flex items-center gap-2 text-pink-100">
                  <Users className="h-5 w-5" />
                  <span className="text-sm">People ahead</span>
                </div>

                <p className="mt-1 text-3xl font-bold text-white">
                  {parlour.peopleAhead}
                </p>

                <span className="text-xs text-pink-100">
                  {queueStatus.label}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50">
                <Users className="h-5 w-5 text-pink-600" />
              </div>

              <div>
                <p className="text-xs text-gray-500">Current queue</p>
                <p className="font-semibold text-gray-900">
                  {parlour.peopleAhead} people
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
                  {parlour.peopleAhead * 15}-
                  {parlour.peopleAhead * 20} min
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
          </div>
        </section>

        <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[1fr_320px]">
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Beauty & Wellness Services
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Select a service to book your queue token.
              </p>
            </div>

            <div className="space-y-3">
              {parlour.services.map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-pink-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-50">
                        <Sparkles className="h-5 w-5 text-pink-600" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">
                          {service.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {service.description}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {service.duration}
                          </span>

                          <span className="font-semibold text-gray-800">
                            ₹{service.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBook(service)}
                      className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
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
                    {parlour.peopleAhead}
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
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-pink-600" />

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">
                    Location
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    {parlour.address}
                  </p>

                  {distance !== null && (
                    <p className="mt-2 text-sm font-medium text-pink-600">
                      {formatDistance(distance)} away
                    </p>
                  )}

                  <a
                    href={`https://www.google.com/maps?q=${parlour.lat},${parlour.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
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
                  ₹{selectedService.price}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                {selectedService.duration}
              </div>

              <p className="mt-2 text-sm text-gray-500">
                {parlour.name}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-pink-100 bg-pink-50 p-4">
              <div className="flex items-center gap-2 text-pink-700">
                <Users className="h-5 w-5" />

                <span className="font-semibold">
                  {parlour.peopleAhead} people currently ahead
                </span>
              </div>

              <p className="mt-1 text-xs text-pink-600">
                You will receive your queue token after confirmation.
              </p>
            </div>

            <button
              onClick={() => {
                router.push(
                  `/services/parlours/${parlour.id}/book?service=${selectedService.id}`
                );
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-3 font-semibold text-white transition hover:bg-pink-700"
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