"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LayoutDashboard, Users, CalendarCheck, Package } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarCheck },
  { href: "/packages", label: "Packages", icon: Package },
];

export default function Nav() {
  const path = usePathname();

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-10">
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

      {/* Mobile top bar */}
      <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-10 h-12 flex items-center px-4">
        <span className="font-semibold text-gray-900 text-sm tracking-tight">Session Tracker</span>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 flex pt-2 safe-bottom">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                // min-h-16 = 64px tap target, well clear of the 44px minimum
                "flex-1 flex flex-col items-center justify-center gap-1.5 min-h-16 px-2 rounded-xl",
                "text-xs font-medium leading-none select-none touch-manipulation",
                "transition-colors active:bg-gray-100",
                active ? "text-gray-900" : "text-gray-400"
              )}
            >
              <Icon size={23} strokeWidth={active ? 2.2 : 1.7} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
