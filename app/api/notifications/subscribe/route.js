
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Please login first" },
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user._id;

    if (!userId || !ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 }
      );
    }

    const subscription = await request.json();

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid push subscription" },
        { status: 400 }
      );
    }

    if (
      typeof subscription.endpoint !== "string" ||
      typeof subscription.keys.p256dh !== "string" ||
      typeof subscription.keys.auth !== "string" ||
      subscription.endpoint.length > 4096
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid subscription format" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(String(userId)) },
      {
        $set: {
          webPushSubscription: {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime ?? null,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          webPushSubscriptionUpdatedAt: new Date(),
          webPushEnabled: true,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "User account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription saved successfully",
    });

  } catch (error) {
    console.error("Push subscription error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save push subscription",
      },
      { status: 500 }
    );
  }
}


export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Please login first" },
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user._id;

    if (!userId || !ObjectId.isValid(String(userId))) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(String(userId)) },
      {
        $unset: {
          webPushSubscription: "",
        },
        $set: {
          webPushEnabled: false,
          webPushSubscriptionUpdatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "User account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push notifications disabled successfully",
    });

  } catch (error) {
    console.error("Push unsubscribe error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to disable notifications",
      },
      { status: 500 }
    );
  }
}