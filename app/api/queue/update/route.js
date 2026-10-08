import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import webpush from "web-push";
import { ObjectId } from "mongodb";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      bookingId,
      peopleAhead,
      expectedTurnAt,
    } = body;

    if (!bookingId || peopleAhead === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "bookingId and peopleAhead are required",
        },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(bookingId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid booking ID",
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const bookings = db.collection("bookings");
    const users = db.collection("users");

    const booking = await bookings.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking not found",
        },
        { status: 404 }
      );
    }

    const currentPeopleAhead = Number(peopleAhead);

    const updateData = {
      peopleAhead: currentPeopleAhead,
      updatedAt: new Date(),
    };

    if (expectedTurnAt) {
      updateData.expectedTurnAt = new Date(expectedTurnAt);
    }

    let notification = null;
    let notificationType = null;

    /*
      1 PERSON AHEAD
    */

    if (
      currentPeopleAhead === 1 &&
      !booking.notificationOneSent
    ) {
      notification = {
        title: "QueueEase",
        body: "Your turn is coming up! Only 1 person is ahead of you.",
        url: "/my-bookings",
      };

      notificationType = "coming_soon";

      updateData.notificationOneSent = true;
    }

    /*
      YOUR TURN
    */

    if (
      currentPeopleAhead === 0 &&
      !booking.turnNotificationSent
    ) {
      notification = {
        title: "QueueEase",
        body: "It's your turn! Please proceed now.",
        url: "/my-bookings",
      };

      notificationType = "your_turn";

      updateData.turnNotificationSent = true;
    }

    /*
      DELAY CHECK
    */

    if (
      currentPeopleAhead > 0 &&
      booking.expectedTurnAt
    ) {
      const expectedTime = new Date(
        booking.expectedTurnAt
      );

      const now = new Date();

      const delayMinutes =
        Math.floor(
          (now.getTime() - expectedTime.getTime()) /
            (1000 * 60)
        );

      /*
        Send delay notification after
        expected time has passed by 10 minutes.
      */

      if (delayMinutes >= 10) {
        const lastDelayNotification =
          booking.lastDelayNotificationAt
            ? new Date(
                booking.lastDelayNotificationAt
              )
            : null;

        const minutesSinceLastNotification =
          lastDelayNotification
            ? Math.floor(
                (now.getTime() -
                  lastDelayNotification.getTime()) /
                  (1000 * 60)
              )
            : Infinity;

        /*
          Don't send delay notifications
          more often than every 15 minutes.
        */

        if (minutesSinceLastNotification >= 15) {
          notification = {
            title: "QueueEase",
            body: `Your turn is taking longer than expected. ${currentPeopleAhead} ${
              currentPeopleAhead === 1
                ? "person is"
                : "people are"
            } still ahead of you.`,
            url: "/my-bookings",
          };

          notificationType = "delayed";

          updateData.lastDelayNotificationAt = now;
        }
      }
    }

    /*
      UPDATE BOOKING
    */

    await bookings.updateOne(
      {
        _id: booking._id,
      },
      {
        $set: updateData,
      }
    );

    /*
      SEND NOTIFICATION
    */

    if (notification && booking.email) {
      const user = await users.findOne({
        email: booking.email.toLowerCase(),
      });

      if (user?.webPushSubscription) {
        try {
          await webpush.sendNotification(
            user.webPushSubscription,
            JSON.stringify(notification)
          );
        } catch (error) {
          console.error(
            "Web push notification error:",
            error
          );

          if (
            error.statusCode === 404 ||
            error.statusCode === 410
          ) {
            await users.updateOne(
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
    }

    return NextResponse.json({
      success: true,
      peopleAhead: currentPeopleAhead,
      notificationSent: Boolean(notification),
      notificationType,
    });
  } catch (error) {
    console.error(
      "Queue update error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update queue",
      },
      { status: 500 }
    );
  }
}