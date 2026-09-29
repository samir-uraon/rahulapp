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
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="
              inline-flex items-center gap-2
              px-2 py-2
              rounded-lg
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

        {/* Card */}
        <div
          className="
            w-full
            bg-white
            border border-slate-200
            rounded-2xl sm:rounded-3xl
            p-5 sm:p-8
            shadow-sm
          "
        >
          {/* Header */}
          <div className="text-center mb-6 sm:mb-7">
            <div
              className="
                mx-auto mb-4
                flex items-center justify-center
                w-12 h-12 sm:w-14 sm:h-14
                rounded-2xl
                bg-indigo-50
                text-indigo-600
                text-xl sm:text-2xl
              "
            >
              🔐
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Forgot Password?
            </h2>

            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-500">
              Enter your email or mobile number to reset your password
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs sm:text-sm font-bold text-slate-700 mb-2"
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
                  bg-slate-50
                  rounded-xl
                  px-3.5 py-3
                  text-sm
                  text-slate-900
                  border
                  outline-none
                  transition-all

                  focus:ring-2
                  focus:border-transparent

                  ${
                    identifier.length > 0 && !isIdentifierValid
                      ? "border-red-400 focus:ring-red-500"
                      : "border-slate-200 focus:ring-indigo-500"
                  }
                `}
              />

              {identifier.length > 0 && !isIdentifierValid && (
                <p className="mt-1.5 text-xs text-red-500 leading-relaxed">
                  Enter a valid email address or 10-digit mobile number.
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isIdentifierValid}
              className="
                w-full
                py-3
                rounded-xl
                bg-indigo-600
                hover:bg-indigo-700
                active:scale-[0.99]
                text-white
                text-sm
                font-bold
                shadow-md shadow-indigo-200
                transition-all

                disabled:bg-indigo-400
                disabled:shadow-none
                disabled:cursor-not-allowed
                disabled:hover:bg-indigo-400
              "
            >
              {loading ? "Sending..." : "Send Reset Link →"}
            </button>
          </form>

          {/* Back to Login */}
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="
                px-3 py-2.5
                text-sm
                font-semibold
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

          {/* Footer */}
          <div className="mt-5 sm:mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] sm:text-xs leading-relaxed text-slate-400">
              💡 We'll send instructions to help you reset your password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}