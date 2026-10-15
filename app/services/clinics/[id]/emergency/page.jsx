"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import GoUpButton from "@/components/GoUpButton";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";

const EMERGENCY_FEE = 50;
const ARRIVAL_OPTIONS = [5, 10, 15, 20, 30, 40, 60];

function getDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  })
    .format(date)
    .toLowerCase();
}

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCurrentTimeInIndia() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function toMinutes(value) {
  if (!value || typeof value !== "string") return null;

  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function isTimeWithinSlot(open, close, current) {
  const openMinutes = toMinutes(open);
  const closeMinutes = toMinutes(close);
  const currentMinutes = toMinutes(current);

  if (
    openMinutes === null ||
    closeMinutes === null ||
    currentMinutes === null
  ) {
    return false;
  }

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function getActiveSlot(doctor, now = new Date()) {
  const dayKey = getDayKey(now);
  const schedule = doctor?.schedule?.[dayKey];

  if (!schedule?.active || !Array.isArray(schedule.slots)) {
    return null;
  }

  const currentTime = getCurrentTimeInIndia();

  return (
    schedule.slots.find((slot) =>
      isTimeWithinSlot(slot.open, slot.close, currentTime)
    ) || null
  );
}

function getClinicId(clinic) {
  return String(clinic?.id ?? clinic?._id ?? "");
}

function getDoctorId(doctor) {
  return String(doctor?.id ?? doctor?._id ?? "");
}

function normalizeGender(value) {
  const gender = String(value || "").trim().toLowerCase();

  if (["male", "m"].includes(gender)) return "male";
  if (["female", "f"].includes(gender)) return "female";
  if (["other", "others"].includes(gender)) return "other";

  return "";
}

export default function EmergencyBookingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const clinicId = String(params?.id || "");
  const doctorId = searchParams.get("doctor") || "";

  const [clinic, setClinic] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(null);

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [patientType, setPatientType] = useState("normal");
  const [arrivalMinutes, setArrivalMinutes] = useState(15);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const loadClinic = useCallback(async () => {
    if (!clinicId) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/clinics", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load clinics. Please try again.");
      }

      const data = await response.json();

      const clinics = Array.isArray(data)
        ? data
        : Array.isArray(data.clinics)
          ? data.clinics
          : [];

      const foundClinic = clinics.find(
        (item) => getClinicId(item) === clinicId
      );

      if (!foundClinic) {
        throw new Error("Clinic not found.");
      }

      const doctors = Array.isArray(foundClinic.doctors)
        ? foundClinic.doctors
        : [];

      const foundDoctor = doctors.find(
        (item) => getDoctorId(item) === doctorId
      );

      if (!foundDoctor) {
        throw new Error("Doctor not found. Please return to the clinic page.");
      }

      setClinic(foundClinic);
      setDoctor(foundDoctor);
    } catch (err) {
      setError(err.message || "Unable to load clinic details.");
    } finally {
      setLoading(false);
    }
  }, [clinicId, doctorId]);

  useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  useEffect(() => {
    if (!doctor) {
      setCurrentSlot(null);
      return;
    }

    setCurrentSlot(getActiveSlot(doctor, new Date(currentTime)));
  }, [doctor, currentTime]);

  // Load the user's saved name, age and gender.
  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!session?.user) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPatientProfile() {
      setProfileLoading(true);

      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
        });

        let profile = {};

        if (response.ok) {
          const data = await response.json();
          profile = data?.profile || data?.user || data || {};
        }

        if (cancelled) return;

        const savedName =
          profile.name ||
          profile.fullName ||
          profile.patientName ||
          session.user.name ||
          "";

        const savedAge =
          profile.age ??
          profile.patientAge ??
          profile.dateOfBirthAge ??
          "";

        const savedGender = normalizeGender(
          profile.gender ?? profile.patientGender
        );

        setPatientName(savedName);
        setAge(savedAge === "" ? "" : String(savedAge));

        if (savedGender) {
          setGender(savedGender);
        }
      } catch (err) {
        console.error("Unable to load patient profile:", err);

        if (!cancelled) {
          setPatientName(session.user.name || "");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadPatientProfile();

    return () => {
      cancelled = true;
    };
  }, [session, sessionStatus]);

  const clinicName = clinic?.name || clinic?.clinicName || "Clinic";
  const doctorName =
    doctor?.name || doctor?.doctorName || "Doctor";
  const address = clinic?.address || clinic?.location || "";

  const isLoggedIn = Boolean(session?.user);

  const canSubmit = useMemo(() => {
    const parsedAge = Number(age);

    return (
      isLoggedIn &&
      Boolean(patientName.trim()) &&
      age !== "" &&
      Number.isInteger(parsedAge) &&
      parsedAge >= 0 &&
      parsedAge <= 120 &&
      Boolean(gender) &&
      Boolean(currentSlot) &&
      !submitting &&
      !profileLoading
    );
  }, [
    isLoggedIn,
    patientName,
    age,
    gender,
    currentSlot,
    submitting,
    profileLoading,
  ]);

  async function handleEmergencyBooking(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    if (!clinic || !doctor || !currentSlot) {
      setError("The doctor is not currently in an active booking slot.");
      return;
    }

    if (!patientName.trim()) {
      setError("Please enter the patient's name.");
      return;
    }

    const parsedAge = Number(age);

    if (
      age === "" ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 0 ||
      parsedAge > 120
    ) {
      setError("Please enter a valid age between 0 and 120.");
      return;
    }

    if (!["male", "female", "other"].includes(gender)) {
      setError("Please select the patient's gender.");
      return;
    }

    if (!window.Razorpay) {
      setError("Payment checkout is not ready. Please refresh and try again.");
      return;
    }

    setSubmitting(true);

    try {
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinicId,
          doctorId,
          patientName: patientName.trim(),
          age: parsedAge,
          gender,
          patientType,
          date: getTodayKey(),
          time: currentSlot.open,
          slot: {
            open: currentSlot.open,
            close: currentSlot.close,
          },
          priority: "emergency",
          arrivalMinutes,
          amount: EMERGENCY_FEE,
          bookingType: "emergency",
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(
          orderData?.error ||
            orderData?.message ||
            "Unable to create the payment order."
        );
      }

      if (!orderData.order?.id && !orderData.orderId) {
        throw new Error("The server did not return a valid payment order.");
      }

      const order = orderData.order || {
        id: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
      };

      const razorpayKey =
        orderData.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!razorpayKey) {
        throw new Error("Razorpay key is not configured.");
      }

      const paymentResult = await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "Zeric",
          description: "Emergency clinic booking",
          order_id: order.id,
          prefill: {
            name: patientName.trim(),
            email: session?.user?.email || "",
            contact: session?.user?.phone || "",
          },
          theme: {
            color: "#4f46e5",
          },
          modal: {
            ondismiss: () => {
              reject(new Error("Payment was cancelled."));
            },
          },
          handler: (payment) => resolve(payment),
        });

        checkout.on("payment.failed", (response) => {
          reject(
            new Error(
              response?.error?.description || "Payment failed. Please retry."
            )
          );
        });

        checkout.open();
      });

      const verifyResponse = await fetch("/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(
          verifyData?.error ||
            verifyData?.message ||
            "Payment verification failed. Contact support before paying again."
        );
      }

      setSuccessMessage("Emergency booking payment verified successfully.");

      if (verifyData.booking?._id || verifyData.booking?.bookingReference) {
        router.replace("/my-bookings");
      } else {
        router.replace("/my-bookings");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header showBack />

      <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-6 text-slate-900 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-100 p-2 text-red-600">
                <AlertCircle size={23} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-red-800">
                  Emergency Booking
                </h1>
                <p className="mt-1 text-sm leading-6 text-red-700">
                  Request priority handling for a patient who can arrive soon.
                  This request does not replace emergency medical services.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
              <LoaderCircle className="animate-spin text-indigo-600" size={23} />
              <span className="text-sm text-slate-600">
                Loading clinic details...
              </span>
            </div>
          ) : error && !clinic ? (
            <div className="rounded-2xl border border-red-200 bg-white p-5">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={loadClinic}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_0.85fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold">Patient details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Check the saved details and correct them if needed.
                </p>

                {sessionStatus === "loading" || profileLoading ? (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle size={17} className="animate-spin" />
                    Loading your saved profile...
                  </div>
                ) : !isLoggedIn ? (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                      Sign in to load your saved patient details and continue.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Sign in
                    </button>
                  </div>
                ) : (
                  <form
                    id="emergency-booking-form"
                    onSubmit={handleEmergencyBooking}
                    className="mt-5 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="patientName"
                        className="mb-1.5 block text-sm font-semibold text-slate-700"
                      >
                        Patient name
                      </label>
                      <div className="relative">
                        <User
                          size={17}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          id="patientName"
                          name="patientName"
                          type="text"
                          autoComplete="name"
                          value={patientName}
                          onChange={(event) =>
                            setPatientName(event.target.value)
                          }
                          placeholder="Enter patient's full name"
                          required
                          maxLength={100}
                          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="age"
                          className="mb-1.5 block text-sm font-semibold text-slate-700"
                        >
                          Age
                        </label>
                        <input
                          id="age"
                          name="age"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="120"
                          step="1"
                          value={age}
                          onChange={(event) => setAge(event.target.value)}
                          placeholder="Age"
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="gender"
                          className="mb-1.5 block text-sm font-semibold text-slate-700"
                        >
                          Gender
                        </label>
                        <select
                          id="gender"
                          name="gender"
                          value={gender}
                          onChange={(event) => setGender(event.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="patientType"
                        className="mb-1.5 block text-sm font-semibold text-slate-700"
                      >
                        Booking for
                      </label>
                      <select
                        id="patientType"
                        name="patientType"
                        value={patientType}
                        onChange={(event) =>
                          setPatientType(event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="normal">Myself / Other adult</option>
                        <option value="child">Child</option>
                        <option value="elderly">Elderly person</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Expected arrival time
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {ARRIVAL_OPTIONS.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => setArrivalMinutes(minutes)}
                            className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition ${
                              arrivalMinutes === minutes
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {minutes} min
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                      >
                        <AlertCircle
                          size={17}
                          className="mt-0.5 shrink-0"
                        />
                        <span>{error}</span>
                      </div>
                    )}

                    {successMessage && (
                      <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                        <CheckCircle2
                          size={17}
                          className="mt-0.5 shrink-0"
                        />
                        <span>{successMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle size={18} className="animate-spin" />
                          Processing payment...
                        </>
                      ) : (
                        <>
                          <CreditCard size={18} />
                          Pay ₹{EMERGENCY_FEE} and request booking
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs leading-5 text-slate-500">
                      Your booking is not confirmed until payment verification
                      and booking creation succeed.
                    </p>
                  </form>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="font-bold">Clinic details</h2>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Clinic
                      </p>
                      <p className="mt-1 font-semibold">{clinicName}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Doctor
                      </p>
                      <p className="mt-1 font-semibold">{doctorName}</p>
                      {doctor?.specialization && (
                        <p className="mt-1 text-sm text-slate-500">
                          {doctor.specialization}
                        </p>
                      )}
                    </div>

                    {address && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin
                          size={17}
                          className="mt-0.5 shrink-0 text-indigo-600"
                        />
                        <span>{address}</span>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="font-bold">Current slot</h2>

                  {currentSlot ? (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-green-800">
                        <CheckCircle2 size={18} />
                        Doctor is in an active slot
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-green-800">
                        <Clock size={16} />
                        {currentSlot.open} – {currentSlot.close}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-green-800">
                        <CalendarDays size={16} />
                        Today, India time
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      The doctor does not appear to have an active slot right
                      now. Refresh the page or return to the clinic schedule.
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                  <div className="flex items-center gap-2 font-bold text-indigo-900">
                    <ShieldCheck size={19} />
                    Payment summary
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-indigo-800">Emergency booking fee</span>
                    <span className="font-bold text-indigo-950">
                      ₹{EMERGENCY_FEE}
                    </span>
                  </div>

                  <div className="my-3 border-t border-indigo-200" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-indigo-900">Total</span>
                    <span className="text-xl font-extrabold text-indigo-950">
                      ₹{EMERGENCY_FEE}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-indigo-800">
                    Emergency booking priority and availability must be
                    validated by the server. This fee does not guarantee that
                    the doctor can see you immediately.
                  </p>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>

      <GoUpButton />
    </>
  );
}
