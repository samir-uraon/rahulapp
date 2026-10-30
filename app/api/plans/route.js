
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Everything you need to get started.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Browse nearby clinics",
      "View doctors and services",
      "Book appointments",
      "Track booking status",
      "Basic booking history",
    ],
    active: true,
  },
  {
    id: "premium",
    name: "Premium",
    description: "More convenience for your healthcare journey.",
    monthlyPrice: 99,
    yearlyPrice: 999,
    features: [
      "Everything in Free",
      "Priority customer support",
      "Exclusive premium benefits",
      "Advanced booking experience",
      "Faster customer assistance",
      "Premium account badge",
    ],
    active: true,
  },
];

// GET: Fetch plans and user's current subscription
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Please login first." },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const plansCollection = db.collection("subscriptionPlans");
    const subscriptionsCollection = db.collection("subscriptions");

    // Fetch active plans
    let plans = await plansCollection
      .find({ active: true })
      .project({ _id: 0 })
      .toArray();

    // Insert default plans if collection is empty
    if (plans.length === 0) {
      await plansCollection.insertMany(
        DEFAULT_PLANS.map((plan) => ({
          ...plan,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      plans = DEFAULT_PLANS;
    }

    // Fetch current user's subscription
    const subscription = await subscriptionsCollection.findOne(
      {
        userId: String(session.user.id),
        status: "active",
        expiresAt: { $gt: new Date() },
      },
      {
        projection: {
          _id: 0,
          userId: 0,
        },
        sort: { createdAt: -1 },
      }
    );

    return NextResponse.json({
      success: true,
      plans,
      currentPlan: subscription?.planId || "free",
      subscription: subscription || null,
    });
  } catch (error) {
    console.error("Plans GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to fetch subscription plans.",
      },
      { status: 500 }
    );
  }
}

