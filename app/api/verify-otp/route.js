import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

export async function POST(request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        {
          message: "Email and OTP are required",
        },
        {
          status: 400,
        }
      );
    }

    const client = await clientPromise;
    const db = client.db("rahul");
    const users = db.collection("users");

    const normalizedEmail = email.toLowerCase().trim();

    const user = await users.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return NextResponse.json(
        {
          message: "User not found or account has expired",
        },
        {
          status: 404,
        }
      );
    }

    if (user.emailVerified === true) {
      return NextResponse.json(
        {
          message: "Email is already verified",
        },
        {
          status: 400,
        }
      );
    }

    if (!user.otp || !user.otpExpiresAt) {
      return NextResponse.json(
        {
          message: "OTP not found. Please request a new OTP.",
        },
        {
          status: 400,
        }
      );
    }

    if (new Date() > new Date(user.otpExpiresAt)) {
      return NextResponse.json(
        {
          message: "OTP has expired. Please request a new OTP.",
        },
        {
          status: 400,
        }
      );
    }

    const isValidOTP = await bcrypt.compare(
      otp.toString(),
      user.otp
    );

    if (!isValidOTP) {
      return NextResponse.json(
        {
          message: "Invalid OTP",
        },
        {
          status: 400,
        }
      );
    }

    const updateResult = await users.updateOne(
      {
        _id: user._id,
        emailVerified: false,
      },
      {
        $set: {
          emailVerified: true,
          verifiedAt: new Date(),
        },
        $unset: {
          otp: "",
          otpExpiresAt: "",
          deleteAt: "",
        },
      }
    );

    if (updateResult.modifiedCount !== 1) {
      return NextResponse.json(
        {
          message: "Failed to verify email",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        message: "Email verified successfully",
        email: normalizedEmail,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("OTP verification error:", error);

    return NextResponse.json(
      {
        message: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}