import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import transporter from "@/lib/mailer";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json(
        { error: "Email or mobile number is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const user = await db.collection("users").findOne({
      $or: [
        { email: identifier.toLowerCase().trim() },
        { phone: identifier.trim() },
        { mobile: identifier.trim() },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email or mobile number" },
        { status: 404 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "No email address is associated with this account" },
        { status: 400 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.collection("passwordResetTokens").deleteMany({
      userId: user._id,
    });

    await db.collection("passwordResetTokens").insertOne({
      userId: user._id,
      token,
      expiresAt,
      createdAt: new Date(),
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Reset Your QueueEase Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; color: #334155;">
          <h2 style="color: #0f172a;">
            Hello ${user.name || "User"} 👋
          </h2>

          <p>
            We received a request to reset your QueueEase password.
          </p>

          <p>
            Click the button below to create a new password:
          </p>

          <div style="margin: 30px 0;">
            <a
              href="${resetUrl}"
              style="
                display: inline-block;
                background: #4f46e5;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
              "
            >
              Reset Password
            </a>
          </div>

          <p>
            This link will expire in <strong>15 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

          <p style="font-size: 12px; color: #94a3b8;">
            QueueEase - Book tokens and manage your appointments.
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset instructions sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { error: "Failed to send password reset email" },
      { status: 500 }
    );
  }
}