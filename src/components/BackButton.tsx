import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Takes the user back to the previous screen without leaving the site. */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    router.navigate({ to: "/" });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={goBack}
      aria-label="Go back to the previous page"
      className={className}
    >
      <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back
    </Button>
  );
}
