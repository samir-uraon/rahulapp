
import Link from "next/link";

export default function ServiceCard({
  href,
  icon,
  title,
  badge,
  description,
  actionText,
  iconBg,
  badgeBg,
  badgeText,
}) {
  return (
    <Link
      href={href}
      className="group block bg-white border-2 border-gray-200 rounded-3xl px-5 py-5 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start gap-4">

        {/* Icon */}
        <div
          className={`w-12 h-12 shrink-0 rounded-2xl ${iconBg} flex items-center justify-center`}
        >
          <span className="text-2xl">
            {icon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Title + Badge */}
          <div className="flex flex-wrap items-center gap-2">

            <h3 className="text-base md:text-lg font-bold text-gray-900">
              {title}
            </h3>

           {badge? 
           <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeBg} ${badgeText}`}
            >
              {badge}
            </span>:""}

          </div>

          {/* Description */}
          <p className="mt-1 text-sm text-gray-500 leading-relaxed">
            {description}
          </p>

          {/* Action */}
          <div className="mt-3">
            <span className="text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
              {actionText} →
            </span>
          </div>

        </div>

      </div>
    </Link>
  );
}