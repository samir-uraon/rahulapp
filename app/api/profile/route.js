 
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// =====================================================
// GET PROFILE
// =====================================================

export async function GET() {
  try {
    // Check if user is logged in
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    // Find logged-in user
    const user = await db.collection("users").findOne(
      {
        email: session.user.email,
      },
      {
        projection: {
          password: 0,
        },
      }
    );

    // User not found
    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Return profile
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("PROFILE_GET_ERROR:", error);

    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// =====================================================
// UPDATE PROFILE
// =====================================================

export async function PUT(request) {
  try {
    // Check if user is logged in
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get data from frontend
    const body = await request.json();

    const name = body.name?.trim();
    const phone = body.phone?.trim() || "";

    // Validate name
    if (!name) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    // Validate phone
    if (phone && !/^[0-9]{10}$/.test(phone)) {
      return NextResponse.json(
        { message: "Phone number must be 10 digits" },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    // Update user
    const result = await db.collection("users").updateOne(
      {
        email: session.user.email,
      },
      {
        $set: {
          name: name,
          phone: phone,
          updatedAt: new Date(),
        },
      }
    );

    // User not found
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Return updated user
    return NextResponse.json({
      message: "Profile updated successfully",

      user: {
        name: name,
        email: session.user.email,
        phone: phone,
      },
    });
  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500 }
    );
  }
}

