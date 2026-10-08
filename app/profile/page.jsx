
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import toast from "react-hot-toast";
import LocationPicker from "@/components/LocationPicker";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  useEffect(() => {
    const savedLocation = localStorage.getItem("queueease-location");

    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);

        if (parsed.address) {
          setLocation(parsed.address);
        }
      } catch {
        localStorage.removeItem("queueease-location");
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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
        name: data.name || formData.name,
        phone: data.phone || formData.phone,
      });

      setFormData({
        name: data.name || formData.name,
        phone: data.phone || formData.phone,
      });

      setEditing(false);

      toast.success("Profile updated successfully.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
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

  if (status === "loading" || loading) {
    return (
      <LoadingScreen/>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Please login
          </h1>

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

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-[64px] w-full max-w-3xl items-center px-4 sm:min-h-[72px] sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 active:bg-gray-200"
            >
              <span className="mb-1 text-2xl leading-none">
                ‹
              </span>
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                My Profile
              </h1>

              <p className="truncate text-[11px] text-gray-500 sm:text-xs">
                Manage your account
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* PROFILE */}
      <section className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* PROFILE TOP */}
          <div className="border-b border-gray-100 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:h-16 sm:w-16">
                  <span className="text-xl font-bold text-indigo-600 sm:text-2xl">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                    {user?.name || "User"}
                  </h2>

                  <p className="text-xs text-gray-500 sm:text-sm">
                    QueueEase Customer
                  </p>
                </div>
              </div>

              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-full rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 active:bg-indigo-200 sm:w-auto"
                >
                  Edit Profile
                </button>
              )}
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
                  className="w-full rounded-xl border border-indigo-200 px-5 py-2.5 text-center text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50 sm:w-auto"
                >
                  Login
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:w-auto"
                >
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
        onLocationSelected={(data) => {
          setLocation(data.address);
          setShowLocationPicker(false);
        }}
      />
    </main>
  );
}

