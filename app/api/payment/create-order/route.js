
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import Razorpay from "razorpay";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

const TIME_ZONE = "Asia/Kolkata";

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
    timeZone: TIME_ZONE,
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
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const getPart = (type) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return getPart("hour") * 60 + getPart("minute");
}

function getAssignedClinicIds(account) {
  const ids = [
    account.clinicId,
    account.businessId,
    account.assignedClinicId,
    account.clinic?._id,
    account.clinic?.id,
  ];

  if (Array.isArray(account.clinicIds)) {
    ids.push(...account.clinicIds);
  }

  if (Array.isArray(account.assignedClinics)) {
    ids.push(
      ...account.assignedClinics.map((item) =>
        typeof item === "object"
          ? item._id ?? item.id
          : item
      )
    );
  }

  return [...new Set(ids.map(normalizeId).filter(Boolean))];
}

function normalizePriority(value, isEmergency) {
  if (isEmergency) return "emergency";

  const priority = String(value || "normal")
    .trim()
    .toLowerCase();

  if (["normal", "elderly", "emergency"].includes(priority)) {
    return priority;
  }

  return "normal";
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

    // --------------------------------------------------
    // 1. AUTHENTICATION
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. REQUEST BODY
    // --------------------------------------------------

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
      category: requestedCategory,
      clinicId,
      doctorId,

      patientName,
      patientType,
      patientPhone,
      phone,

      age,
      gender,

      priority,
      isEmergency,
      bookingType,

      appointmentDate,
      date,

      time,
      slot,
      slotOpen,
      slotClose,
      arrivalTime,
    } = body || {};

    const category = String(requestedCategory || "clinic")
      .trim()
      .toLowerCase();

    if (!Object.hasOwn(CATEGORIES, category)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid booking category.",
        },
        400
      );
    }

    const collectionName = CATEGORIES[category];

    const normalizedClinicId = normalizeId(clinicId);
    const normalizedDoctorId = normalizeId(doctorId);

    const normalizedPatientName =
      typeof patientName === "string"
        ? patientName.trim()
        : "";

    // Support both old and new frontend payloads.
    const selectedDate = appointmentDate || date;

    const selectedSlot = {
      open: slot?.open || slotOpen,
      close: slot?.close || slotClose,
    };

    const selectedTime =
      typeof time === "string" && time.trim()
        ? time.trim()
        : selectedSlot.open;

    const normalizedAge = Number(age);

    if (
      !normalizedClinicId ||
      !ObjectId.isValid(normalizedDoctorId) ||
      !normalizedPatientName ||
      normalizedPatientName.length > 150 ||
      String(age ?? "").trim() === "" ||
      !Number.isInteger(normalizedAge) ||
      normalizedAge < 0 ||
      normalizedAge > 120 ||
      !["Male", "Female", "Other"].includes(gender) ||
      !isValidDateString(selectedDate) ||
      typeof selectedSlot.open !== "string" ||
      typeof selectedSlot.close !== "string"
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Please provide valid booking details.",
        },
        400
      );
    }

    // --------------------------------------------------
    // 3. DATE VALIDATION
    // --------------------------------------------------

    const today = dateStringInIndia();
    const lastDate = addDaysToDateString(today, 13);

    if (selectedDate < today || selectedDate > lastDate) {
      return jsonResponse(
        {
          success: false,
          message: "Choose a date within the next 14 days.",
        },
        400
      );
    }

    // --------------------------------------------------
    // 4. DATABASE
    // --------------------------------------------------

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const users = db.collection("users");
    const clinics = db.collection(collectionName);
    const team = db.collection("team");
    const paymentOrders = db.collection("paymentOrders");

    // --------------------------------------------------
    // 5. FIND AUTHENTICATED ACCOUNT
    // --------------------------------------------------

    const sessionRole = String(token.role || "")
      .trim()
      .toLowerCase();

    let account = null;
    let accountType = "";

    const teamLookup = [];

    if (ObjectId.isValid(tokenId)) {
      teamLookup.push({
        _id: new ObjectId(tokenId),
      });
    }

    if (tokenEmail) {
      teamLookup.push(
        { email: tokenEmail },
        { emailAddress: tokenEmail }
      );
    }

    // Doctor/staff accounts are stored in team.
    if (["doctor", "staff"].includes(sessionRole)) {
      if (teamLookup.length) {
        account = await team.findOne({
          $or: teamLookup,
        });
      }

      if (account) {
        accountType = account.role;
      }
    } else {
      // Patient accounts are stored in users.
      if (ObjectId.isValid(tokenId)) {
        account = await users.findOne({
          _id: new ObjectId(tokenId),
        });
      }

      if (!account && tokenEmail) {
        account = await users.findOne({
          email: tokenEmail,
        });
      }

      if (account) {
        accountType = "patient";
      }
    }

    if (!account) {
      return jsonResponse(
        {
          success: false,
          message: "Account not found. Please sign in again.",
        },
        404
      );
    }

    if (
      !["patient", "doctor", "staff"].includes(accountType)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "You are not authorized to create bookings.",
        },
        403
      );
    }

    if (
      ["doctor", "staff"].includes(accountType) &&
      account.isActive === false
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Your team account is currently inactive.",
        },
        403
      );
    }

    const userId = String(account._id);

    const userEmail =
      normalizeEmail(account.email || account.emailAddress) ||
      tokenEmail;

    const userPhone =
      account.phone || account.mobile || "";

    // --------------------------------------------------
    // 6. FIND CLINIC
    // --------------------------------------------------

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

    const clinicIds = getClinicIds(clinic);

    // --------------------------------------------------
    // 7. DOCTOR / STAFF PERMISSION VALIDATION
    // --------------------------------------------------

    if (accountType === "doctor") {
      // Doctors can only create bookings for themselves.
      if (String(account._id) !== normalizedDoctorId) {
        return jsonResponse(
          {
            success: false,
            message: "Doctors can only create bookings for themselves.",
          },
          403
        );
      }
    }

    if (accountType === "staff") {
      // Staff must belong to the selected clinic.
      const assignedClinicIds = getAssignedClinicIds(account);

      const hasClinicAccess = assignedClinicIds.some((id) =>
        clinicIds.includes(id)
      );

      if (!hasClinicAccess) {
        return jsonResponse(
          {
            success: false,
            message: "You are not assigned to this clinic.",
          },
          403
        );
      }
    }

    // --------------------------------------------------
    // 8. VERIFY DOCTOR BELONGS TO CLINIC
    // --------------------------------------------------

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

    const doctorClinicId = normalizeId(doctor.clinicId);

    if (
      doctorClinicId &&
      !clinicIds.includes(doctorClinicId)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Doctor is not assigned to this clinic.",
        },
        400
      );
    }

    // --------------------------------------------------
    // 9. VALIDATE DOCTOR SCHEDULE
    // --------------------------------------------------

    const [year, month, day] = selectedDate
      .split("-")
      .map(Number);

    const appointmentDateObject = new Date(
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

    const dayKey =
      dayNames[appointmentDateObject.getUTCDay()];

    const daySchedule = getDaySchedule(
      doctor.schedule,
      dayKey
    );

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

    const requestedOpen = normalizeTime(selectedSlot.open);
    const requestedClose = normalizeTime(selectedSlot.close);
    const requestedTime = normalizeTime(selectedTime);

    if (
      requestedOpen === null ||
      requestedClose === null ||
      requestedTime === null ||
      requestedOpen >= requestedClose
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
      return jsonResponse(
        {
          success: false,
          message: "This appointment slot is not available in the doctor's saved schedule.",
        },
        400
      );
    }

    if (
      normalizeTime(matchingSlot.open) !== requestedTime
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Appointment time must match the selected slot's opening time.",
        },
        400
      );
    }

    const slotCloseMinutes = normalizeTime(
      matchingSlot.close
    );

    if (
      selectedDate === today &&
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

    // --------------------------------------------------
    // 10. PATIENT DETAILS
    // --------------------------------------------------

    const normalizedPatientPhone =
      typeof (patientPhone || phone) === "string"
        ? (patientPhone || phone).trim()
        : userPhone;

    if (
      normalizedPatientPhone &&
      normalizedPatientPhone.length > 20
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid patient phone number.",
        },
        400
      );
    }

    const normalizedPatientType =
      typeof patientType === "string" && patientType.trim()
        ? patientType.trim()
        : "self";

    const emergency = isEmergency === true ||
      String(priority || "").toLowerCase() === "emergency";

    const normalizedBookingPriority = normalizePriority(
      priority,
      emergency
    );

    // --------------------------------------------------
    // 11. BOOKING CHARGE
    // --------------------------------------------------

    const bookingCharge = Number(
      emergency
        ? doctor.emergencyBookingCharge ??
            doctor.bookingCharge ??
            doctor.fee
        : doctor.bookingCharge ??
            doctor.fee ??
            doctor.emergencyBookingCharge
    );

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

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid booking charge.",
        },
        400
      );
    }

    // --------------------------------------------------
    // 12. CREATE RAZORPAY ORDER
    // --------------------------------------------------

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
        accountType,
        clinicId: normalizedClinicId,
        doctorId: normalizedDoctorId,
        appointmentDate: selectedDate,
        bookingReference: reference,
      },
    });

    // --------------------------------------------------
    // 13. SAVE PENDING PAYMENT ORDER
    // --------------------------------------------------

    const now = new Date();

    const paymentRecord = {
      reference,
      razorpayOrderId: order.id,

      // Authenticated account.
      userId,
      userEmail,
      createdBy: {
        id: userId,
        role: accountType,
        name:
          account.fullName ||
          account.name ||
          token.name ||
          "",
        email: userEmail,
      },

      category,
      collection: collectionName,

      clinicId: normalizedClinicId,
      doctorId: normalizedDoctorId,

      clinicName: getClinicName(clinic),
      doctorName: getDoctorName(doctor),

      // Actual patient.
      patient: {
        name: normalizedPatientName,
        phone: normalizedPatientPhone,
        type: normalizedPatientType,
        age: normalizedAge,
        gender,
      },

      priority: normalizedBookingPriority,
      isEmergency: emergency,
      bookingType: bookingType || "normal",

      appointment: {
        date: selectedDate,
        time: matchingSlot.open,

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

        ...(arrivalTime !== undefined &&
        arrivalTime !== null &&
        arrivalTime !== ""
          ? {
              arrivalTime: Number(arrivalTime),
            }
          : {}),
      },

      amount: order.amount,
      currency: order.currency,

      status: "pending",
      paymentStatus: "pending",
      bookingStatus: "pending",

      createdAt: now,
      updatedAt: now,
    };

    await paymentOrders.insertOne(paymentRecord);

    // --------------------------------------------------
    // 14. RESPONSE
    // --------------------------------------------------

    return jsonResponse({
      success: true,

      key: keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,

      reference,

      clinicName: getClinicName(clinic),
      doctorName: getDoctorName(doctor),

      patientName: normalizedPatientName,

      createdBy: accountType,

      appointment: {
        date: selectedDate,
        time: matchingSlot.open,
        slot: {
          open: matchingSlot.open,
          close: matchingSlot.close,
        },
      },
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
