
"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

const STEPS = {
  IDENTIFIER: 1,
  OTP: 2,
  PASSWORD: 3,
  SUCCESS: 4,
};

export default function ForgotPassword() {
  const [step, setStep] = useState(STEPS.IDENTIFIER);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const trimmedIdentifier = identifier.trim();

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    trimmedIdentifier
  );
  const isMobile = /^[6-9]\d{9}$/.test(trimmedIdentifier);
  const isIdentifierValid = isEmail || isMobile;

  const passwordValid =
    newPassword.length >= 8 &&
    newPassword.length <= 128 &&
    /[A-Za-z]/.test(newPassword) &&
    /\d/.test(newPassword);

  async function postJSON(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          "Something went wrong. Please try again."
      );
    }

    return data;
  }

  async function handleRequestOTP(event) {
    event.preventDefault();

    if (!isIdentifierValid) {
      toast.error("Enter a valid email or 10-digit mobile number.");
      return;
    }

    setLoading(true);

    try {
      await postJSON("/api/forgot-password", {
        identifier: trimmedIdentifier,
      });

      setOtp("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(STEPS.OTP);

      toast.success(
        "If your verified account matches, an OTP will be sent to your email."
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(event) {
    event.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const data = await postJSON(
        "/api/forgot-password/verify-otp",
        {
          identifier: trimmedIdentifier,
          otp,
        }
      );

      // The verification API returns a separate reset token.
      if (
        !data.success ||
        typeof data.resetToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(data.resetToken)
      ) {
        throw new Error(
          "OTP verification did not return a valid reset token. Please try again."
        );
      }

      setResetToken(data.resetToken);
      setOtp("");
      setStep(STEPS.PASSWORD);

      toast.success("OTP verified. Set your new password.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    if (!resetToken) {
      toast.error("Your reset session is missing. Please verify a new OTP.");
      setStep(STEPS.IDENTIFIER);
      return;
    }

    if (!passwordValid) {
      toast.error(
        "Use 8–128 characters, including at least one letter and one number."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await postJSON("/api/forgot-password/reset", {
        identifier: trimmedIdentifier,
        resetToken,
        newPassword,
      });

      setResetToken("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(STEPS.SUCCESS);

      toast.success("Password reset successfully!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOTP() {
    if (!isIdentifierValid || resending || loading) return;

    setResending(true);

    try {
      await postJSON("/api/forgot-password", {
        identifier: trimmedIdentifier,
      });

      // A new OTP invalidates the previous verification/reset session.
      setOtp("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success(
        "If your verified account matches, a new OTP will be sent when permitted."
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResending(false);
    }
  }

  function goBack() {
    if (loading || resending) return;

    if (step === STEPS.OTP) {
      setStep(STEPS.IDENTIFIER);
      setOtp("");
      setResetToken("");
    } else if (step === STEPS.PASSWORD) {
      // Keep the verified token so the user can return to password entry.
      setStep(STEPS.OTP);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      window.location.href = "/login";
    }
  }

  const stepNumber =
    step === STEPS.IDENTIFIER
      ? 1
      : step === STEPS.OTP
        ? 2
        : step === STEPS.PASSWORD
          ? 3
          : 3;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={goBack}
          disabled={loading || resending}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-indigo-600 disabled:opacity-50"
        >
          <ArrowLeft size={17} />
          Back
        </button>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              {step === STEPS.SUCCESS ? (
                <CheckCircle2 size={27} />
              ) : step === STEPS.OTP ? (
                <ShieldCheck size={27} />
              ) : step === STEPS.PASSWORD ? (
                <KeyRound size={27} />
              ) : (
                <ShieldCheck size={27} />
              )}
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {step === STEPS.IDENTIFIER && "Forgot Password?"}
              {step === STEPS.OTP && "Verify OTP"}
              {step === STEPS.PASSWORD && "Create New Password"}
              {step === STEPS.SUCCESS && "Password Reset!"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {step === STEPS.IDENTIFIER &&
                "Enter your registered email or mobile number to receive a verification code."}
              {step === STEPS.OTP &&
                `Enter the 6-digit code sent to ${trimmedIdentifier}.`}
              {step === STEPS.PASSWORD &&
                "Choose a strong password for your Zeric account."}
              {step === STEPS.SUCCESS &&
                "Your password has been changed successfully. You can now sign in."}
            </p>
          </div>

          {step !== STEPS.SUCCESS && (
            <div className="mb-7 flex items-center gap-2">
              {[1, 2, 3].map((number) => (
                <div
                  key={number}
                  className={`h-1.5 flex-1 rounded-full transition ${
                    number <= stepNumber
                      ? "bg-indigo-600"
                      : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
          )}

          {step === STEPS.IDENTIFIER && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Email or Mobile Number
                </span>

                <span className="relative block">
                  {isEmail ? (
                    <Mail
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  ) : (
                    <Smartphone
                      size={18}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  )}

                  <input
                    type="text"
                    name="identifier"
                    value={identifier}
                    onChange={(event) =>
                      setIdentifier(event.target.value)
                    }
                    placeholder="Email or 10-digit mobile number"
                    autoComplete="username"
                    maxLength={100}
                    required
                    aria-invalid={
                      identifier.length > 0 && !isIdentifierValid
                    }
                    className={`w-full rounded-xl border bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
                      identifier.length > 0 && !isIdentifierValid
                        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                        : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                    }`}
                  />
                </span>

                {identifier.length > 0 && !isIdentifierValid && (
                  <span className="mt-2 block text-xs text-rose-600">
                    Enter a valid email address or Indian mobile number.
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={loading || !isIdentifierValid}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Send OTP
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === STEPS.OTP && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  6-digit verification code
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) =>
                    setOtp(
                      event.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !/^\d{6}$/.test(otp)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify OTP
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resending || loading}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                >
                  {resending && (
                    <LoaderCircle size={15} className="animate-spin" />
                  )}
                  {resending ? "Sending..." : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          {step === STEPS.PASSWORD && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  New password
                </span>

                <span className="relative block">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 pr-12 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </span>

                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  Use 8–128 characters, including one letter and one number.
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Confirm new password
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter password again"
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />

                {confirmPassword &&
                  newPassword !== confirmPassword && (
                    <span className="mt-2 block text-xs text-rose-600">
                      Passwords do not match.
                    </span>
                  )}
              </label>

              <button
                type="submit"
                disabled={
                  loading ||
                  !resetToken ||
                  !passwordValid ||
                  newPassword !== confirmPassword
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Resetting password...
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === STEPS.SUCCESS && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                <CheckCircle2
                  size={28}
                  className="mx-auto text-emerald-600"
                />
                <p className="mt-2 text-sm font-semibold text-emerald-800">
                  Password updated successfully
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                Go to Login
                <ArrowRight size={17} />
              </button>
            </div>
          )}

          {step !== STEPS.SUCCESS && (
            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <p className="text-xs leading-5 text-slate-400">
                Your verification code should never be shared with anyone.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
