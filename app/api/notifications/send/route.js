
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import webpush from "web-push";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const revalidate = 0;

const DATABASE_NAME = "rahul";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

// Select the channel with the latest preference timestamp.
function getLatestNotificationPreference(recipient) {
  const webTime = recipient.webPushUpdatedAt
    ? new Date(recipient.webPushUpdatedAt).getTime()
    : 0;

  const expoTime = recipient.expoPushUpdatedAt
    ? new Date(recipient.expoPushUpdatedAt).getTime()
    : 0;

  const validWebTime = Number.isFinite(webTime) ? webTime : 0;
  const validExpoTime = Number.isFinite(expoTime) ? expoTime : 0;

  // Missing or equal timestamps: do not send.
  if (validWebTime === validExpoTime) {
    return null;
  }

  if (validWebTime > validExpoTime) {
    return {
      type: "web",
      enabled: recipient.webPushEnabled === true,
    };
  }

  return {
    type: "expo",
    enabled: recipient.expoPushEnabled === true,
  };
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
  const baseUrl =
    process.env.NEXTAUTH_URL2?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://zeriy.vercel.app";

  try {
    const base = new URL(baseUrl);
    const destination = new URL(String(url || "/"), base);

    if (destination.origin !== base.origin) {
      return new URL("/", base).toString();
    }

    return destination.toString();
  } catch {
    return "https://zeriy.vercel.app/";
  }
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

// Send native Expo Push Notification.
async function sendExpoPushNotification({
  teamCollection,
  recipient,
  title,
  message,
  url,
  notificationId,
}) {
  const tokens = Array.isArray(recipient.expoPushTokens)
    ? recipient.expoPushTokens
        .map((item) =>
          typeof item === "string" ? item : item?.token
        )
        .filter(
          (token) =>
            typeof token === "string" &&
            /^(Expo(nent)?PushToken)\[[^\]]+\]$/.test(token)
        )
    : [];

  const uniqueTokens = [...new Set(tokens)];

  if (!uniqueTokens.length) {
    return {
      sent: false,
      count: 0,
      reason: "Doctor has no valid Expo push tokens",
    };
  }

  const messages = uniqueTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body: message,
    priority: "high",
    channelId: "default",
    data: {
      url,
      type: "emergency",
      notificationId: String(notificationId),
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Expo Push API error:", result);

      return {
        sent: false,
        count: 0,
        reason: "Expo Push API request failed",
      };
    }

    const tickets = Array.isArray(result.data)
      ? result.data
      : [];

    let successfulCount = 0;
    const expiredTokens = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        successfulCount++;
        return;
      }

      if (ticket.details?.error === "DeviceNotRegistered") {
        expiredTokens.push(uniqueTokens[index]);
      }

      console.error("Expo Push ticket error:", ticket);
    });

    // Remove expired Expo tokens without changing preference timestamps.
    if (expiredTokens.length) {
      await teamCollection.updateOne(
        { _id: recipient._id },
        {
          $pull: {
            expoPushTokens: {
              $in: expiredTokens,
            },
          },
        }
      );

      await teamCollection.updateOne(
        { _id: recipient._id },
        {
          $pull: {
            expoPushTokens: {
              token: { $in: expiredTokens },
            },
          },
        }
      );
    }

    return {
      sent: successfulCount > 0,
      count: successfulCount,
      reason:
        successfulCount > 0
          ? "Expo notification sent successfully"
          : "Expo notification could not be delivered",
    };
  } catch (error) {
    console.error("Expo Push delivery error:", error);

    return {
      sent: false,
      count: 0,
      reason: "Expo Push delivery failed",
    };
  }
}

// Send Web Push Notification.
async function sendWebPushNotification({
  teamCollection,
  recipient,
  title,
  message,
  url,
}) {
  if (recipient.webPushEnabled !== true) {
    return {
      sent: false,
      reason: "Web Push is disabled for this doctor",
    };
  }

  const subscription = recipient.webPushSubscription;

  if (!isValidSubscription(subscription)) {
    return {
      sent: false,
      reason: "Doctor has no valid Web Push subscription",
    };
  }

  if (!configureWebPush()) {
    return {
      sent: false,
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
      sent: true,
      reason: "Web Push notification sent successfully",
    };
  } catch (error) {
    console.error("Web Push delivery error:", error);

    // Remove expired Web Push subscriptions.
    // Do not modify webPushUpdatedAt here.
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
        sent: false,
        reason: "Web Push subscription expired and was disabled",
      };
    }

    return {
      sent: false,
      reason: "Web Push delivery failed",
    };
  }
}

// Save notification and send only the latest selected push channel.
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
        webPushSent: false,
        expoPushSent: false,
        skipped: true,
        selectedPushType: null,
        reason: "Duplicate notification",
      };
    }
  }

  // Save notification only once.
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

  let insertResult;

  try {
    insertResult = await notificationsCollection.insertOne(
      notificationDocument
    );
  } catch (error) {
    if (error.code === 11000) {
      return {
        doctorId,
        saved: false,
        pushSent: false,
        webPushSent: false,
        expoPushSent: false,
        skipped: true,
        selectedPushType: null,
        reason: "Duplicate notification",
      };
    }

    throw error;
  }

  // Find the latest device preference.
  const latestPreference =
    getLatestNotificationPreference(recipient);

  let expoResult = {
    sent: false,
    count: 0,
    reason: "Expo Push not selected",
  };

  let webResult = {
    sent: false,
    reason: "Web Push not selected",
  };

  if (!latestPreference) {
    expoResult.reason =
      "Notification timestamps are missing or equal";

    webResult.reason =
      "Notification timestamps are missing or equal";
  } else if (!latestPreference.enabled) {
    const reason =
      `Latest ${latestPreference.type} notification preference is disabled`;

    expoResult.reason = reason;
    webResult.reason = reason;
  } else if (latestPreference.type === "expo") {
    // Only Expo Push.
    expoResult = await sendExpoPushNotification({
      teamCollection,
      recipient,
      title,
      message,
      url,
      notificationId: insertResult.insertedId,
    });
  } else if (latestPreference.type === "web") {
    // Only Web Push.
    webResult = await sendWebPushNotification({
      teamCollection,
      recipient,
      title,
      message,
      url,
    });
  }

  const pushSent = expoResult.sent || webResult.sent;

  return {
    doctorId,
    saved: true,
    pushSent,
    webPushSent: webResult.sent,
    expoPushSent: expoResult.sent,
    expoPushCount: expoResult.count,
    selectedPushType: latestPreference?.type || null,
    skipped: !pushSent,
    reason: pushSent
      ? `Notification saved and ${latestPreference.type} push accepted`
      : "Notification saved, but the selected push channel did not send",
    delivery: {
      expo: expoResult.reason,
      web: webResult.reason,
    },
  };
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

    if (
      !doctorId ||
      (typeof doctorId !== "string" &&
        typeof doctorId !== "number")
    ) {
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

    // 4. Find doctor using doctorId.
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

    // 5. Save notification and send using latest preference.
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
      webPushSent: result.webPushSent ? 1 : 0,
      expoPushSent: result.expoPushSent ? 1 : 0,
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
