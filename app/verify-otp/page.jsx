"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "react-hot-toast";

export default function VerifyOTP() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    const password = sessionStorage.getItem("signupPassword");

    if (!password) {
      toast.error("Signup session expired. Please login manually.");
      router.push("/login");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Invalid OTP");
        setLoading(false);
        return;
      }

      const loginResult = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      sessionStorage.removeItem("signupPassword");

      if (loginResult?.error) {
        toast.error("Email verified, but automatic login failed.");
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">

          {/* Header */}
          <div className="mb-6 text-center sm:mb-7">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-600 sm:h-14 sm:w-14 sm:text-2xl">
              ✉️
            </div>

            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
              Verify Your Email
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
              We've sent a 6-digit OTP to
            </p>

            <p className="mt-1 break-all px-2 text-sm font-bold text-indigo-600 sm:text-base">
              {email}
            </p>
          </div>

          {/* OTP Form */}
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label
                htmlFor="otp"
                className="mb-1.5 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Enter OTP
              </label>

              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                autoFocus
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter 6-digit OTP"
                required
                aria-label="6-digit OTP"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-lg font-bold tracking-[0.35em] text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:px-3.5 sm:py-3.5 sm:text-xl sm:tracking-[0.5em]"
              />

              <p className="mt-2 text-center text-[11px] text-slate-400 sm:text-xs">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:shadow-none"
            >
              {loading
                ? "Verifying & Logging in..."
                : "Verify OTP →"}
            </button>
          </form>

          {/* Back */}
          <div className="mt-5 flex justify-center sm:mt-6">
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:underline active:scale-95 sm:text-sm"
            >
              ← Back to Sign Up
            </button>
          </div>

          {/* Bottom Info */}
          <div className="mt-5 border-t border-slate-100 pt-5 text-center sm:mt-6">
            <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
              🔐 Your OTP is required to verify your email address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}