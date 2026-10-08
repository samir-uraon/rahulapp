import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const { type, token, subscription } = body;

    if (!type || !["web", "fcm"].includes(type)) {
      return NextResponse.json(
        { message: "Invalid notification type" },
        { status: 400 }
      );
    }

    if (type === "web" && !subscription) {
      return NextResponse.json(
        { message: "Web push subscription is required" },
        { status: 400 }
      );
    }

    if (type === "fcm" && !token) {
      return NextResponse.json(
        { message: "FCM token is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const users = db.collection("users");

    const email = session.user.email.toLowerCase();

    const update = {
      $set: {
        notificationUpdatedAt: new Date(),
      },
    };

    if (type === "web") {
      update.$set.webPushSubscription = subscription;
    }

    if (type === "fcm") {
      update.$addToSet = {
        fcmTokens: token,
      };
    }

    await users.updateOne(
      { email },
      update
    );

    return NextResponse.json({
      success: true,
      message: `${type.toUpperCase()} notification registered`,
    });
  } catch (error) {
    console.error("Notification registration error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to register notification",
      },
      { status: 500 }
    );
  }
}