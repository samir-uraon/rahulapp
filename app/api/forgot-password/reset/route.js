
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
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
    const body = await request.json().catch(() => null);

    const identifier = String(body?.identifier || "").trim();
    const resetToken = String(body?.resetToken || "").trim();
    const newPassword = String(body?.newPassword || "");

    console.log(body);
    

    if (!identifier || !resetToken || !newPassword) {
      return NextResponse.json(
        {
          error:
            "Identifier, reset token, and new password are required.",
        },
        { status: 400 }
      );
    }

    // The verification route generates a 32-byte token
    // encoded as a 64-character hexadecimal string.
    if (!/^[a-f0-9]{64}$/i.test(resetToken)) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired password reset session. Please start again.",
        },
        { status: 400 }
      );
    }

    if (
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      return NextResponse.json(
        {
          error:
            "Password must be 8–128 characters and include at least one letter and one number.",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const users = db.collection("users");
    const tokens = db.collection("passwordResetOTPs");

    // Only verified accounts can reset their passwords.
    const user = await users.findOne({
      ...userQuery(identifier),
      isVerified: true,
    });

    console.log(user);
    

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid or expired password reset session.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const resetTokenHash = hash(resetToken);
 
    const resetRecord = await tokens.findOneAndDelete({
      userId: user._id,
      verified: true,
      resetTokenHash,
      resetExpiresAt: { $gt: now },
    });

    console.log(resetRecord);
    

    if (!resetRecord) {
      return NextResponse.json(
        {
          error:
            "Your password reset session is invalid or expired. Please start again.",
        },
        { status: 400 }
      );
    }

    // Never store the plaintext password.
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updateResult = await users.updateOne(
      {
        _id: user._id,
        isVerified: true,
      },
      {
        $set: {
          password: passwordHash,
          passwordUpdatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount !== 1) {
      console.error(
        "Password reset user update failed:",
        user._id.toString()
      );

      return NextResponse.json(
        {
          error:
            "Unable to update your password. Please start the reset process again.",
        },
        { status: 500 }
      );
    }

    // Invalidate any other reset sessions for this user.
    await tokens.deleteMany({ userId: user._id });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return NextResponse.json(
      {
        error: "Unable to reset password right now. Please try again later.",
      },
      { status: 500 }
    );
  }
}
