import { cn } from "cn";

/** Chip bật/tắt dùng cho lớp bản đồ và bộ lọc. */
export function Chip({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap shadow-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-primary/20"
          : "border-border bg-background/95 text-foreground hover:bg-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
