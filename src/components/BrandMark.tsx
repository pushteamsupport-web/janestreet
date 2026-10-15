import { cn } from "@/lib/utils";

/**
 * Jane Street brand lockup: the circular mark and wordmark from the supplied logo.
 * Served from /public so the logo works on any host (Vercel included).
 */
export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const height = size === "lg" ? "h-12" : size === "sm" ? "h-7" : "h-9";
  return (
    <img
      src="/jane-street-logo.jpeg"
      alt="Jane Street"
      width={600}
      height={175}
      className={cn(height, "w-auto max-w-full shrink-0 object-contain", className)}
    />
  );
}
