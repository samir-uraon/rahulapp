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

const normalizeId = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.$oid === "string") return value.$oid;
    return normalizeId(value._id ?? value.id ?? value.teamMemberId ?? value.employeeId);
  }
  return String(value).trim();
};

function getBusinessIds(business) {
  return [
    normalizeId(business?.id),
    normalizeId(business?._id),
  ].filter(Boolean);
}

function getProviderName(provider) {
  return (
    provider?.fullName ||
    provider?.name ||
    provider?.doctorName ||
    provider?.staffName ||
    ""
  );
}

function getBusinessName(business) {
  return (
    business?.name ||
    business?.clinicName ||
    business?.storeName ||
    business?.businessName ||
    ""
  );
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

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(
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

function getAssignedBusinessIds(account) {
  const ids = [
    account.clinicId,
    account.storeId,
    account.businessId,
    account.assignedClinicId,
    account.assignedStoreId,
    account.assignedBusinessId,
    account.clinic?._id,
    account.clinic?.id,
    account.store?._id,
    account.store?.id,
    account.business?._id,
    account.business?.id,
  ];

  const arrayFields = [
    account.clinicIds,
    account.storeIds,
    account.businessIds,
    account.assignedClinics,
    account.assignedStores,
    account.assignedBusinesses,
  ];

  for (const list of arrayFields) {
    if (Array.isArray(list)) {
      ids.push(...list.map(normalizeId));
    }
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
    const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!keyId || !keySecret || !authSecret || !process.env.MONGODB) {
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

      businessId,
      clinicId,
      storeId,

      providerId,
      doctorId,
      staffId,

      patientName,
      customerName,
      patientType,
      bookingFor,
      patientPhone,
      customerPhone,
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

    const isClinic = category === "clinic";
    const collectionName = CATEGORIES[category];

    const normalizedBusinessId = normalizeId(
      businessId || clinicId || storeId
    );
    const normalizedProviderId = normalizeId(
      providerId || doctorId || staffId
    );

    const rawCustomerName =
      typeof customerName === "string" && customerName.trim()
        ? customerName
        : patientName;

    const normalizedCustomerName =
      typeof rawCustomerName === "string" ? rawCustomerName.trim() : "";

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
      !normalizedBusinessId ||
      !ObjectId.isValid(normalizedProviderId) ||
      !normalizedCustomerName ||
      normalizedCustomerName.length > 150 ||
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
    const businesses = db.collection(collectionName);
    const team = db.collection("team");
    const bookingsCollection = db.collection("bookings");
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
      teamLookup.push({ _id: new ObjectId(tokenId) });
    }

    if (tokenEmail) {
      teamLookup.push({ email: tokenEmail }, { emailAddress: tokenEmail });
    }

    if (["doctor", "staff", "provider"].includes(sessionRole)) {
      if (teamLookup.length) {
        account = await team.findOne({ $or: teamLookup });
      }

      if (account) {
        accountType = account.role || sessionRole;
      }
    } else {
      if (ObjectId.isValid(tokenId)) {
        account = await users.findOne({ _id: new ObjectId(tokenId) });
      }

      if (!account && tokenEmail) {
        account = await users.findOne({ email: tokenEmail });
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

    if (!["patient", "user", "doctor", "staff", "provider"].includes(accountType)) {
      return jsonResponse(
        {
          success: false,
          message: "You are not authorized to create bookings.",
        },
        403
      );
    }

    if (
      ["doctor", "staff", "provider"].includes(accountType) &&
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
      normalizeEmail(account.email || account.emailAddress) || tokenEmail;
    const userPhone = account.phone || account.mobile || "";

    // --------------------------------------------------
    // 6. FIND BUSINESS (CLINIC / SALON / PARLOUR / DIAGNOSTIC)
    // --------------------------------------------------

    const businessConditions = [
      { id: normalizedBusinessId },
      { _id: normalizedBusinessId },
    ];

    if (ObjectId.isValid(normalizedBusinessId)) {
      businessConditions.push({ _id: new ObjectId(normalizedBusinessId) });
    }

    const business = await businesses.findOne({
      $or: businessConditions,
    });

    if (!business) {
      return jsonResponse(
        {
          success: false,
          message: "Business not found.",
        },
        404
      );
    }

    const businessIds = getBusinessIds(business);

    // --------------------------------------------------
    // 7. TEAM MEMBER PERMISSION VALIDATION
    // --------------------------------------------------

    if (accountType === "doctor") {
      if (String(account._id) !== normalizedProviderId) {
        return jsonResponse(
          {
            success: false,
            message: "Doctors can only create bookings for themselves.",
          },
          403
        );
      }
    }

    if (["staff", "provider"].includes(accountType)) {
      const assignedBusinessIds = getAssignedBusinessIds(account);
      const hasBusinessAccess = assignedBusinessIds.some((id) =>
        businessIds.includes(id)
      );

      if (!hasBusinessAccess) {
        return jsonResponse(
          {
            success: false,
            message: "You are not assigned to this business.",
          },
          403
        );
      }
    }

    // --------------------------------------------------
    // 8. VERIFY PROVIDER BELONGS TO BUSINESS
    // --------------------------------------------------

    const rawProviderList = [
      ...(Array.isArray(business.doctors) ? business.doctors : []),
      ...(Array.isArray(business.staff) ? business.staff : []),
      ...(Array.isArray(business.team) ? business.team : []),
      ...(Array.isArray(business.members) ? business.members : []),
    ];

    const linkedProviderIds = rawProviderList
      .map(normalizeId)
      .filter(Boolean);

    if (
      linkedProviderIds.length > 0 &&
      !linkedProviderIds.includes(normalizedProviderId)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "This specialist does not belong to the selected business.",
        },
        404
      );
    }

    const provider = await team.findOne({
      _id: new ObjectId(normalizedProviderId),
      isActive: { $ne: false },
      $or: [
        { category },
        ...(isClinic ? [{ category: { $exists: false } }] : []),
      ],
    });

    if (!provider) {
      return jsonResponse(
        {
          success: false,
          message: "Specialist not found or currently inactive.",
        },
        404
      );
    }

    const providerAssignedIds = getAssignedBusinessIds(provider);

    if (
      providerAssignedIds.length > 0 &&
      !providerAssignedIds.some((id) => businessIds.includes(id))
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Specialist is not assigned to this business.",
        },
        400
      );
    }

    // --------------------------------------------------
    // 9. VALIDATE PROVIDER SCHEDULE & CAPACITY
    // --------------------------------------------------

    if (
      Array.isArray(provider.holidayDates) &&
      provider.holidayDates.some((d) => String(d).slice(0, 10) === selectedDate)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "The specialist is on holiday on the selected date.",
        },
        400
      );
    }

    const [year, month, day] = selectedDate.split("-").map(Number);
    const appointmentDateObject = new Date(Date.UTC(year, month - 1, day));

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const dayKey = dayNames[appointmentDateObject.getUTCDay()];
    const daySchedule = getDaySchedule(provider.schedule, dayKey);

    if (
      !daySchedule ||
      daySchedule.active !== true ||
      !Array.isArray(daySchedule.slots)
    ) {
      return jsonResponse(
        {
          success: false,
          message: `The schedule is inactive for ${dayKey}.`,
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
          message: "This slot is not available in the saved schedule.",
        },
        400
      );
    }

    if (normalizeTime(matchingSlot.open) !== requestedTime) {
      return jsonResponse(
        {
          success: false,
          message: "Appointment time must match the selected slot's opening time.",
        },
        400
      );
    }

    const slotCloseMinutes = normalizeTime(matchingSlot.close);

    if (selectedDate === today && slotCloseMinutes <= indiaMinutesNow()) {
      return jsonResponse(
        {
          success: false,
          message: "This appointment slot has already ended.",
        },
        400
      );
    }

    // Verify remaining slot capacity
    const slotCapacity = Number(matchingSlot.capacity);
    if (!Number.isInteger(slotCapacity) || slotCapacity <= 0) {
      return jsonResponse(
        {
          success: false,
          message: "Slot capacity is not configured.",
        },
        400
      );
    }

    const existingBookingsCount = await bookingsCollection.countDocuments({
      $and: [
        {
          $or: [
            { businessId: { $in: businessIds } },
            { clinicId: { $in: businessIds } },
            { storeId: { $in: businessIds } },
          ],
        },
        {
          $or: [
            { providerId: normalizedProviderId },
            { doctorId: normalizedProviderId },
            { staffId: normalizedProviderId },
          ],
        },
        {
          $or: [
            { date: selectedDate },
            { appointmentDate: selectedDate },
            { "appointment.date": selectedDate },
          ],
        },
        {
          $or: [
            { "slot.open": matchingSlot.open, "slot.close": matchingSlot.close },
            {
              "appointment.slot.open": matchingSlot.open,
              "appointment.slot.close": matchingSlot.close,
            },
            { time: matchingSlot.open },
          ],
        },
        {
          status: {
            $nin: ["cancelled", "canceled", "no-show", "noshow", "rejected"],
          },
        },
        {
          paymentStatus: {
            $nin: ["failed", "unpaid", "refunded"],
          },
        },
      ],
    });

    if (existingBookingsCount >= slotCapacity) {
      return jsonResponse(
        {
          success: false,
          message: "This appointment slot is already full.",
        },
        409
      );
    }

    // --------------------------------------------------
    // 10. CUSTOMER / PATIENT DETAILS
    // --------------------------------------------------

    const rawPhone = customerPhone || patientPhone || phone;
    const normalizedCustomerPhone =
      typeof rawPhone === "string" ? rawPhone.trim() : userPhone;

    if (normalizedCustomerPhone && normalizedCustomerPhone.length > 20) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid phone number.",
        },
        400
      );
    }

    const rawType = bookingFor || patientType;
    const normalizedCustomerType =
      typeof rawType === "string" && rawType.trim() ? rawType.trim() : "self";

    const emergency =
      isEmergency === true ||
      String(priority || "").toLowerCase() === "emergency";

    const normalizedBookingPriority = normalizePriority(priority, emergency);

    // --------------------------------------------------
    // 11. BOOKING CHARGE
    // --------------------------------------------------

    const bookingCharge = Number(
      emergency
        ? provider.emergencyBookingCharge ??
            provider.bookingCharge ??
            provider.fee ??
            provider.price
        : provider.bookingCharge ??
            provider.fee ??
            provider.price ??
            provider.emergencyBookingCharge
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
        category,
        businessId: normalizedBusinessId,
        providerId: normalizedProviderId,
        ...(isClinic
          ? { clinicId: normalizedBusinessId, doctorId: normalizedProviderId }
          : { storeId: normalizedBusinessId, staffId: normalizedProviderId }),
        appointmentDate: selectedDate,
        bookingReference: reference,
      },
    });

    // --------------------------------------------------
    // 13. SAVE PENDING PAYMENT ORDER
    // --------------------------------------------------

    const now = new Date();
    const resolvedBusinessName = getBusinessName(business);
    const resolvedProviderName = getProviderName(provider);

    const customerData = {
      name: normalizedCustomerName,
      phone: normalizedCustomerPhone,
      type: normalizedCustomerType,
      age: normalizedAge,
      gender,
    };

    const paymentRecord = {
      reference,
      razorpayOrderId: order.id,

      userId,
      userEmail,
      createdBy: {
        id: userId,
        role: accountType,
        name:
          account.fullName || account.name || token.name || "",
        email: userEmail,
      },

      category,
      collection: collectionName,

      businessId: normalizedBusinessId,
      providerId: normalizedProviderId,
      ...(isClinic
        ? {
            clinicId: normalizedBusinessId,
            doctorId: normalizedProviderId,
          }
        : {
            storeId: normalizedBusinessId,
            staffId: normalizedProviderId,
          }),

      businessName: resolvedBusinessName,
      providerName: resolvedProviderName,
      clinicName: resolvedBusinessName,
      doctorName: resolvedProviderName,

      customer: customerData,
      patient: customerData,

      priority: normalizedBookingPriority,
      isEmergency: emergency,
      bookingType: bookingType || "appointment",

      appointment: {
        date: selectedDate,
        time: matchingSlot.open,
        slot: {
          open: matchingSlot.open,
          close: matchingSlot.close,
          ...(matchingSlot.checkupStartTime
            ? { checkupStartTime: matchingSlot.checkupStartTime }
            : {}),
        },
        ...(arrivalTime !== undefined &&
        arrivalTime !== null &&
        arrivalTime !== ""
          ? { arrivalTime: Number(arrivalTime) }
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
      category,

      businessName: resolvedBusinessName,
      providerName: resolvedProviderName,
      clinicName: resolvedBusinessName,
      doctorName: resolvedProviderName,

      customerName: normalizedCustomerName,
      patientName: normalizedCustomerName,

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
    console.error("Create Razorpay order error:", error?.message || error);

    return jsonResponse(
      {
        success: false,
        message: "Unable to create payment order.",
      },
      500
    );
  }
}