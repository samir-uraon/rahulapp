"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { MapPin, CalendarCheck, LogOut, LogIn, Pencil, ArrowLeft, ArrowUpRight, LockKeyhole, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import LocationPicker from "@/components/LocationPicker";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import EnableNotifications from "@/components/EnableNotifications";

const STORAGE_KEY = "Zeriy-location";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const [location, setLocation] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  // Load profile information from session
  useEffect(() => {
    if (!user) return;

    setFormData({
      name: user.name || "",
      phone: user.phone || "",
    });
  }, [user?.name, user?.phone]);

  // Load location from NextAuth session, then localStorage
  useEffect(() => {
    if (!user) return;

    const sessionAddress = user.address || "";

    if (sessionAddress) {
      setLocation(sessionAddress);

      const savedLocation = {
        type: "search",
        name: user.locationName || "",
        address: sessionAddress,
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(savedLocation)
      );

      return;
    }

    try {
      const savedLocation = localStorage.getItem(STORAGE_KEY);

      if (savedLocation) {
        const parsed = JSON.parse(savedLocation);

        if (parsed?.address) {
          setLocation(parsed.address);
        }
      }
    } catch (error) {
      console.error("PROFILE_LOCATION_CACHE_ERROR:", error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [
    user?.address,
    user?.locationName,
    user?.latitude,
    user?.longitude,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Update profile name and phone
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to update profile");
        return;
      }

      await update({
        name: data.name || formData.name.trim(),
        phone: data.phone || formData.phone.trim(),
      });

      setFormData({
        name: data.name || formData.name.trim(),
        phone: data.phone || formData.phone.trim(),
      });

      setEditing(false);
      toast.success("Profile updated successfully.");
    } catch (error) {
      console.error("PROFILE_UPDATE_ERROR:", error);
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Handle location selection
  const handleLocationSelected = async (data) => {
    if (!data?.address?.trim()) return;

    const locationData = {
      type: data.type || "search",
      name: data.name || "",
      address: data.address,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      city: data.city || "",
      state: data.state || "",
      pinCode: data.pinCode || "",
    };

    // Update UI immediately
    setLocation(locationData.address);
    setShowLocationPicker(false);

    // Update local cache
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(locationData)
    );

    // Update NextAuth session
    try {
      await update({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        locationName: locationData.name,
        address: locationData.address,
      });
    } catch (error) {
      console.error("SESSION_LOCATION_UPDATE_ERROR:", error);
      toast.error("Location saved, but session refresh failed.");
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || "",
      phone: user?.phone || "",
    });

    setEditing(false);
  };

  const handleLogout = () => {
    signOut({
      callbackUrl: "/login",
    });
  };

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
  return (
  <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-lg shadow-indigo-100/50">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
        <LockKeyhole className="h-7 w-7 text-indigo-600" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        Login Required
      </h1>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Please log in to your account to continue.
      </p>

      <Link
        href="/login"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]"
      >
        Go to Login
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </main>
);
  }

  

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
  <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-3 sm:min-h-[72px] sm:px-6">

    {/* Back + Title */}
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Go back"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 active:scale-95"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="min-w-0 ml-1">
        <h1 className="truncate text-sm font-bold text-slate-900 sm:text-lg">
          My Profile
        </h1>
        <p className="truncate text-[10px] text-slate-500 sm:text-xs">
          Manage your account
        </p>
      </div>
    </div>

{/* Bookings */}
<Link
  href="/my-bookings"
  className="group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-sm active:scale-[0.97] sm:px-4 sm:py-2.5 sm:text-sm"
>
  <CalendarCheck
    size={16}
    className="shrink-0 transition-transform duration-200 group-hover:scale-110"
  />
  <span>My Bookings</span>
 </Link>
  </div>
</header>

{/* PROFILE */}
<section className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

    {/* PROFILE TOP */}
    {/* PROFILE TOP */}
<div className="border-b border-slate-100 p-4 sm:p-5 lg:p-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

    {/* User Details */}
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100 sm:size-16">
        <span className="text-xl font-extrabold text-indigo-600 sm:text-2xl">
          {user?.name?.charAt(0)?.toUpperCase() || "U"}
        </span>
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold text-slate-900 sm:text-xl lg:text-xl">
          {user?.name || "User"}
        </h2>
        <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
          Zeriy Customer
        </p>
      </div>
    </div>

    {/* Actions */}
    <div className="flex min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:gap-2.5">

      <EnableNotifications
        webPushEnabled={user?.webPushEnabled === true}
        expoPushEnabled={user?.expoPushEnabled === true}
        updateSession={update}
      />

      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] sm:w-auto"
        >
          <Pencil size={15} />
          Edit Profile
        </button>
      )}
    </div>
  </div>
</div>

          {/* ACCOUNT INFORMATION */}
          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <h3 className="mb-5 text-base font-semibold text-gray-900">
              Account Information
            </h3>

            <div className="space-y-5">

              {/* NAME */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Full Name
                </label>

                {editing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={saving}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                    placeholder="Enter your name"
                  />
                ) : (
                  <p className="mt-1 break-words text-sm font-medium text-gray-900">
                    {user?.name || "Not available"}
                  </p>
                )}
              </div>

              {/* EMAIL */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Email
                </label>

                <p className="mt-1 break-all text-sm font-medium text-gray-900">
                  {user?.email || "Not available"}
                </p>

                {editing && (
                  <p className="mt-1 text-xs text-gray-400">
                    Email cannot be changed here.
                  </p>
                )}
              </div>

              {/* PHONE */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Phone
                </label>

                {editing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={saving}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <p className="mt-1 break-words text-sm font-medium text-gray-900">
                    {user?.phone || "Not added"}
                  </p>
                )}
              </div>

              {/* LOCATION */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Location
                </label>

                <div className="mt-2 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                      <MapPin
                        size={18}
                        className="text-indigo-600"
                      />
                    </div>

                    <p className="min-w-0 break-words text-sm font-medium text-gray-900">
                      {location || "Location not selected"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className="w-full shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100 active:bg-indigo-200 sm:w-auto"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* EDIT ACTIONS */}
          {editing && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-5 sm:flex-row sm:px-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="w-full rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          )}

          {/* LOGIN / LOGOUT */}
          {!editing && (
  <div className="border-t border-gray-100 px-4 py-5 sm:px-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <Link
        href="/login"
        className="
          group inline-flex w-full items-center justify-center gap-2
          rounded-xl border border-indigo-200 bg-white
          px-5 py-3 text-sm font-semibold text-indigo-600
          shadow-sm transition-all duration-200
          hover:-translate-y-0.5 hover:border-indigo-400
          hover:bg-indigo-50 hover:shadow-md
          active:translate-y-0 active:scale-[0.98]
          sm:w-auto
        "
      >
        <LogIn size={17} className="transition-transform group-hover:translate-x-0.5" />
        Login
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="
          group inline-flex w-full items-center justify-center gap-2
          rounded-xl border border-red-200 bg-white
          px-5 py-3 text-sm font-semibold text-red-600
          shadow-sm transition-all duration-200
          hover:-translate-y-0.5 hover:border-red-400
          hover:bg-red-50 hover:shadow-md
          active:translate-y-0 active:scale-[0.98]
          sm:w-auto
        "
      >
        <LogOut size={17} className="transition-transform group-hover:translate-x-0.5" />
        Logout
      </button>
    </div>
  </div>
)}
        </div>
      </section>

      {/* LOCATION PICKER */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelected={handleLocationSelected}
      />
    </main>
  );
}