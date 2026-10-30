import ServiceCard from "./ServiceCard";

export default function Services() {
  const services = [
    {
      href: "/services/saloons",
      icon: "✂️",
      title: "Saloon",
      badge: "COMING SOON",
      description: "Haircuts, beard grooming, head massage & men styling",
      actionText: "Coming Soon",
      iconBg: "bg-amber-50",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-500 border-slate-200",
      disabled: true,
    },
    {
      href: "/services/parlours",
      icon: "💄",
      title: "Parlour",
      badge: "COMING SOON",
      description: "Facial, threading, waxing, hair spa & bridal care",
      actionText: "Coming Soon",
      iconBg: "bg-pink-50",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-500 border-slate-200",
      disabled: true,
    },
    {
      href: "/services/clinics",
      icon: "🩺",
      title: "Clinic",
      badge: "AVAILABLE",
      description:
        "Dental, Pediatric (Child), General OPD & Skin specialists",
      actionText: "View Doctors",
      iconBg: "bg-blue-50",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-600 border-emerald-200",
      disabled: false,
    },
    {
      href: "/services/diagnostic-centre",
      icon: "🧪",
      title: "Diagnostic Centre",
      badge: "COMING SOON",
      description:
        "Blood tests, Thyroid, Full Body checkups & Lab Doctors",
      actionText: "Coming Soon",
      iconBg: "bg-emerald-50",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-500 border-slate-200",
      disabled: true,
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-5 pb-10">
      <div className="flex flex-col gap-4">
        {services.map((service) => (
          <ServiceCard
            key={service.href}
            href={service.href}
            icon={service.icon}
            title={service.title}
            badge={service.badge}
            description={service.description}
            actionText={service.actionText}
            iconBg={service.iconBg}
            badgeBg={service.badgeBg}
            badgeText={service.badgeText}
            disabled={service.disabled}
          />
        ))}
      </div>
    </section>
  );
}