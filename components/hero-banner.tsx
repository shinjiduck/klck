// Khối mở đầu có nhận diện HueTrip (tím Huế + viền vàng + họa tiết sóng sông Hương).
// Dùng ở đầu các màn chính: khai sở thích, Khám phá, Lịch của tôi.

import { cn } from "cn";

export function HeroBanner({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.36_0.12_300)] to-[oklch(0.3_0.09_280)] px-5 pt-5 pb-6 text-primary-foreground shadow-lg shadow-primary/20",
        className,
      )}
    >
      {/* Sóng sông Hương */}
      <svg aria-hidden className="absolute inset-x-0 bottom-0 h-16 w-full text-white/10" preserveAspectRatio="none" viewBox="0 0 100 20">
        <path d="M0 10 Q 12.5 4 25 10 T 50 10 T 75 10 T 100 10 V20 H0Z" fill="currentColor" />
        <path d="M0 14 Q 12.5 9 25 14 T 50 14 T 75 14 T 100 14 V20 H0Z" fill="currentColor" />
      </svg>
      {/* Viền vàng hoàng cung */}
      <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-accent" />
      {eyebrow && <p className="relative text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">{eyebrow}</p>}
      <h1 className="relative mt-1 text-[28px] leading-tight font-semibold">{title}</h1>
      {children && <div className="relative mt-2 text-sm text-primary-foreground/85">{children}</div>}
    </header>
  );
}
