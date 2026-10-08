"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Ticket,
  ChevronRight,
  XCircle,
} from "lucide-react";
import Header from "@/components/Header";
import LoadingScreen from "@/components/LoadingScreen";
import GoUpButton from "@/components/GoUpButton";

const upcomingBookings = [
  {
    id: "QE-1024",
    business: "Style Studio",
    service: "Haircut",
    token: "A-24",
    date: "01 Oct 2026",
    time: "10:30 AM",
    location: "Salt Lake, Kolkata",
    status: "Confirmed",
    peopleAhead: 6,
  },
  {
    id: "QE-1025",
    business: "Looks Salon",
    service: "Hair Styling",
    token: null,
    date: "03 Oct 2026",
    time: "04:00 PM",
    location: "New Town, Kolkata",
    status: "Pending",
  },
];

const pastBookings = [
  {
    id: "QE-0987",
    business: "Looks Salon",
    service: "Hair Styling",
    token: "B-18",
    date: "28 Sep 2026",
    time: "04:00 PM",
    location: "New Town, Kolkata",
    status: "Completed",
  },
  {
    id: "QE-0912",
    business: "Urban Salon",
    service: "Haircut",
    token: "C-09",
    date: "20 Sep 2026",
    time: "11:30 AM",
    location: "Park Street, Kolkata",
    status: "Completed",
  },
  {
    id: "QE-0876",
    business: "Style Studio",
    service: "Beard Trim",
    token: null,
    date: "15 Sep 2026",
    time: "02:00 PM",
    location: "Salt Lake, Kolkata",
    status: "Cancelled",
  },
];

function StatusBadge({ status }) {
  const styles = {
    Confirmed: "bg-emerald-50 text-emerald-600",
    Pending: "bg-amber-50 text-amber-600",
    Completed: "bg-gray-100 text-gray-500",
    Cancelled: "bg-red-50 text-red-500",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  );
}

function BookingCard({ booking, upcoming = false }) {
  const isConfirmed = booking.status === "Confirmed";
  const isPending = booking.status === "Pending";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Ticket size={19} />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-gray-900">
                {booking.business}
              </h3>

              <p className="mt-0.5 text-xs text-gray-500">
                {booking.service}
              </p>
            </div>
          </div>
        </div>

        <StatusBadge status={booking.status} />
      </div>

      {upcoming && isConfirmed && (
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Your queue position
                </p>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-700">
                    {booking.token}
                  </span>

                  <span className="text-xs text-gray-500">
                    your token
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {booking.peopleAhead}
                </p>

                <p className="text-xs text-gray-500">
                  {booking.peopleAhead === 1
                    ? "person ahead"
                    : "people ahead"}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{
                  width: `${Math.max(
                    10,
                    100 - booking.peopleAhead * 10
                  )}%`,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-indigo-600">
                You're in the queue
              </span>

              <span className="text-right text-gray-400">
                Keep your token ready
              </span>
            </div>
          </div>
        </div>
      )}

      {upcoming && isPending && (
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm">
                <Clock3 size={19} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  Booking is pending
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Your booking is waiting for confirmation. Your token will
                  appear here once the booking is confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <div className="flex items-start gap-3">
          <CalendarDays
            size={17}
            className="mt-0.5 shrink-0 text-gray-400"
          />

          <div>
            <p className="text-xs text-gray-400">Date</p>

            <p className="mt-0.5 text-sm font-medium text-gray-800">
              {booking.date}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock3
            size={17}
            className="mt-0.5 shrink-0 text-gray-400"
          />

          <div>
            <p className="text-xs text-gray-400">Time</p>

            <p className="mt-0.5 text-sm font-medium text-gray-800">
              {booking.time}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 sm:col-span-2">
          <MapPin
            size={17}
            className="mt-0.5 shrink-0 text-gray-400"
          />

          <div className="min-w-0">
            <p className="text-xs text-gray-400">Location</p>

            <p className="mt-0.5 truncate text-sm font-medium text-gray-800">
              {booking.location}
            </p>
          </div>
        </div>
      </div>

      {upcoming && (
        <div className="flex gap-2 border-t border-gray-100 p-4 sm:p-5">
          {booking.status !== "Cancelled" && (
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50"
            >
              <XCircle size={16} />
              Cancel
            </button>
          )}

          <Link
            href={`/my-bookings/${booking.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            View details
            <ChevronRight size={16} />
          </Link>
        </div>
      )}

      {!upcoming && (
        <Link
          href={`/my-bookings/${booking.id}`}
          className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm font-medium text-indigo-600 transition hover:bg-gray-50 sm:px-5"
        >
          View booking details
          <ChevronRight size={17} />
        </Link>
      )}
    </div>
  );
}



  


function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-gray-900">
          Please login
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          You need to be logged in to view your bookings.
        </p>

        <Link
          href="/login"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
        >
          Go to Login
        </Link>
      </div>
    </main>
  );
}

export default function MyBookingsPage() {
  const { status } = useSession();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack={true} />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            My Bookings
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Manage your upcoming and previous bookings.
          </p>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">
              Upcoming bookings
            </h3>

            <span className="text-xs font-medium text-indigo-600">
              {upcomingBookings.length}{" "}
              {upcomingBookings.length === 1
                ? "booking"
                : "bookings"}
            </span>
          </div>

          <div className="space-y-4">
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  upcoming
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <CalendarDays
                    size={22}
                    className="text-gray-400"
                  />
                </div>

                <h3 className="mt-3 text-sm font-bold text-gray-900">
                  No upcoming bookings
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Book a service to see it here.
                </p>

                <Link
                  href="/"
                  className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Book a service
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 text-base font-bold text-gray-900">
            Previous bookings
          </h3>

          <div className="space-y-3">
            {pastBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
              />
            ))}
          </div>
        </section>
      </main>
      <GoUpButton/>
    </div>
  );
}