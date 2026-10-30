
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";
import crypto from "crypto";

export const runtime = "nodejs";

const OTP_EXPIRY_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

function normalizeIdentifier(value) {
  const identifier = String(value || "").trim();

  if (identifier.includes("@")) {
    return { email: identifier.toLowerCase() };
  }

  return { phone: identifier };
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const identifier = String(body?.identifier || "").trim();

    if (!identifier) {
      return NextResponse.json(
        { error: "Email or mobile number is required." },
        { status: 400 }
      );
    }

    const normalized = normalizeIdentifier(identifier);
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    // Use the same collection as verify-otp and reset.
    const users = db.collection("users");

    const user = await users.findOne({
      ...(normalized.email
        ? { email: normalized.email }
        : {
            $or: [
              { phone: normalized.phone },
              { mobile: normalized.phone },
            ],
          }),
      isVerified: true,
    });

    // Avoid revealing whether an account exists.
    const genericResponse = {
      success: true,
      message:
        "If a verified account matches those details and has an email address, an OTP will be sent.",
    };

    if (!user || !user.email) {
      return NextResponse.json(genericResponse);
    }

    const now = new Date();
    const resetTokens = db.collection("passwordResetOTPs");

    // Enforce a resend cooldown.
    const existing = await resetTokens.findOne({
      userId: user._id,
      createdAt: {
        $gt: new Date(
          now.getTime() - RESEND_COOLDOWN_SECONDS * 1000
        ),
      },
    });

    if (existing) {
      const createdAt = new Date(existing.createdAt).getTime();
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (createdAt +
            RESEND_COOLDOWN_SECONDS * 1000 -
            now.getTime()) /
            1000
        )
      );

      return NextResponse.json({
        success: true,
        message: "Please wait before requesting another OTP.",
        retryAfterSeconds,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(
      now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    // Replace the previous OTP request for this user.
    await resetTokens.deleteMany({ userId: user._id });

    const inserted = await resetTokens.insertOne({
      userId: user._id,
      otpHash,
      expiresAt,
      createdAt: now,
      attempts: 0,
      verified: false,
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER
          ? `Zeric <${process.env.EMAIL_USER}>`
          : undefined,
        to: user.email,
        subject: "Your Zeric Password Reset OTP",
        text: `Your Zeric password reset OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#334155">
            <h2 style="color:#312e81">Reset your Zeric password</h2>
            <p>Hello ${escapeHtml(user.name || "there")},</p>
            <p>Use this one-time password to reset your password:</p>
            <div style="margin:24px 0;padding:18px;background:#eef2ff;border-radius:12px;text-align:center">
              <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4338ca">${otp}</span>
            </div>
            <p>This OTP expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
            <p style="font-size:12px;color:#64748b">Zeric — Made Simpler &amp; Much Faster</p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("Password reset email delivery failed:", mailError);

      await resetTokens.deleteOne({ _id: inserted.insertedId });

      return NextResponse.json(
        { error: "Unable to send the OTP email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { error: "Failed to process the password reset request." },
      { status: 500 }
    );
  }
}
