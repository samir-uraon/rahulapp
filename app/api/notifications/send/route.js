
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import webpush from "web-push";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const revalidate = 0;

const DATABASE_NAME = "rahul";
const SITE_URL = "https://zeriy.vercel.app";

// Get possible MongoDB ID formats.
function getIdVariants(id) {
  const value = String(id || "").trim();

  if (!value) return [];

  const variants = [value];

  if (ObjectId.isValid(value) && String(new ObjectId(value)) === value) {
    variants.push(new ObjectId(value));
  }

  return variants;
}

// Validate Web Push subscription.
function isValidSubscription(subscription) {
  return Boolean(
    subscription &&
      typeof subscription === "object" &&
      subscription.endpoint &&
      subscription.keys?.p256dh &&
      subscription.keys?.auth
  );
}

// Allow only internal Zeriy notification URLs.
function getNotificationUrl(url) {
  const baseUrl = process.env.NEXTAUTH_URL2?.trim();

  if (!baseUrl) return "/";

  return `${baseUrl.replace(/\/+$/, "")}/${String(url || "/").replace(/^\/+/, "")}`;
}

// Configure VAPID safely.
function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch (error) {
    console.error("VAPID configuration error:", error);
    return false;
  }
}

// Save notification and send Web Push.
async function sendPushNotification({
  db,
  teamCollection,
  recipient,
  title,
  message,
  url,
  sentBy,
  senderRole,
  dedupeKey,
}) {
  const doctorId = String(recipient._id);

  const notificationsCollection = db.collection("notifications");

  // Prevent duplicate notifications.
  if (dedupeKey) {
    const existingNotification = await notificationsCollection.findOne({
      recipientId: recipient._id,
      dedupeKey,
    });

    if (existingNotification) {
      return {
        doctorId,
        saved: false,
        pushSent: false,
        skipped: true,
        reason: "Duplicate notification",
      };
    }
  }

  // Save notification.
  const notificationDocument = {
    recipientId: recipient._id,
    recipientRole: recipient.role,
    title,
    message,
    url,
    sentBy,
    senderRole,
    type: "emergency",
    read: false,
    createdAt: new Date(),
    ...(dedupeKey ? { dedupeKey } : {}),
  };

  try {
    await notificationsCollection.insertOne(notificationDocument);
  } catch (error) {
    if (error.code === 11000) {
      return {
        doctorId,
        saved: false,
        pushSent: false,
        skipped: true,
        reason: "Duplicate notification",
      };
    }

    throw error;
  }

  // Check whether doctor enabled Web Push.
  if (recipient.webPushEnabled !== true) {
    return {
      doctorId,
      saved: true,
      pushSent: false,
      skipped: true,
      reason: "Web Push is disabled for this doctor",
    };
  }

  const subscription = recipient.webPushSubscription;

  if (!isValidSubscription(subscription)) {
    return {
      doctorId,
      saved: true,
      pushSent: false,
      skipped: true,
      reason: "Doctor has no valid push subscription",
    };
  }

  // Check VAPID configuration.
  if (!configureWebPush()) {
    return {
      doctorId,
      saved: true,
      pushSent: false,
      skipped: true,
      reason: "Web Push VAPID configuration is missing or invalid",
    };
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body: message,
        message,
        url,
        type: "emergency",
        createdAt: new Date().toISOString(),
      }),
      {
        TTL: 3600,
        urgency: "high",
      }
    );

    return {
      doctorId,
      saved: true,
      pushSent: true,
      skipped: false,
      reason: "Notification sent successfully",
    };
  } catch (error) {
    console.error("Web Push delivery error:", error);

    // Remove expired subscriptions.
    if (error.statusCode === 404 || error.statusCode === 410) {
      await teamCollection.updateOne(
        { _id: recipient._id },
        {
          $set: {
            webPushEnabled: false,
            updatedAt: new Date(),
          },
          $unset: {
            webPushSubscription: "",
          },
        }
      );

      return {
        doctorId,
        saved: true,
        pushSent: false,
        skipped: true,
        reason: "Doctor subscription expired and was disabled",
      };
    }

    return {
      doctorId,
      saved: true,
      pushSent: false,
      skipped: false,
      reason: "Push delivery failed",
    };
  }
}

export async function POST(request) {
  try {
    // 1. Authenticate the sender.
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (session.user.role !== "user") {
      return NextResponse.json(
        {
          success: false,
          message: "You are not allowed to send this notification",
        },
        { status: 403 }
      );
    }

    // 2. Read request body.
    const body = await request.json();

    const {
      doctorId,
      title,
      message,
      url,
      dedupeKey,
    } = body;

    if (!doctorId || typeof doctorId !== "string" && typeof doctorId !== "number") {
      return NextResponse.json(
        {
          success: false,
          message: "Valid doctorId is required",
        },
        { status: 400 }
      );
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid title and message are required",
        },
        { status: 400 }
      );
    }

    if (
      dedupeKey !== undefined &&
      (typeof dedupeKey !== "string" || dedupeKey.length > 200)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid dedupeKey",
        },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB.
    const client = await clientPromise;
    const db = client.db(DATABASE_NAME);
    const teamCollection = db.collection("team");

    // 4. Find doctor directly using doctorId.
    const doctorIdString = String(doctorId).trim();

    const doctorConditions = [
      { id: doctorIdString },
      { doctorId: doctorIdString },
      { teamMemberId: doctorIdString },
    ];

    const objectId = getIdVariants(doctorIdString).find(
      (value) => value instanceof ObjectId
    );

    if (objectId) {
      doctorConditions.push({ _id: objectId });
    }

    const doctor = await teamCollection.findOne({
      role: "doctor",
      $or: doctorConditions,
    });

    if (!doctor) {
      return NextResponse.json(
        {
          success: false,
          message: "Doctor not found in team",
        },
        { status: 404 }
      );
    }

    // 5. Send notification to the doctor.
    const result = await sendPushNotification({
      db,
      teamCollection,
      recipient: doctor,
      title: title.trim(),
      message: message.trim(),
      url: getNotificationUrl(url),
      sentBy: session.user.id || session.user.email || null,
      senderRole: session.user.role,
      dedupeKey: dedupeKey?.trim() || null,
    });

    return NextResponse.json({
      success: true,
      message: result.reason,
      recipients: 1,
      saved: result.saved ? 1 : 0,
      pushSent: result.pushSent ? 1 : 0,
      skipped: result.skipped ? 1 : 0,
      results: [result],
    });
  } catch (error) {
    console.error("Send notification API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send notification",
      },
      { status: 500 }
    );
  }
}
