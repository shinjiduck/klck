"use client";

// Thanh điều hướng dưới cho điện thoại (Bố cục Hue Map: "Tab Lịch ở thanh điều hướng dưới").

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, Map } from "lucide-react";
import { cn } from "cn";

// `match`: các đường dẫn làm tab đó sáng lên (luồng tạo lịch thuộc tab "Lịch của tôi").
const ITEMS = [
  { href: "/map", label: "Bản đồ", icon: Map, match: ["/map"] },
  { href: "/trip", label: "Lịch của tôi", icon: CalendarDays, match: ["/trip", "/onboarding", "/plans"] },
  { href: "/explore", label: "Khám phá", icon: Compass, match: ["/explore"] },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="h-14 shrink-0 border-t bg-background">
      <ul className="grid h-full grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
