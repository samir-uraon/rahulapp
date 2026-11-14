
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Bell, LoaderCircle, CheckCircle } from "lucide-react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(rawData, (char) =>
    char.charCodeAt(0)
  );
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isIOSDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
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
    return "Service workers are not supported.";
  }

  if (!("PushManager" in window)) {
    return "Web Push is not supported.";
  }

  if (isIOSDevice() && !isInstalledApp()) {
    return "Add Zeriy to your Home Screen to enable notifications.";
  }

  return null;
}

// Native Expo token bridge
function requestNativePushToken() {
  return new Promise((resolve, reject) => {
    const bridge = window.ReactNativeWebView;

    if (typeof bridge?.postMessage !== "function") {
      reject(new Error("Zeriy mobile app not detected."));
      return;
    }

    let timeout;

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("ZERIY_PUSH_TOKEN", handleToken);
      window.removeEventListener("ZERIY_PUSH_ERROR", handleError);
    };

    const handleToken = (event) => {
      cleanup();

      if (typeof event.detail !== "string" || !event.detail) {
        reject(new Error("Empty Expo push token."));
        return;
      }

      resolve(event.detail);
    };

    const handleError = (event) => {
      cleanup();
      reject(new Error(event.detail || "Native notification registration failed."));
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Mobile notification registration timed out."));
    }, 30000);

    window.addEventListener("ZERIY_PUSH_TOKEN", handleToken);
    window.addEventListener("ZERIY_PUSH_ERROR", handleError);

    bridge.postMessage("ZERIY_REGISTER_PUSH");
  });
}

export default function EnableNotifications({
  webPushEnabled = false,
  expoPushEnabled = false,
  updateSession,
}) {
  const { data: session, status, update } = useSession();

  const [loading, setLoading] = useState(false);
  const [webEnabled, setWebEnabled] = useState(Boolean(webPushEnabled));
  const [expoEnabled, setExpoEnabled] = useState(Boolean(expoPushEnabled));
  const [message, setMessage] = useState("");

  const syncSession = updateSession || update;

  // Detect Expo WebView
  const isNativeApp =
    typeof window !== "undefined" &&
    typeof window.ReactNativeWebView?.postMessage === "function";

  // Select the correct notification setting
  const enabled = isNativeApp ? expoEnabled : webEnabled;

  useEffect(() => {
    setWebEnabled(Boolean(webPushEnabled));
  }, [webPushEnabled]);

  useEffect(() => {
    setExpoEnabled(Boolean(expoPushEnabled));
  }, [expoPushEnabled]);

  const updateServerSession = useCallback(
    async (field, value) => {
      try {
        await syncSession({
          [field]: value,
        });
      } catch (error) {
        console.error("Session update error:", error);
      }
    },
    [syncSession]
  );

  // ==========================================
  // NATIVE EXPO NOTIFICATIONS
  // ==========================================

  async function enableNativeNotifications() {
    const token = await requestNativePushToken();

    const response = await fetch(
      "/api/notifications/native-subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ token }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to save Expo push token."
      );
    }

    setExpoEnabled(true);

    await updateServerSession("expoPushEnabled", true);

    setMessage("Mobile notifications enabled successfully!");
  }

  async function disableNativeNotifications() {
    const token = await requestNativePushToken();

    const response = await fetch(
      "/api/notifications/native-subscribe",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ token }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to disable mobile notifications."
      );
    }

    setExpoEnabled(false);

    await updateServerSession("expoPushEnabled", false);

    setMessage("Mobile notifications disabled successfully!");
  }

  // ==========================================
  // WEBSITE WEB PUSH NOTIFICATIONS
  // ==========================================

  async function enableWebNotifications() {
    const unsupported = getBrowserSupport();

    if (unsupported) {
      throw new Error(unsupported);
    }

    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

    if (!publicKey) {
      throw new Error("VAPID public key is missing.");
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "Notifications are blocked. Allow them in browser settings."
          : "Notification permission was not granted."
      );
    }

    const registration =
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

    await navigator.serviceWorker.ready;

    let subscription =
      await registration.pushManager.getSubscription();

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

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const response = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(subscription.toJSON()),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to save web push subscription."
      );
    }

    setWebEnabled(true);

    await updateServerSession("webPushEnabled", true);

    setMessage("Website notifications enabled successfully!");
  }

  async function disableWebNotifications() {
    let registration = null;
    let subscription = null;

    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.getRegistration("/");
      subscription =
        await registration?.pushManager.getSubscription();
    }

    const response = await fetch("/api/notifications/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(
        subscription ? subscription.toJSON() : {}
      ),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to disable web notifications."
      );
    }

    if (subscription) {
      await subscription.unsubscribe();
    }

    setWebEnabled(false);

    await updateServerSession("webPushEnabled", false);

    setMessage("Website notifications disabled successfully!");
  }

  // ==========================================
  // ENABLE / DISABLE
  // ==========================================

  async function handleToggle() {
    if (loading) return;

    try {
      setLoading(true);
      setMessage("");

      if (status !== "authenticated" || !session?.user) {
        throw new Error("Please login first.");
      }

      if (isNativeApp) {
        if (enabled) {
          await disableNativeNotifications();
        } else {
          await enableNativeNotifications();
        }
      } else {
        if (enabled) {
          await disableWebNotifications();
        } else {
          await enableWebNotifications();
        }
      }
    } catch (error) {
      console.error("Notification error:", error);
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (status !== "authenticated" || !session?.user) {
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
            : "bg-violet-600 text-white shadow-sm shadow-violet-200 hover:bg-violet-700"
        }`}
      >
        {loading ? (
          <LoaderCircle size={17} className="animate-spin" />
        ) : enabled ? (
          <CheckCircle size={17} />
        ) : (
          <Bell size={17} className="transition-transform group-hover:rotate-12" />
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
