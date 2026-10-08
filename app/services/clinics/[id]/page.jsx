"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

const clinics = [
  {
    id: "clinic-101",
    name: "Sunrise Family Care Clinic",
    rating: "4.8",
    address: "Salt Lake Sector V, Kolkata",
    lat: 22.5726,
    lng: 88.4331,

    doctors: [
      {
        id: "doctor-101",
        name: "Dr. Arindam Sen",
        specialization: "MBBS, MD",
        experience: 11,
        duration: 30,

        schedule: {
          monday: {
            slots: [
              { open: "9:00 AM", close: "12:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          tuesday: {
            slots: [
              { open: "9:00 AM", close: "12:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          wednesday: {
            slots: [],
            active: false,
          },
          thursday: {
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "4:00 PM", close: "7:00 PM" },
            ],
            active: true,
          },
          friday: {
            slots: [
              { open: "9:30 AM", close: "12:30 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          saturday: {
            slots: [
              { open: "10:00 AM", close: "2:00 PM" },
            ],
            active: true,
          },
          sunday: {
            slots: [],
            active: false,
          },
        },

        bookings: [
          {
            token: "A101",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Rahul Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "A102",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Mita Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "A103",
            date: "2026-10-05",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Rohan Das",
              type: "child",
            },
            status: "serving",
          },
          {
            token: "A104",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Ankit Roy",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "A105",
            date: "2026-10-05",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Priya Roy",
              type: "elderly",
            },
            status: "waiting",
          },

          {
            token: "A106",
            date: "2026-10-06",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Suman Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "A107",
            date: "2026-10-06",
            slot: {
              open: "9:00 AM",
              close: "12:00 PM",
            },
            patient: {
              name: "Riya Das",
              type: "child",
            },
            status: "waiting",
          },
          {
            token: "A108",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Amit Sen",
              type: "self",
            },
            status: "waiting",
          },
        ],
      },

      {
        id: "doctor-102",
        name: "Dr. Priyanka Roy",
        specialization: "Dermatology",
        experience: 8,
        duration: 20,

        schedule: {
          monday: {
            slots: [
              { open: "4:00 PM", close: "7:00 PM" },
            ],
            active: true,
          },
          tuesday: {
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          wednesday: {
            slots: [
              { open: "4:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          thursday: {
            slots: [],
            active: false,
          },
          friday: {
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          saturday: {
            slots: [
              { open: "2:00 PM", close: "6:00 PM" },
            ],
            active: true,
          },
          sunday: {
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
            ],
            active: true,
          },
        },

        bookings: [
          {
            token: "B101",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Sneha Roy",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "B102",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Ayan Roy",
              type: "child",
            },
            status: "waiting",
          },
          {
            token: "B103",
            date: "2026-10-05",
            slot: {
              open: "4:00 PM",
              close: "7:00 PM",
            },
            patient: {
              name: "Sourav Ghosh",
              type: "self",
            },
            status: "waiting",
          },

          {
            token: "B104",
            date: "2026-10-06",
            slot: {
              open: "10:00 AM",
              close: "1:00 PM",
            },
            patient: {
              name: "Puja Roy",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "B105",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Ayan Sen",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "B106",
            date: "2026-10-06",
            slot: {
              open: "5:00 PM",
              close: "8:00 PM",
            },
            patient: {
              name: "Moumita Das",
              type: "child",
            },
            status: "waiting",
          },
        ],
      },
    ],
  },

  {
    id: "clinic-102",
    name: "Green Valley Medical Centre",
    rating: "4.6",
    address: "New Town, Kolkata",
    lat: 22.5958,
    lng: 88.4797,

    doctors: [
      {
        id: "doctor-103",
        name: "Dr. Sayan Mukherjee",
        specialization: "Orthopedics",
        experience: 14,
        duration: 40,

        schedule: {
          monday: {
            slots: [
              { open: "8:30 AM", close: "12:30 PM" },
              { open: "4:00 PM", close: "7:00 PM" },
            ],
            active: true,
          },
          tuesday: {
            slots: [
              { open: "8:30 AM", close: "12:30 PM" },
            ],
            active: true,
          },
          wednesday: {
            slots: [
              { open: "4:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          thursday: {
            slots: [
              { open: "9:00 AM", close: "1:00 PM" },
              { open: "5:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          friday: {
            slots: [],
            active: false,
          },
          saturday: {
            slots: [
              { open: "9:00 AM", close: "1:00 PM" },
            ],
            active: true,
          },
          sunday: {
            slots: [],
            active: false,
          },
        },

        bookings: [
          {
            token: "C101",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Amit Ghosh",
              type: "self",
            },
            status: "completed",
          },
          {
            token: "C102",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Rakesh Roy",
              type: "self",
            },
            status: "serving",
          },
          {
            token: "C103",
            date: "2026-10-05",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Mohan Das",
              type: "elderly",
            },
            status: "waiting",
          },

          {
            token: "C104",
            date: "2026-10-06",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Raj Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "C105",
            date: "2026-10-06",
            slot: {
              open: "8:30 AM",
              close: "12:30 PM",
            },
            patient: {
              name: "Sourav Das",
              type: "self",
            },
            status: "waiting",
          },
        ],
      },

      {
        id: "doctor-104",
        name: "Dr. Ishita Banerjee",
        specialization: "Gynecology",
        experience: 9,
        duration: 25,

        schedule: {
          monday: {
            slots: [
              { open: "3:00 PM", close: "6:00 PM" },
            ],
            active: true,
          },
          tuesday: {
            slots: [
              { open: "3:00 PM", close: "6:00 PM" },
            ],
            active: true,
          },
          wednesday: {
            slots: [
              { open: "10:00 AM", close: "1:00 PM" },
              { open: "4:00 PM", close: "7:00 PM" },
            ],
            active: true,
          },
          thursday: {
            slots: [],
            active: false,
          },
          friday: {
            slots: [
              { open: "3:00 PM", close: "8:00 PM" },
            ],
            active: true,
          },
          saturday: {
            slots: [
              { open: "10:00 AM", close: "2:00 PM" },
            ],
            active: true,
          },
          sunday: {
            slots: [
              { open: "11:00 AM", close: "2:00 PM" },
            ],
            active: true,
          },
        },

        bookings: [
          {
            token: "D101",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Puja Sen",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "D102",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Riya Sen",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "D103",
            date: "2026-10-05",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Ananya Sen",
              type: "child",
            },
            status: "waiting",
          },

          {
            token: "D104",
            date: "2026-10-06",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Riya Das",
              type: "self",
            },
            status: "waiting",
          },
          {
            token: "D105",
            date: "2026-10-06",
            slot: {
              open: "3:00 PM",
              close: "6:00 PM",
            },
            patient: {
              name: "Ananya Roy",
              type: "child",
            },
            status: "waiting",
          },
        ],
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

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function getTodayKey(date) {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  return days[date.getDay()];
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseTime(time) {
  if (!time) return 0;

  const [timePart, period] = time.split(" ");
  const [hours, minutes] = timePart.split(":").map(Number);

  let hour = hours;

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  return hour * 60 + minutes;
}

function getDoctorStatus(schedule, now) {
  const today = getTodayKey(now);
  const todaySchedule = schedule?.[today];

  if (
    !todaySchedule?.active ||
    !todaySchedule?.slots?.length
  ) {
    return {
      isOpen: false,
      text: "Closed today",
      currentSlot: null,
      nextSlot: null,
    };
  }

  const currentMinutes =
    now.getHours() * 60 + now.getMinutes();

  const currentSlot = todaySchedule.slots.find((slot) => {
    const open = parseTime(slot.open);
    const close = parseTime(slot.close);

    return (
      currentMinutes >= open &&
      currentMinutes < close
    );
  });

  if (currentSlot) {
    return {
      isOpen: true,
      text: `Open · Closes ${currentSlot.close}`,
      currentSlot,
      nextSlot: null,
    };
  }

  const nextSlot = todaySchedule.slots.find(
    (slot) =>
      currentMinutes < parseTime(slot.open)
  );

  if (nextSlot) {
    return {
      isOpen: false,
      text: `Closed · Opens ${nextSlot.open}`,
      currentSlot: null,
      nextSlot,
    };
  }

  return {
    isOpen: false,
    text: "Closed today",
    currentSlot: null,
    nextSlot: null,
  };
}

function getScheduleText(schedule) {
  if (
    !schedule?.active ||
    !schedule?.slots?.length
  ) {
    return "Closed Today";
  }

  return schedule.slots
    .map(
      (slot) => `${slot.open} - ${slot.close}`
    )
    .join(" / ");
}

function getPeopleAheadForSlot(doctor, todayDate, slot) {
  if (!doctor?.bookings?.length || !slot) {
    return 0;
  }

  return doctor.bookings.filter((booking) => {
    if (booking.date !== todayDate) {
      return false;
    }

    if (
      booking.slot?.open !== slot.open ||
      booking.slot?.close !== slot.close
    ) {
      return false;
    }

    return (
      booking.status === "waiting" ||
      booking.status === "serving"
    );
  }).length;
}

export default function ClinicDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [location, setLocation] =
    useState("Select location");

  const [selectedDoctor, setSelectedDoctor] =
    useState(null);

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const clinic = useMemo(() => {
    return clinics.find(
      (item) => item.id === params.id
    );
  }, [params.id]);

  useEffect(() => {
    const savedLocation = localStorage.getItem(
      "queueease-location"
    );

    if (!savedLocation) return;

    try {
      const parsed = JSON.parse(savedLocation);

      if (
        typeof parsed === "object" &&
        parsed
      ) {
        setLocation(
          parsed.address ||
            parsed.name ||
            parsed.location ||
            "Selected location"
        );
      } else {
        setLocation(String(parsed));
      }
    } catch {
      setLocation(savedLocation);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [selectedDoctor]);

  const userCoordinates = useMemo(() => {
    const latitude = Number(
      session?.user?.latitude
    );

    const longitude = Number(
      session?.user?.longitude
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return {
      lat: latitude,
      lng: longitude,
    };
  }, [
    session?.user?.latitude,
    session?.user?.longitude,
  ]);

  const distance = useMemo(() => {
    if (!clinic || !userCoordinates) {
      return null;
    }

    return calculateDistance(
      userCoordinates.lat,
      userCoordinates.lng,
      clinic.lat,
      clinic.lng
    );
  }, [clinic, userCoordinates]);

  const today = getTodayKey(currentTime);
  const todayDate =
    getLocalDateString(currentTime);

  const doctors = useMemo(() => {
    if (!clinic) return [];

    return clinic.doctors.map((doctor) => {
      const docStatus = getDoctorStatus(
        doctor.schedule,
        currentTime
      );

      return {
        ...doctor,
        status: docStatus,
      };
    });
  }, [clinic, currentTime]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
      </main>
    );
  }

  if (!clinic) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Header showBack={false} />

        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <X className="h-5 w-5 text-red-500" />
            </div>

            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Clinic not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              The clinic you are looking for does not
              exist.
            </p>

            <button
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showBack={false} />

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <button
          onClick={() => router.back()}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clinics
        </button>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {clinic.rating}
                  </span>

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {clinic.doctors.length} Doctors
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {clinic.name}
                </h1>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Clinic location
                      </p>

                      <p className="mt-0.5 text-sm font-semibold text-gray-700">
                        {clinic.address}
                      </p>
                    </div>
                  </div>

                  {distance !== null && (
                    <div className="hidden h-7 w-px bg-gray-200 sm:block" />
                  )}

                  {distance !== null && (
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-indigo-500" />

                      <span className="text-sm font-semibold text-gray-600">
                        {distance < 1
                          ? `${Math.round(
                              distance * 1000
                            )} m away`
                          : `${distance.toFixed(
                              1
                            )} km away`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <a
                href={`https://www.google.com/maps?q=${clinic.lat},${clinic.lng}`}
                target="_parent"
                rel="noopener noreferrer"
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 sm:w-auto"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </a>
            </div>
          </div>

          <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3.5 sm:px-7">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />

                <span className="text-xs text-gray-400">
                  Your location
                </span>

                <span
                  className="cursor-pointer truncate text-xs font-semibold text-gray-700 hover:underline"
                  onClick={() => {
                    router.replace("/profile");
                  }}
                >
                  {location.split(",")[0]}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900">
                    Doctors
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    Choose a doctor and book a consultation
                  </p>
                </div>

                <div className="hidden rounded-lg bg-gray-50 px-3 py-2 text-center sm:block">
                  <p className="text-[10px] text-gray-400">
                    Today
                  </p>

                  <p className="text-xs font-bold capitalize text-gray-700">
                    {today}
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {doctors.map((doctor) => {
                const todaySchedule =
                  doctor.schedule?.[today];

                return (
                  <article
                    key={doctor.id}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
  <div className="flex min-w-0 items-center gap-3">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
      <Stethoscope className="h-5 w-5 text-indigo-600" />
    </div>

    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-gray-900">
          {doctor.name}
        </h3>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            doctor.status.isOpen
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {doctor.status.isOpen ? "Available" : "Closed"}
        </span>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {doctor.specialization}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
          {doctor.experience} years experience
        </span>

        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
          ~{doctor.duration} min appointment
        </span>
      </div>
    </div>
  </div>

</div>
                      <div className="space-y-3">
                        {/* Slot-wise breakdown with times and people count aligned in the same row/flex container */}
                        {todaySchedule?.active && todaySchedule?.slots?.length > 0 ? (
                          <div className="space-y-2">
                            {todaySchedule.slots.map((slot, index) => {
                              const isCurrentActiveSlot =
                                doctor.status.isOpen &&
                                doctor.status.currentSlot?.open === slot.open &&
                                doctor.status.currentSlot?.close === slot.close;

                              const peopleCount = getPeopleAheadForSlot(
                                doctor,
                                todayDate,
                                slot
                              );

                              return (
                                <div
                                  key={index}
                                  className={`flex items-center justify-between rounded-xl border p-3.5 ${
                                    isCurrentActiveSlot
                                      ? "border-emerald-200 bg-emerald-50/40"
                                      : "border-gray-200 bg-gray-50/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800">
                                      {slot.open} - {slot.close}
                                    </span>
                                    {isCurrentActiveSlot && (
                                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-700">
                                        NOW
                                      </span>
                                    )}
                                  </div>

                                  <span className="text-sm font-bold text-orange-600">
                                    {peopleCount} {peopleCount === 1 ? "person ahead" : "people ahead"}

                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-xs font-medium text-gray-500">
                            Closed Today
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDoctor(doctor)
                          }
                          className="min-h-[40px] w-full rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
                        >
                          Book Consultation
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />

                  <h2 className="text-sm font-bold text-gray-900 sm:text-base">
                    Weekly Schedule
                  </h2>
                </div>

                <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">
                  Clinic doctor timings
                </p>
              </div>

              <div className="space-y-4 p-3 sm:space-y-5 sm:p-4">
                {doctors.map((doctor) => (
                  <div key={doctor.id}>
                    <p className="mb-1.5 px-1 text-[10px] font-bold text-gray-800 sm:text-[11px]">
                      {doctor.name}
                    </p>

                    <div className="space-y-1">
                      {Object.entries(
                        doctor.schedule
                      ).map(([day, schedule]) => {
                        const isToday =
                          day === today;

                        const scheduleText =
                          getScheduleText(
                            schedule
                          );

                        return (
                          <div
                            key={day}
                            className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 sm:px-3 sm:py-2 ${
                              isToday
                                ? "bg-indigo-50"
                                : ""
                            }`}
                          >
                            <span
                              className={`w-14 shrink-0 text-[9px] capitalize sm:w-16 sm:text-[10px] ${
                                isToday
                                  ? "font-bold text-indigo-700"
                                  : "text-gray-600"
                              }`}
                            >
                              {day}
                            </span>

                            <div
                              className={`min-w-0 flex-1 text-right text-[9px] leading-4 sm:text-[10px] ${
                                schedule.active
                                  ? "font-medium text-gray-700"
                                  : "text-gray-400"
                              }`}
                            >
                              {schedule.active ? (
                                <div className="space-y-0">
                                  {scheduleText
                                    .split("/")
                                    .map(
                                      (
                                        slot,
                                        index
                                      ) => (
                                        <div
                                          key={
                                            index
                                          }
                                        >
                                          {slot.trim()}
                                        </div>
                                      )
                                    )}
                                </div>
                              ) : (
                                <span>
                                  {scheduleText}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Consultation only
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Select a doctor to continue with your
                    consultation booking.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <GoUpButton />

      {selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedDoctor(null);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  QueueEase
                </p>

                <h2 className="mt-1 text-lg font-bold text-gray-900">
                  Book Consultation
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDoctor(null)
                }
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-indigo-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                    <Stethoscope className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">
                      {selectedDoctor.name}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {selectedDoctor.specialization}
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">
                    Appointment
                  </span>

                  <span className="text-sm font-bold text-gray-900">
                    Consultation
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="text-[10px] text-gray-500">
                    Today's timing
                  </span>

                  <span className="text-right text-xs font-semibold text-gray-700">
                    {getScheduleText(
                      selectedDoctor.schedule?.[today]
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

                <p className="text-xs leading-5 text-gray-600">
                  Continue to enter patient details and
                  complete your consultation booking.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  router.push(
                    `/services/clinics/${clinic.id}/book?doctor=${selectedDoctor.id}`
                  );
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Continue Booking
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedDoctor(null)
                }
                className="w-full py-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}