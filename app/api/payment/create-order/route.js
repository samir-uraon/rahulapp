
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import Razorpay from "razorpay";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

const jsonResponse = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeId = (value) => String(value ?? "").trim();

function getDoctorId(value) {
  if (typeof value === "string") return value.trim();

  if (value && typeof value === "object") {
    return normalizeId(value._id ?? value.id);
  }

  return "";
}

function getClinicIds(clinic) {
  return [
    normalizeId(clinic.id),
    normalizeId(clinic._id),
  ].filter(Boolean);
}

function getDoctorName(doctor) {
  return doctor.fullName || doctor.name || doctor.doctorName || "";
}

function getClinicName(clinic) {
  return clinic.name || clinic.clinicName || "";
}

function isValidDateString(value) {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function dateStringInIndia(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getDaySchedule(schedule, dayKey) {
  if (!schedule || typeof schedule !== "object") return null;

  const key = Object.keys(schedule).find(
    (item) => item.toLowerCase() === dayKey.toLowerCase()
  );

  return key ? schedule[key] : null;
}

function normalizeTime(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
      String(value).trim()
    );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function indiaMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const getPart = (type) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return getPart("hour") * 60 + getPart("minute");
}

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

    // 1. Authenticate the user.
    const token = await getToken({
      req: request,
      secret: authSecret,
    });

    if (!token) {
      return jsonResponse(
        { success: false, message: "Please login first." },
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

    // 2. Parse request body.
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { success: false, message: "Invalid request body." },
        400
      );
    }

    const {
      category: requestedCategory,
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

    const category = String(requestedCategory || "clinic")
      .trim()
      .toLowerCase();

    if (!Object.hasOwn(CATEGORIES, category)) {
      return jsonResponse(
        { success: false, message: "Invalid booking category." },
        400
      );
    }

    const collectionName = CATEGORIES[category];
    const normalizedClinicId = normalizeId(clinicId);
    const normalizedDoctorId = normalizeId(doctorId);
    const normalizedPatientName =
      typeof patientName === "string" ? patientName.trim() : "";

    if (
      !normalizedClinicId ||
      !normalizedPatientName ||
      normalizedPatientName.length > 150 ||
      String(age ?? "").trim() === "" ||
      !Number.isInteger(Number(age)) ||
      Number(age) < 0 ||
      Number(age) > 120 ||
      !["Male", "Female", "Other"].includes(gender) ||
      !isValidDateString(date) ||
      typeof time !== "string" ||
      !slot ||
      typeof slot.open !== "string" ||
      typeof slot.close !== "string"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Please provide valid booking details.",
        },
        400
      );
    }

    // Doctor IDs must be MongoDB ObjectIds.
    if (!ObjectId.isValid(normalizedDoctorId)) {
      return jsonResponse(
        { success: false, message: "Invalid doctor ID." },
        400
      );
    }

    // 3. Validate the appointment date using India dates.
    const today = dateStringInIndia();
    const lastDate = addDaysToDateString(today, 13);

    if (date < today || date > lastDate) {
      return jsonResponse(
        {
          success: false,
          message: "Choose a date within the next 14 days.",
        },
        400
      );
    }

    // 4. Connect to MongoDB.
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const users = db.collection("users");
    const clinics = db.collection(collectionName);
    const team = db.collection("team");
    const paymentOrders = db.collection("paymentOrders");

    // 5. Find the signed-in user.
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
    const userPhone = user.phone || user.mobile || "";
    const userEmail = normalizeEmail(user.email) || tokenEmail;

    // 6. Find the business using its custom ID or MongoDB ID.
    const clinicConditions = [
      { id: normalizedClinicId },
      { _id: normalizedClinicId },
    ];

    if (ObjectId.isValid(normalizedClinicId)) {
      clinicConditions.push({
        _id: new ObjectId(normalizedClinicId),
      });
    }

    const clinic = await clinics.findOne({
      $or: clinicConditions,
    });

    if (!clinic) {
      return jsonResponse(
        {
          success: false,
          message: "Clinic or business not found.",
        },
        404
      );
    }

    // 7. Confirm this doctor belongs to the selected business.
    const doctorIds = Array.isArray(clinic.doctors)
      ? clinic.doctors.map(getDoctorId)
      : [];

    if (!doctorIds.includes(normalizedDoctorId)) {
      return jsonResponse(
        {
          success: false,
          message: "This doctor does not belong to the selected clinic.",
        },
        404
      );
    }

    // 8. Load the authoritative doctor profile by ObjectId.
    const doctor = await team.findOne({
      _id: new ObjectId(normalizedDoctorId),
      role: "doctor",
      category: "clinic",
      isActive: { $ne: false },
    });

    if (!doctor) {
      return jsonResponse(
        {
          success: false,
          message: "Doctor not found or currently inactive.",
        },
        404
      );
    }

    const clinicIds = getClinicIds(clinic);
    const doctorClinicId = normalizeId(doctor.clinicId);

    if (doctorClinicId && !clinicIds.includes(doctorClinicId)) {
      return jsonResponse(
        {
          success: false,
          message: "Doctor is not assigned to this clinic.",
        },
        400
      );
    }

    // 9. Validate the doctor's schedule.
    const [year, month, day] = date.split("-").map(Number);
    const appointmentDate = new Date(
      Date.UTC(year, month - 1, day)
    );

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const dayKey = dayNames[appointmentDate.getUTCDay()];
    const daySchedule = getDaySchedule(doctor.schedule, dayKey);

    if (
      !daySchedule ||
      daySchedule.active !== true ||
      !Array.isArray(daySchedule.slots)
    ) {
      return jsonResponse(
        {
          success: false,
          message: `The doctor's schedule is inactive for ${dayKey}.`,
        },
        400
      );
    }

    const requestedOpen = normalizeTime(slot.open);
    const requestedClose = normalizeTime(slot.close);
    const requestedTime = normalizeTime(time);

    if (
      requestedOpen === null ||
      requestedClose === null ||
      requestedTime === null
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid appointment time format.",
        },
        400
      );
    }

    const matchingSlot = daySchedule.slots.find((item) => {
      if (!item) return false;

      return (
        normalizeTime(item.open) === requestedOpen &&
        normalizeTime(item.close) === requestedClose
      );
    });

    if (!matchingSlot) {
      console.error("Appointment slot mismatch:", {
        doctorId: normalizedDoctorId,
        date,
        dayKey,
        requestedSlot: slot,
        savedSlots: daySchedule.slots,
      });

      return jsonResponse(
        {
          success: false,
          message:
            "This appointment slot is not present in the doctor's saved schedule.",
        },
        400
      );
    }

    if (normalizeTime(matchingSlot.open) !== requestedTime) {
      return jsonResponse(
        {
          success: false,
          message:
            "Appointment time must match the selected slot's opening time.",
        },
        400
      );
    }

    const slotCloseMinutes = normalizeTime(matchingSlot.close);

    if (
      date === today &&
      slotCloseMinutes <= indiaMinutesNow()
    ) {
      return jsonResponse(
        {
          success: false,
          message: "This appointment slot has already ended.",
        },
        400
      );
    }

    // 10. Validate the booking charge from the doctor profile.
    const bookingCharge = Number(
      doctor.bookingCharge ?? doctor.fee
    );

    if (!Number.isFinite(bookingCharge) || bookingCharge <= 0) {
      return jsonResponse(
        {
          success: false,
          message: "A valid booking charge is not configured.",
        },
        400
      );
    }

    const amount = Math.round(bookingCharge * 100);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return jsonResponse(
        { success: false, message: "Invalid booking charge." },
        400
      );
    }

    // 11. Create the Razorpay order.
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
        clinicId: normalizedClinicId,
        doctorId: normalizedDoctorId,
        appointmentDate: date,
        bookingReference: reference,
      },
    });

    // 12. Save the pending payment order.
    const now = new Date();

    await paymentOrders.insertOne({
      reference,
      razorpayOrderId: order.id,

      userId,
      userEmail,

      category,
      collection: collectionName,

      clinicId: normalizedClinicId,
      doctorId: normalizedDoctorId,

      patient: {
        name: normalizedPatientName,
        phone: userPhone,
        type:
          typeof patientType === "string" && patientType.trim()
            ? patientType.trim()
            : "self",
        age: Number(age),
        gender,
      },

      appointment: {
        date,
        time: matchingSlot.open,
        slot: {
          open: matchingSlot.open,
          close: matchingSlot.close,
          ...(matchingSlot.checkupStartTime
            ? { checkupStartTime: matchingSlot.checkupStartTime }
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

    // 13. Return Razorpay checkout details.
    return jsonResponse({
      success: true,
      key: keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      reference,
      clinicName: getClinicName(clinic),
      doctorName: getDoctorName(doctor),
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
