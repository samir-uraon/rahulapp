
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  LoaderCircle,
  CheckCircle,
} from "lucide-react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    rawData,
    (char) => char.charCodeAt(0)
  );
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isIOSDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );
}

function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function getBrowserSupport() {
  if (!window.isSecureContext) {
    return "Notifications require HTTPS or localhost.";
  }

  if (!("Notification" in window)) {
    return "This browser does not support notifications.";
  }

  if (!("serviceWorker" in navigator)) {
    return "Service workers are not supported in this browser.";
  }

  if (!("PushManager" in window)) {
    return "Web Push is not supported in this browser.";
  }

  // iOS/iPadOS requires an installed Home Screen web app.
  if (isIOSDevice() && !isInstalledApp()) {
    return "On iPhone or iPad, add Zeriy to your Home Screen and open it from there to enable notifications.";
  }

  return null;
}

export default function EnableNotifications({
  webPushEnabled = false,
  updateSession,
}) {
  const {
    data: session,
    status,
    update,
  } = useSession();

  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(
    Boolean(webPushEnabled)
  );
  const [message, setMessage] = useState("");

  const syncSession = updateSession || update;

  // Keep component synchronized with server data.
  useEffect(() => {
    setEnabled(Boolean(webPushEnabled));
  }, [webPushEnabled]);

  const updateServerSession = useCallback(
    async (value) => {
      try {
        await syncSession({
          webPushEnabled: value,
        });
      } catch (error) {
        console.error("Session update error:", error);
      }
    },
    [syncSession]
  );

  // ==========================================
  // ENABLE NOTIFICATIONS
  // ==========================================

  async function enableNotifications() {
    try {
      setLoading(true);
      setMessage("");

      if (
        status !== "authenticated" ||
        !session?.user
      ) {
        throw new Error("Please login first.");
      }

      const unsupported = getBrowserSupport();

      if (unsupported) {
        throw new Error(unsupported);
      }

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

      if (!publicKey) {
        throw new Error("VAPID public key is missing.");
      }

      const applicationServerKey =
        urlBase64ToUint8Array(publicKey);

      // Request permission only after user interaction.
      let permission = Notification.permission;

      if (permission === "default") {
        permission =
          await Notification.requestPermission();
      }

      if (permission !== "granted") {
        if (permission === "denied") {
          throw new Error(
            "Notifications are blocked. Allow them in your browser settings."
          );
        }

        throw new Error(
          "Notification permission was not granted."
        );
      }

      // Register service worker.
      const registration =
        await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
          }
        );

      // Wait until service worker is ready.
      await navigator.serviceWorker.ready;

      // Get existing subscription.
      let subscription =
        await registration.pushManager.getSubscription();

      // Check existing VAPID key.
      if (subscription) {
        const existingKey =
          subscription.options?.applicationServerKey;

        const existingPublicKey = existingKey
          ? arrayBufferToBase64Url(existingKey)
          : "";

        const normalizedPublicKey =
          arrayBufferToBase64Url(applicationServerKey);

        if (
          existingPublicKey &&
          existingPublicKey !== normalizedPublicKey
        ) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }

      // Create subscription if required.
      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
      }

      // Save subscription to MongoDB.
      const response = await fetch(
        "/api/notifications/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(
            subscription.toJSON()
          ),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "Unable to save push subscription."
        );
      }

      setEnabled(true);

      await updateServerSession(true);

      setMessage(
        "Notifications enabled successfully!"
      );
    } catch (error) {
      console.error(
        "Enable notification error:",
        error
      );

      setMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // DISABLE NOTIFICATIONS
  // ==========================================

  async function disableNotifications() {
    try {
      setLoading(true);
      setMessage("");

      if (
        status !== "authenticated" ||
        !session?.user
      ) {
        throw new Error("Please login first.");
      }

      let registration = null;
      let subscription = null;

      if ("serviceWorker" in navigator) {
        registration =
          await navigator.serviceWorker.getRegistration(
            "/"
          );

        subscription =
          await registration?.pushManager.getSubscription();
      }

      // Remove subscription from server.
      const response = await fetch(
        "/api/notifications/subscribe",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(
            subscription
              ? subscription.toJSON()
              : {}
          ),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "Unable to disable notifications."
        );
      }

      // Remove local browser subscription.
      if (subscription) {
        await subscription.unsubscribe();
      }

      setEnabled(false);

      await updateServerSession(false);

      setMessage(
        "Notifications disabled successfully!"
      );
    } catch (error) {
      console.error(
        "Disable notification error:",
        error
      );

      setMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // TOGGLE
  // ==========================================

  async function handleToggle() {
    if (loading) return;

    if (enabled) {
      await disableNotifications();
    } else {
      await enableNotifications();
    }
  }

  if (
    status !== "authenticated" ||
    !session?.user
  ) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-start">

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
          enabled
            ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-violet-600 text-white shadow-sm shadow-violet-200 hover:bg-violet-700 hover:shadow-md"
        }`}
      >
        {loading ? (
          <LoaderCircle
            size={17}
            className="animate-spin"
          />
        ) : enabled ? (
          <CheckCircle size={17} />
        ) : (
          <Bell
            size={17}
            className="transition-transform group-hover:rotate-12"
          />
        )}

        <span>
          {loading
            ? "Please wait..."
            : enabled
            ? "Notifications Enabled"
            : "Enable Notifications"}
        </span>
      </button>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`flex items-start gap-1.5 text-xs ${
            message.includes("successfully")
              ? "text-green-600"
              : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}

    </div>
  );
}
