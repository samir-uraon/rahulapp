"use client";

import { useEffect } from "react";

export default function WebPushNotification() {
  useEffect(() => {
    async function registerWebPush() {
      try {
        if (
          typeof window === "undefined" ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          return;
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          console.log("Notification permission denied");
          return;
        }

        const registration = await navigator.serviceWorker.register(
          "/sw.js"
        );

        const response = await fetch(
          "/api/notifications/vapid-public-key"
        );

        if (!response.ok) {
          throw new Error("Failed to get VAPID public key");
        }

        const { publicKey } = await response.json();

        const existingSubscription =
          await registration.pushManager.getSubscription();

        let subscription = existingSubscription;

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await fetch("/api/notifications/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "web",
            subscription,
          }),
        });

        console.log("Web push registered");
      } catch (error) {
        console.error("Web push registration error:", error);
      }
    }

    registerWebPush();
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String +
    padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}