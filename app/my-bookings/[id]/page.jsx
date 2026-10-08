"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Ticket,
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

const bookings = {
  "QE-1024": {
    id: "QE-1024",
    business: "Style Studio",
    service: "Haircut",
    token: "A-24",
    date: "01 Oct 2026",
    time: "10:30 AM",
    location: "Salt Lake, Kolkata",
    address: "Sector V, Salt Lake, Kolkata, West Bengal",
    status: "Confirmed",
    customerName: "Samir Uraon",
    phone: "+91 9876543210",
    email: "samir@example.com",
    bookedOn: "30 Sep 2026",
  },
  "QE-1023": {
    id: "QE-1023",
    business: "Looks Salon",
    service: "Hair Styling",
    token: "B-12",
    date: "28 Sep 2026",
    time: "4:00 PM",
    location: "New Town, Kolkata",
    address: "Action Area 1, New Town, Kolkata, West Bengal",
    status: "Completed",
    customerName: "Samir Uraon",
    phone: "+91 9876543210",
    email: "samir@example.com",
    bookedOn: "27 Sep 2026",
  },
};

function StatusBadge({ status }) {
  const isCompleted = status === "Completed";
  const isCancelled = status === "Cancelled";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isCompleted
          ? "bg-green-50 text-green-700"
          : isCancelled
          ? "bg-red-50 text-red-700"
          : "bg-indigo-50 text-indigo-700"
      }`}
    >
      {isCompleted ? (
        <CheckCircle2 size={14} />
      ) : isCancelled ? (
        <XCircle size={14} />
      ) : (
        <CheckCircle2 size={14} />
      )}

      {status}
    </span>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon size={18} />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-gray-900">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [cancelling, setCancelling] = useState(false);

  const bookingId = params?.id;
  const booking = bookings[bookingId];

  if (!booking) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <Link
              href="/my-bookings"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft size={18} />
              <span>My Bookings</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">
                Q
              </div>

              <div className="hidden sm:block">
                <p className="text-sm font-bold text-gray-900">QueueEase</p>
                <p className="text-[11px] text-gray-500">Customer Booking App</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <XCircle size={28} />
            </div>

            <h1 className="mt-5 text-xl font-bold text-gray-900">
              Booking not found
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              The booking you are looking for does not exist or may have been
              removed.
            </p>

            <Link
              href="/my-bookings"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <ArrowLeft size={17} />
              Back to My Bookings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canCancel =
    booking.status === "Confirmed" && !cancelling;

  const handleCancel = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?"
    );

    if (!confirmed) return;

    try {
      setCancelling(true);

      await new Promise((resolve) => setTimeout(resolve, 800));

      toast.success("Booking cancelled successfully");

      router.push("/my-bookings");
    } catch (error) {
      toast.error("Unable to cancel booking");
      setCancelling(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => router.push("/my-bookings")}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">My Bookings</span>
            <span className="sm:hidden">Back</span>
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white shadow-sm">
              Q
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-sm font-bold leading-4 text-gray-900">
                QueueEase
              </p>
              <p className="text-[11px] leading-4 text-gray-500">
                Customer Booking App
              </p>
            </div>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Link
              href="/"
              className="transition hover:text-indigo-600"
            >
              Home
            </Link>

            <ChevronRight size={14} />

            <Link
              href="/my-bookings"
              className="transition hover:text-indigo-600"
            >
              My Bookings
            </Link>

            <ChevronRight size={14} />

            <span className="text-gray-900">{booking.id}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Booking Details
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                View all information about your booking.
              </p>
            </div>

            <StatusBadge status={booking.status} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Building2 size={24} />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {booking.business}
                      </h2>

                      <p className="mt-0.5 text-sm text-gray-500">
                        {booking.service}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 px-4 py-3 sm:text-right">
                    <p className="text-xs font-medium text-gray-400">
                      Booking ID
                    </p>

                    <p className="mt-0.5 text-sm font-bold text-gray-900">
                      {booking.id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-6 sm:px-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <DetailItem
                    icon={CalendarDays}
                    label="Date"
                    value={booking.date}
                  />

                  <DetailItem
                    icon={Clock3}
                    label="Time"
                    value={booking.time}
                  />

                  <DetailItem
                    icon={Ticket}
                    label="Token Number"
                    value={booking.token}
                  />

                  <DetailItem
                    icon={MapPin}
                    label="Location"
                    value={booking.location}
                  />
                </div>

                <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin
                      size={19}
                      className="mt-0.5 shrink-0 text-indigo-600"
                    />

                    <div>
                      <p className="text-xs font-medium text-gray-400">
                        Full Address
                      </p>

                      <p className="mt-1 text-sm font-medium leading-6 text-gray-800">
                        {booking.address}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
                <h2 className="font-bold text-gray-900">
                  Customer Details
                </h2>
              </div>

              <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
                <DetailItem
                  icon={User}
                  label="Name"
                  value={booking.customerName}
                />

                <DetailItem
                  icon={Phone}
                  label="Phone"
                  value={booking.phone}
                />

                <DetailItem
                  icon={Mail}
                  label="Email"
                  value={booking.email}
                />

                <DetailItem
                  icon={CalendarDays}
                  label="Booked On"
                  value={booking.bookedOn}
                />
              </div>
            </div>
          </section>

          <aside>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="bg-indigo-600 px-5 py-6 text-center text-white">
                <p className="text-sm font-medium text-indigo-100">
                  Your Token Number
                </p>

                <div className="mt-2 text-5xl font-black tracking-tight">
                  {booking.token}
                </div>

                <p className="mt-2 text-xs text-indigo-100">
                  Please keep this token handy.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Service</span>
                  <span className="max-w-[55%] text-right text-sm font-semibold text-gray-900">
                    {booking.service}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Date</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {booking.date}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Time</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {booking.time}
                  </span>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  {canCancel ? (
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle size={18} />

                      {cancelling
                        ? "Cancelling..."
                        : "Cancel Booking"}
                    </button>
                  ) : (
                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-center text-xs leading-5 text-gray-500">
                      {booking.status === "Completed"
                        ? "This booking has already been completed."
                        : "This booking cannot be cancelled."}
                    </div>
                  )}
                </div>

                <Link
                  href="/my-bookings"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <ArrowLeft size={17} />
                  All My Bookings
                </Link>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600">
                  <Ticket size={18} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Before you visit
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-gray-600">
                    Please arrive a few minutes before your scheduled time and
                    keep your token number ready.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}