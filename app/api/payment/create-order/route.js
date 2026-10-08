import { NextResponse } from "next/server";
import razorpay from "@/lib/razorpay";

export async function POST(request) {
  try {
    const { amount, bookingId } = await request.json();

    if (!amount || !bookingId) {
      return NextResponse.json(
        { error: "Amount and bookingId are required" },
        { status: 400 }
      );
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `booking_${bookingId}`,
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Razorpay order error:", error);

    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}