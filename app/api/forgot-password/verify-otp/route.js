
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import crypto from "crypto";

export const runtime = "nodejs";

const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

function safeEqual(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  return (
    left.length === right.length &&
    left.length > 0 &&
    crypto.timingSafeEqual(left, right)
  );
}

function userQuery(identifier) {
  const value = String(identifier || "").trim();

  if (value.includes("@")) {
    return { email: value.toLowerCase() };
  }

  return {
    $or: [{ phone: value }, { mobile: value }],
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const identifier = String(body?.identifier || "").trim();
    const otp = String(body?.otp || "").trim();

    if (!identifier || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter your email/mobile number and the 6-digit OTP." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const user = await db.collection("users").findOne({
      ...userQuery(identifier),
      isVerified: true,
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired OTP. Request a new OTP." },
        { status: 400 }
      );
    }

    const tokens = db.collection("passwordResetOTPs");
    const record = await tokens.findOne({ userId: user._id });

    if (
      !record ||
      !record.otpHash ||
      record.verified === true ||
      !record.expiresAt ||
      new Date(record.expiresAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "OTP has expired or is invalid. Request a new OTP." },
        { status: 400 }
      );
    }

    if ((record.attempts || 0) >= 5) {
      await tokens.deleteOne({ _id: record._id });

      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    // Increment attempts before comparing, so incorrect submissions count.
    const attemptUpdate = await tokens.updateOne(
      {
        _id: record._id,
        verified: { $ne: true },
        attempts: record.attempts || 0,
        expiresAt: { $gt: new Date() },
      },
      { $inc: { attempts: 1 } }
    );

    if (attemptUpdate.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "OTP request changed. Please request a new OTP." },
        { status: 409 }
      );
    }

    if (!safeEqual(record.otpHash, hash(otp))) {
      const attemptsLeft = Math.max(
        0,
        5 - ((record.attempts || 0) + 1)
      );

      if (attemptsLeft === 0) {
        await tokens.deleteOne({ _id: record._id });
      }

      return NextResponse.json(
        {
          error:
            attemptsLeft > 0
              ? `Incorrect OTP. ${attemptsLeft} attempt(s) remaining.`
              : "Too many incorrect attempts. Request a new OTP.",
          attemptsLeft,
        },
        { status: attemptsLeft > 0 ? 400 : 429 }
      );
    }

    // The OTP is consumed; a separate short-lived token authorizes reset.
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const update = await tokens.updateOne(
      {
        _id: record._id,
        verified: { $ne: true },
        otpHash: record.otpHash,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          verified: true,
          resetTokenHash: hash(resetToken),
          resetExpiresAt,
          verifiedAt: new Date(),
        },
        $unset: { otpHash: "" },
      }
    );

    if (update.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "OTP could not be verified. Please try again." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully.",
      resetToken,
      expiresInSeconds: 600,
    });
  } catch (error) {
    console.error("Verify password reset OTP error:", error);

    return NextResponse.json(
      { error: "Unable to verify OTP right now." },
      { status: 500 }
    );
  }
}
