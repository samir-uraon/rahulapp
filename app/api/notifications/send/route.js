import { NextResponse } from "next/server";
import webpush from "web-push";
import clientPromise from "@/lib/mongodb";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      email,
      title,
      message,
      url = "/my-bookings",
    } = body;

    if (!email || !title || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "email, title and message are required",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const user = await db.collection("users").findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 }
      );
    }

    const subscription = user.webPushSubscription;

    if (!subscription) {
      return NextResponse.json({
        success: false,
        message: "User has no web push subscription",
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
    });

    try {
      await webpush.sendNotification(
        subscription,
        payload
      );
    } catch (error) {
      console.error("Web push error:", error);

      if (
        error.statusCode === 404 ||
        error.statusCode === 410
      ) {
        await db.collection("users").updateOne(
          {
            email: email.toLowerCase(),
          },
          {
            $unset: {
              webPushSubscription: "",
            },
          }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Notification sent",
    });
  } catch (error) {
    console.error("Notification send error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send notification",
      },
      { status: 500 }
    );
  }
}