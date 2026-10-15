import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import Razorpay from "razorpay";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const jsonResponse = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeId = (value) => String(value ?? "");

export async function POST(request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const authSecret =
      process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (
      !keyId ||
      !keySecret ||
      !authSecret ||
      !process.env.MONGODB
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Payment service is not configured.",
        },
        500
      );
    }

    const token = await getToken({
      req: request,
      secret: authSecret,
    });

    if (!token) {
      return jsonResponse(
        {
          success: false,
          message: "Please login first.",
        },
        401
      );
    }

    const tokenId = normalizeId(token.id || token.sub);
    const tokenEmail = normalizeEmail(token.email);

    if (!tokenId && !tokenEmail) {
      return jsonResponse(
        {
          success: false,
          message: "User information is missing from your session.",
        },
        401
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid request body.",
        },
        400
      );
    }

    const {
      clinicId,
      doctorId,
      patientName,
      patientType,
      age,
      gender,
      date,
      time,
      slot,
    } = body || {};

    if (
      typeof clinicId !== "string" ||
      !clinicId.trim() ||
      typeof doctorId !== "string" ||
      !doctorId.trim() ||
      typeof patientName !== "string" ||
      !patientName.trim() ||
      !Number.isInteger(Number(age)) ||
      Number(age) < 0 ||
      Number(age) > 120 ||
      !["Male", "Female", "Other"].includes(gender) ||
      typeof date !== "string" ||
      typeof time !== "string" ||
      typeof slot?.open !== "string" ||
      typeof slot?.close !== "string"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Please provide valid booking details.",
        },
        400
      );
    }

    const appointmentDate = new Date(`${date}T00:00:00`);

    const normalizedDate =
      `${appointmentDate.getFullYear()}-` +
      `${String(appointmentDate.getMonth() + 1).padStart(2, "0")}-` +
      `${String(appointmentDate.getDate()).padStart(2, "0")}`;

    if (
      Number.isNaN(appointmentDate.getTime()) ||
      normalizedDate !== date
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid appointment date.",
        },
        400
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + 13);

    if (
      appointmentDate < today ||
      appointmentDate > lastDate
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Choose a date within the next 14 days.",
        },
        400
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const users = db.collection("users");
    const clinics = db.collection("clinics");
    const paymentOrders = db.collection("paymentOrders");

    let user = null;

    if (ObjectId.isValid(tokenId)) {
      user = await users.findOne({
        _id: new ObjectId(tokenId),
      });
    }

    if (!user && tokenEmail) {
      user = await users.findOne({
        email: tokenEmail,
      });
    }

    if (!user) {
      return jsonResponse(
        {
          success: false,
          message: "User account not found. Please sign in again.",
        },
        404
      );
    }

    const userId = String(user._id);
    const userEmail = normalizeEmail(user.email) || tokenEmail;

    const clinic = await clinics.findOne({
      id: String(clinicId).trim(),
    });

    if (!clinic) {
      return jsonResponse(
        {
          success: false,
          message: "Clinic not found.",
        },
        404
      );
    }

    const doctor = (clinic.doctors || []).find(
      (item) => normalizeId(item.id) === String(doctorId).trim()
    );

    if (!doctor) {
      return jsonResponse(
        {
          success: false,
          message: "Doctor not found.",
        },
        404
      );
    }

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const dayKey = dayNames[appointmentDate.getDay()];
    const daySchedule = doctor.schedule?.[dayKey];

    const matchingSlot = daySchedule?.slots?.find(
      (item) =>
        item.open === slot.open &&
        item.close === slot.close
    );

    if (!daySchedule?.active || !matchingSlot) {
      return jsonResponse(
        {
          success: false,
          message: "This appointment slot is unavailable.",
        },
        400
      );
    }

    if (time !== matchingSlot.open) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid appointment time.",
        },
        400
      );
    }

    const bookingCharge = Number(doctor.bookingCharge);

    if (
      !Number.isFinite(bookingCharge) ||
      bookingCharge <= 0
    ) {
      return jsonResponse(
        {
          success: false,
          message: "A valid booking charge is not configured.",
        },
        400
      );
    }

    const amount = Math.round(bookingCharge * 100);
    const reference = randomUUID();

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `ZR-${reference.replaceAll("-", "").slice(0, 20)}`,
      notes: {
        userId,
        clinicId: String(clinicId).trim(),
        doctorId: String(doctorId).trim(),
        appointmentDate: date,
        bookingReference: reference,
      },
    });

    const now = new Date();

    await paymentOrders.insertOne({
      reference,
      razorpayOrderId: order.id,

      userId,
      userEmail,

      clinicId: String(clinicId).trim(),
      doctorId: String(doctorId).trim(),

      patient: {
        name: patientName.trim(),
        type: patientType || "self",
        age: Number(age),
        gender,
      },

      appointment: {
        date,
        time,
        slot: {
          open: matchingSlot.open,
          close: matchingSlot.close,
          ...(matchingSlot.checkupStartTime
            ? {
                checkupStartTime:
                  matchingSlot.checkupStartTime,
              }
            : {}),
        },
      },

      amount: order.amount,
      currency: order.currency,

      status: "pending",
      paymentStatus: "pending",
      bookingStatus: "pending",

      createdAt: now,
      updatedAt: now,
    });

    return jsonResponse({
      success: true,
      key: keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      reference,
      clinicName: clinic.name || clinic.clinicName || "",
      doctorName: doctor.name || doctor.doctorName || "",
    });
  } catch (error) {
    console.error(
      "Create Razorpay order error:",
      error?.message || error
    );

    return jsonResponse(
      {
        success: false,
        message: "Unable to create payment order.",
      },
      500
    );
  }
} 