"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import LoadingScreen from "@/components/LoadingScreen";
import GoUpButton from "@/components/GoUpButton";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FlaskConical,
  MapPin,
  Navigation,
  Star,
  Users,
  X,
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
    tests: [
      {
        id: "cbc",
        name: "Complete Blood Count",
        description: "Complete blood analysis including hemoglobin, RBC and WBC.",
        duration: "20 min",
        price: 350,
      },
      {
        id: "thyroid",
        name: "Thyroid Profile",
        description: "TSH, T3 and T4 testing for thyroid function.",
        duration: "30 min",
        price: 600,
      },
      {
        id: "liver",
        name: "Liver Function Test",
        description: "Blood test to evaluate liver health and function.",
        duration: "30 min",
        price: 700,
      },
      {
        id: "kidney",
        name: "Kidney Function Test",
        description: "Tests to assess kidney function and related markers.",
        duration: "30 min",
        price: 650,
      },
    ],
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
    tests: [
      {
        id: "thyroid",
        name: "Thyroid Profile",
        description: "Complete thyroid hormone profile with TSH, T3 and T4.",
        duration: "30 min",
        price: 600,
      },
      {
        id: "diabetes",
        name: "Diabetes Screening",
        description: "Blood glucose and HbA1c testing for diabetes screening.",
        duration: "20 min",
        price: 450,
      },
      {
        id: "vitamin-d",
        name: "Vitamin D Test",
        description: "Blood test to measure vitamin D levels.",
        duration: "20 min",
        price: 800,
      },
      {
        id: "lipid",
        name: "Lipid Profile",
        description: "Cholesterol and triglyceride assessment.",
        duration: "25 min",
        price: 500,
      },
    ],
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
    tests: [
      {
        id: "cbc",
        name: "Complete Blood Count",
        description: "Detailed blood cell and hemoglobin analysis.",
        duration: "20 min",
        price: 350,
      },
      {
        id: "full-body",
        name: "Full Body Checkup",
        description: "Comprehensive health screening package.",
        duration: "60 min",
        price: 1800,
      },
      {
        id: "liver",
        name: "Liver Function Test",
        description: "Complete liver health assessment.",
        duration: "30 min",
        price: 700,
      },
      {
        id: "kidney",
        name: "Kidney Function Test",
        description: "Complete kidney function assessment.",
        duration: "30 min",
        price: 650,
      },
    ],
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
    tests: [
      {
        id: "cbc",
        name: "Complete Blood Count",
        description: "Basic blood test covering major blood parameters.",
        duration: "20 min",
        price: 350,
      },
      {
        id: "sugar",
        name: "Blood Sugar Test",
        description: "Blood glucose testing for diabetes screening.",
        duration: "10 min",
        price: 120,
      },
      {
        id: "lipid",
        name: "Lipid Profile",
        description: "Complete cholesterol and lipid assessment.",
        duration: "25 min",
        price: 500,
      },
      {
        id: "urine",
        name: "Urine Routine Test",
        description: "Routine urine examination for common health indicators.",
        duration: "20 min",
        price: 150,
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

export default function DiagnosticLabDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [location, setLocation] = useState("Select Location");
  const [selectedTest, setSelectedTest] = useState(null);

  const lab = useMemo(() => {
    return diagnosticLabs.find((item) => item.id === params.id);
  }, [params.id]);

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

  const distance = useMemo(() => {
    if (!lab || !userCoordinates) return null;

    return calculateDistance(
      userCoordinates.lat,
      userCoordinates.lng,
      lab.lat,
      lab.lng
    );
  }, [lab, userCoordinates]);

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!lab) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={true} />

        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <FlaskConical className="h-7 w-7 text-gray-400" />
            </div>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Diagnostic centre not found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              The diagnostic centre you are looking for does not exist.
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const estimatedWait =
    lab.peopleAhead === 0
      ? 0
      : lab.peopleAhead * 15;

  const shortLocation =
    location.split(",")[0].trim() || "Select Location";

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={true} />

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Diagnostic Centres
          </button>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                      Diagnostic Centre
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {lab.rating}
                    </span>
                  </div>

                  <h1 className="mt-3 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                    {lab.name}
                  </h1>

                  <div className="mt-3 flex items-start gap-2 text-sm text-gray-500">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />

                    <span className="leading-6">
                      {lab.address}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700">
                      <span>🧑‍⚕️</span>
                      {lab.doctor}
                    </span>

                    <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600">
                      {lab.specialization}
                    </span>
                  </div>
                </div>

                <div className="w-full rounded-xl border border-indigo-100 bg-white p-4 shadow-sm lg:max-w-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Current Queue
                      </p>

                      <p className="text-lg font-bold text-gray-900">
                        {lab.peopleAhead === 0
                          ? "No queue"
                          : `${lab.peopleAhead} ${
                              lab.peopleAhead === 1
                                ? "person"
                                : "people"
                            } ahead`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {lab.peopleAhead <= 3 ? (
                      <span className="inline-flex rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                        Short queue
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                        Busy
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-gray-100 border-t border-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex items-center gap-3 p-4 sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    People Ahead
                  </p>

                  <p className="font-semibold text-gray-900">
                    {lab.peopleAhead}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Estimated Wait
                  </p>

                  <p className="font-semibold text-gray-900">
                    {estimatedWait === 0
                      ? "No waiting"
                      : `~${estimatedWait} min`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                  <Navigation className="h-5 w-5 text-indigo-600" />
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    Distance
                  </p>

                  <p className="font-semibold text-gray-900">
                    {distance === null
                      ? "Unavailable"
                      : distance < 1
                      ? `${Math.round(distance * 1000)} m`
                      : `${distance.toFixed(1)} km`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                    <FlaskConical className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Available Tests
                    </h2>

                    <p className="text-sm text-gray-500">
                      Select a test to book your diagnostic appointment
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {lab.tests.map((test) => (
                  <div
                    key={test.id}
                    className="p-5 transition hover:bg-gray-50 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                            <FlaskConical className="h-5 w-5 text-indigo-600" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900">
                              {test.name}
                            </h3>

                            <p className="mt-1 text-sm leading-5 text-gray-500">
                              {test.description}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                <Clock className="h-3.5 w-3.5" />
                                {test.duration}
                              </span>

                              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                                ₹{test.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedTest(test)}
                        className="h-11 w-full shrink-0 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] sm:w-auto"
                      >
                        Book Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-gray-900">
                Queue Status
              </h3>

              <div className="mt-4 rounded-xl bg-indigo-50 p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-indigo-600" />

                  <div>
                    <p className="text-xs text-indigo-600">
                      Current Queue
                    </p>

                    <p className="font-bold text-indigo-900">
                      {lab.peopleAhead}{" "}
                      {lab.peopleAhead === 1
                        ? "person"
                        : "people"}{" "}
                      ahead
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />

                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    Estimated waiting time
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Approximately {estimatedWait} minutes based on the
                    current queue.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-gray-900">
                Location
              </h3>

              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                  <MapPin className="h-5 w-5 text-red-500" />
                </div>

                <div>
                  <p className="text-sm font-medium leading-6 text-gray-700">
                    {lab.address}
                  </p>

                  {distance !== null && (
                    <p className="mt-1 text-xs text-gray-500">
                      {distance < 1
                        ? `${Math.round(distance * 1000)} m away`
                        : `${distance.toFixed(1)} km away`}{" "}
                      from {shortLocation}
                    </p>
                  )}
                </div>
              </div>

              <a
                href={`https://www.google.com/maps?q=${lab.lat},${lab.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Navigation className="h-4 w-4" />
                View on Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      <GoUpButton />

      {selectedTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  Confirm Test
                </p>

                <h3 className="mt-1 text-lg font-bold text-gray-900">
                  {selectedTest.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTest(null)}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  {lab.name}
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {lab.address}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Test
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {selectedTest.name}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs text-gray-500">
                    Price
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    ₹{selectedTest.price}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

                  <div>
                    <p className="text-sm font-semibold text-indigo-900">
                      Current queue
                    </p>

                    <p className="mt-1 text-xs leading-5 text-indigo-700">
                      {lab.peopleAhead === 0
                        ? "There is currently no queue."
                        : `${lab.peopleAhead} ${
                            lab.peopleAhead === 1
                              ? "person is"
                              : "people are"
                          } ahead of you.`}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/services/diagnostic-labs/${lab.id}/book?test=${selectedTest.id}`
                  )
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                <CalendarDays className="h-4 w-4" />
                Continue Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}