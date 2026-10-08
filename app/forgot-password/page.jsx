"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const validateIdentifier = (value) => {
    const valueToCheck = value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    return (
      emailRegex.test(valueToCheck) ||
      mobileRegex.test(valueToCheck)
    );
  };

  const isIdentifierValid = validateIdentifier(identifier);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      toast.error("Please enter your email or mobile number.");
      return;
    }

    if (!validateIdentifier(trimmedIdentifier)) {
      toast.error(
        "Enter a valid email address or 10-digit mobile number."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: trimmedIdentifier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send reset link");
        return;
      }

      toast.success("Reset instructions sent successfully!");
      setIdentifier("");
    } catch (error) {
      console.error("Forgot password error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="flex h-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-4 sm:px-6 sm:py-8">
  <div className="w-full max-w-md">
    <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="
              inline-flex items-center gap-2
              rounded-lg
              px-2 py-2
              text-sm font-semibold
              text-slate-600
              transition-all
              hover:bg-white
              hover:text-indigo-600
              active:scale-95
            "
          >
            <span className="text-lg leading-none">←</span>
            <span>Back</span>
          </button>
        </div>

        <div
          className="
            w-full
            rounded-2xl sm:rounded-3xl
            border border-slate-200
            bg-white
            p-5 sm:p-8
            shadow-sm
          "
        >
          <div className="mb-6 text-center sm:mb-7">
            <div
              className="
                mx-auto mb-4
                flex h-12 w-12 sm:h-14 sm:w-14
                items-center justify-center
                rounded-2xl
                bg-indigo-50
                text-xl text-indigo-600 sm:text-2xl
              "
            >
              🔐
            </div>

            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
              Forgot Password?
            </h2>

            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Enter your email or mobile number to reset your password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-xs font-bold text-slate-700 sm:text-sm"
              >
                Email or Mobile Number
              </label>

              <input
                id="identifier"
                type="text"
                name="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or 10-digit mobile number"
                autoComplete="username"
                inputMode="email"
                maxLength={100}
                required
                aria-invalid={
                  identifier.length > 0 && !isIdentifierValid
                }
                className={`
                  w-full
                  rounded-xl
                  border
                  bg-slate-50
                  px-3.5 py-3
                  text-sm text-slate-900
                  outline-none
                  transition-all
                  focus:border-transparent
                  focus:ring-2
                  ${
                    identifier.length > 0 && !isIdentifierValid
                      ? "border-red-400 focus:ring-red-500"
                      : "border-slate-200 focus:ring-indigo-500"
                  }
                `}
              />

              {identifier.length > 0 && !isIdentifierValid && (
                <p className="mt-1.5 text-xs leading-relaxed text-red-500">
                  Enter a valid email address or 10-digit mobile number.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isIdentifierValid}
              className="
                w-full
                rounded-xl
                bg-indigo-600
                py-3
                text-sm font-bold text-white
                shadow-md shadow-indigo-200
                transition-all
                hover:bg-indigo-700
                active:scale-[0.99]
                disabled:cursor-not-allowed
                disabled:bg-indigo-400
                disabled:shadow-none
                disabled:hover:bg-indigo-400
              "
            >
              {loading ? "Sending..." : "Send Reset Link →"}
            </button>
          </form>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="
                rounded-lg
                px-3 py-2.5
                text-sm font-semibold
                text-indigo-600
                transition
                hover:text-indigo-700
                hover:underline
                active:scale-95
              "
            >
              ← Back to Login
            </button>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5 text-center sm:mt-6">
            <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
              💡 We'll send instructions to help you reset your password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}