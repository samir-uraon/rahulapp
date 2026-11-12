
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Zeriy",
      body: event.data.text(),
    };
  }

  const title = data.title || "Zeriy Notification";

  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    data: {
      url: data.url || "/my-bookings",
      notificationId: data.notificationId,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/my-bookings",
    self.location.origin
  );

  if (targetUrl.origin !== self.location.origin) return;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          return client.navigate(targetUrl.href);
        }
      }

      return clients.openWindow(targetUrl.href);
    })
  );
});
