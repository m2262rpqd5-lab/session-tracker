"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, Users, CalendarCheck, Package } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/calendar", label: "Calendar Sync", icon: CalendarCheck },
  { href: "/packages", label: "Packages", icon: Package },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-semibold text-gray-900 mr-6 text-sm tracking-tight">
          Session Tracker
        </span>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              path === href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
