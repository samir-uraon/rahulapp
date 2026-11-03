
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import clientPromise from "@/lib/mongodb";
import  transporter from "@/lib/mailer";

const OTP_EXPIRY_MINUTES = 15;

function escapeHtml(value = "") {
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

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendOTPEmail({ email, name, otp }) {
  const safeName = escapeHtml(name);
  const safeOTP = escapeHtml(otp);

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify your ZERIY account",
    text: `Hello ${name}, your ZERIY verification OTP is ${otp}. It expires in 15 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#4f46e5;">Welcome to ZERIY!</h2>

        <p>Hello ${safeName},</p>

        <p>
          Use the following OTP to verify your ZERIY account.
        </p>

        <div style="background:#eef2ff;padding:20px;text-align:center;border-radius:10px;margin:25px 0;">
          <h1 style="letter-spacing:8px;color:#4338ca;margin:0;">
            ${safeOTP}
          </h1>
        </div>

        <p>This OTP expires in <strong>15 minutes</strong>.</p>

        <p style="color:#64748b;font-size:13px;">
          If you did not request this verification, you can ignore this email.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;" />

        <p style="color:#64748b;font-size:12px;">
          ZERIY – Made Simpler & Much Faster
        </p>
      </div>
    `,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    let { name, email, phone, password } = body;

    // Normalize inputs
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    phone = String(phone || "").trim();
    password = String(password || "");

    // -----------------------------
    // VALIDATION
    // -----------------------------

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required.",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid Indian mobile number.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    // -----------------------------
    // DATABASE CONNECTION
    // -----------------------------

    const client = await clientPromise;
    const db = client.db("rahul");
    const users = db.collection("users");

    // -----------------------------
    // INDEXES
    // -----------------------------

    await users.createIndex(
      { email: 1 },
      { unique: true }
    );

    await users.createIndex(
      { phone: 1 },
      { unique: true }
    );

    // Automatically delete expired unverified accounts.
   await users.createIndex(
  { deleteAt: 1 },
  {
    name: "deleteAt_1",
    expireAfterSeconds: 0,
  }
);

    // -----------------------------
    // CHECK EXISTING ACCOUNT
    // -----------------------------

    const existingUser = await users.findOne({
      $or: [
        { email },
        { phone },
      ],
    });

    if (existingUser) {
      // Already verified account
      if (existingUser.isVerified === true) {
        return NextResponse.json(
          {
            success: false,
            message:
              "An account with this email or mobile number already exists. Please login.",
          },
          { status: 409 }
        );
      }

      const now = new Date();

      // Check whether the existing OTP is still valid.
      const otpStillValid =
        existingUser.otpExpiresAt &&
        new Date(existingUser.otpExpiresAt) > now;

      if (otpStillValid) {
        // -----------------------------
        // RESEND OTP FOR EXISTING USER
        // -----------------------------

        const otp = generateOTP();
        const hashedOTP = await bcrypt.hash(otp, 10);

        const otpExpiresAt = new Date(
          Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        );

        const deleteAt = otpExpiresAt;

        const oldOTP = existingUser.otp;
        const oldOTPExpiresAt = existingUser.otpExpiresAt;
        const oldDeleteAt = existingUser.deleteAt;

        await users.updateOne(
          { _id: existingUser._id },
          {
            $set: {
              otp: hashedOTP,
              otpExpiresAt,
              deleteAt,
            },
          }
        );

        try {
          // Send to the email already stored in the account.
          await sendOTPEmail({
            email: existingUser.email,
            name: existingUser.name,
            otp,
          });
        } catch (emailError) {
          // Restore the previous OTP if email sending fails.
          await users.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                otp: oldOTP,
                otpExpiresAt: oldOTPExpiresAt,
                deleteAt: oldDeleteAt,
              },
            }
          );

          throw emailError;
        }

        return NextResponse.json(
          {
            success: true,
            requiresVerification: true,
            userId: existingUser._id.toString(),
            message:
              "Your account is awaiting verification. A new OTP has been sent to your registered email.",
          },
          { status: 200 }
        );
      }

      // -----------------------------
      // OTP EXPIRED
      // DELETE OLD UNVERIFIED ACCOUNT
      // -----------------------------

      await users.deleteOne({
        _id: existingUser._id,
        isVerified: false,
      });
    }

    // -----------------------------
    // CREATE NEW ACCOUNT
    // -----------------------------

    const hashedPassword = await bcrypt.hash(password, 12);

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Both expire after exactly 15 minutes.
    const otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    const deleteAt = otpExpiresAt;

    const newUser = {
      name,
      email,
      phone,
      password: hashedPassword,

      isVerified: false,

      otp: hashedOTP,
      otpExpiresAt,
      deleteAt,

      createdAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    // -----------------------------
    // SEND OTP EMAIL
    // -----------------------------

    try {
      await sendOTPEmail({
        email,
        name,
        otp,
      });
    } catch (emailError) {
      // Remove account if the initial OTP email fails.
      await users.deleteOne({
        _id: result.insertedId,
        isVerified: false,
      });

      throw emailError;
    }

    return NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        userId: result.insertedId.toString(),
        message:
          "Registration successful. Please verify your email using the OTP sent to you.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup API error:", error);

    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This email or mobile number is already registered.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong. Please try again later.",
      },
      { status: 500 }
    );
  }
}
