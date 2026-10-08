import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function GET(req) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");

    if (
      process.env.CRON_SECRET &&
      cronSecret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const now = new Date();

    const bookings = await db
      .collection("bookings")
      .find({
        status: {
          $in: ["confirmed", "waiting"],
        },
        peopleAhead: {
          $gt: 0,
        },
        expectedTurnAt: {
          $lte: now,
        },
      })
      .toArray();

    let notificationsSent = 0;

    for (const booking of bookings) {
      const lastNotification =
        booking.lastDelayNotificationAt
          ? new Date(booking.lastDelayNotificationAt)
          : null;

      const minutesSinceLastNotification =
        lastNotification
          ? Math.floor(
              (now.getTime() -
                lastNotification.getTime()) /
                (1000 * 60)
            )
          : Infinity;

      if (minutesSinceLastNotification < 15) {
        continue;
      }

      if (!booking.email) {
        continue;
      }

      const user = await db.collection("users").findOne({
        email: booking.email.toLowerCase(),
      });

      if (!user?.webPushSubscription) {
        continue;
      }

      const peopleAhead = Number(
        booking.peopleAhead
      );

      const notification = {
        title: "QueueEase",
        body: `Your turn is taking longer than expected. ${peopleAhead} ${
          peopleAhead === 1
            ? "person is"
            : "people are"
        } still ahead of you.`,
        url: "/my-bookings",
      };

      try {
        await webpush.sendNotification(
          user.webPushSubscription,
          JSON.stringify(notification)
        );

        await db.collection("bookings").updateOne(
          {
            _id: booking._id,
          },
          {
            $set: {
              lastDelayNotificationAt: now,
              updatedAt: now,
            },
          }
        );

        notificationsSent++;
      } catch (error) {
        console.error(
          "Delay notification error:",
          error
        );

        if (
          error.statusCode === 404 ||
          error.statusCode === 410
        ) {
          await db.collection("users").updateOne(
            {
              email: booking.email.toLowerCase(),
            },
            {
              $unset: {
                webPushSubscription: "",
              },
            }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: bookings.length,
      notificationsSent,
    });
  } catch (error) {
    console.error(
      "Queue checker error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Queue checker failed",
      },
      { status: 500 }
    );
  }
}