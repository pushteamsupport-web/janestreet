import { cn } from "@/lib/utils";
import logoAsset from "@/assets/jane-street-header-logo.jpeg.asset.json";

/**
 * Jane Street brand lockup: the circular mark and wordmark from the supplied logo.
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
      src={`https://id-preview--048e1462-6b93-4c66-9fd9-0f66db5dba9d.lovable.app${logoAsset.url}`}
      alt="Jane Street"
      width={600}
      height={175}
      className={cn(height, "w-auto max-w-full shrink-0 object-contain", className)}
    />
  );
}
