"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function RazorpayPayment({
  bookingId,
  amount,
  user,
}) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          bookingId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create order");
      }

      const script = document.createElement("script");

      script.src = "https://checkout.razorpay.com/v1/checkout.js";

      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,

          amount: data.order.amount,
          currency: data.order.currency,

          name: "QueueEase",
          description: "Doctor Consultation",

          order_id: data.order.id,

          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: user?.phone || "",
          },

          theme: {
            color: "#4f46e5",
          },

          handler: async function (paymentResponse) {
            try {
              const verifyResponse = await fetch(
                "/api/payment/verify",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    bookingId,
                    ...paymentResponse,
                  }),
                }
              );

              const result = await verifyResponse.json();

              if (result.success) {
                toast.success("Payment successful");

                window.location.href =
                  `/booking/${bookingId}/success`;
              } else {
                toast.error(
                  result.error || "Payment verification failed"
                );
              }
            } catch (error) {
              console.error(error);
              toast.error("Payment verification failed");
            } finally {
              setLoading(false);
            }
          },

          modal: {
            ondismiss: () => {
              setLoading(false);
            },
          },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.open();
      };

      script.onerror = () => {
        toast.error("Unable to load Razorpay");
        setLoading(false);
      };

      document.body.appendChild(script);
    } catch (error) {
      console.error(error);

      toast.error(
        error.message || "Payment failed"
      );

      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={loading}
      className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading
        ? "Processing..."
        : `Pay ₹${amount}`}
    </button>
  );
}