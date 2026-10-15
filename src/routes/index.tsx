import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jane Street | Pursue Recovery of What Fraud Took" },
      {
        name: "description",
        content:
          "Jane Street helps you recover money lost to fraud. No upfront fee, your satisfaction is our priority.",
      },
      { property: "og:title", content: "Jane Street — Fraud Recovery Support" },
      {
        property: "og:description",
        content: "No upfront fee, your satisfaction is our priority.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7.6 21.3H4.4c-.4 0-.7-.4-.6-.8L6.4 3.4c.1-.4.4-.6.8-.6h6.1c3.4 0 5.6 1.7 5.1 5.2-.5 3.6-3.1 5.4-6.6 5.4h-2c-.4 0-.7.3-.8.6l-.7 6.7c-.1.4-.4.6-.7.6Zm3.1-11.1h1.2c1.5 0 2.7-.6 2.9-2.2.2-1.4-.7-1.9-2.1-1.9h-1.2c-.2 0-.4.1-.4.4l-.5 3.4c0 .2.1.3.1.3Z" />
    </svg>
  );
}

const BADGES = [
  { icon: Lock, label: "SSL Encrypted", tone: "text-emerald-500" },
  { icon: PayPalIcon, label: "PayPal Protected", tone: "text-primary" },
  { icon: Headset, label: "24/7 Support", tone: "text-foreground" },
];

const STEPS = [
  "You upload your case — free",
  "We work on recovery — free",
  "Recovery completes — notified",
];

function Index() {
  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 lg:h-18">
          <BrandMark />
          <nav aria-label="Account" className="flex shrink-0 items-center gap-1 text-header-auth">
            <Button asChild variant="link" className="px-1 text-sm font-semibold text-header-auth sm:px-2 sm:text-base">
              <Link to="/auth" search={{ mode: "login" }}>Sign in</Link>
            </Button>
            <span aria-hidden="true">/</span>
            <Button asChild variant="link" className="px-1 text-sm font-semibold text-header-auth sm:px-2 sm:text-base">
              <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden px-5 py-2 lg:grid-cols-2 lg:grid-rows-1 lg:items-start lg:gap-10">
        {/* Hero */}
        <section>
          <h1 className="text-2xl font-extrabold leading-[1.12] tracking-tight min-[430px]:text-3xl lg:text-4xl">
            We help you pursue recovery
            <br />
            of what fraud took from you
          </h1>
          <p className="mt-2 text-xs leading-snug text-muted-foreground min-[430px]:text-sm lg:mt-3 lg:text-base">
            Start your case in minutes. It's free — you only pay 15% government tax after a completed recovery.
          </p>

          <ul className="mt-3 flex flex-col items-start gap-1.5 lg:mt-4 lg:gap-2">
            {BADGES.map(({ icon: Icon, label, tone }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium min-[430px]:px-4 min-[430px]:py-1.5 min-[430px]:text-base lg:text-sm"
              >
                <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works + testimonials */}
        <section className="min-h-0 lg:mt-0">
          <h2 className="text-xl font-extrabold tracking-tight min-[430px]:text-2xl lg:text-xl">
            How it works &nbsp;3 simple steps
          </h2>

          <ol className="mt-2 space-y-1.5 min-[430px]:space-y-2 lg:mt-3">
            {STEPS.map((body, index) => (
              <li
                key={body}
                className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-accent px-3 py-1.5 min-[430px]:gap-3 min-[430px]:py-2 lg:py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground min-[430px]:h-8 min-[430px]:w-8">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-primary">Step {index + 1}</p>
                  <p className="text-sm leading-tight text-foreground/80">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="mt-2 text-xl font-extrabold tracking-tight min-[430px]:mt-3 min-[430px]:text-2xl lg:mt-4 lg:text-xl">
            Testimonials
          </h2>
          <figure className="mt-1.5 rounded-xl bg-secondary p-2.5 min-[430px]:mt-2 min-[430px]:p-3 lg:mt-2">
            <blockquote className="text-xs leading-snug text-foreground/80 min-[430px]:text-sm">
              <span className="mr-1 font-bold text-muted-foreground">&#8221;</span>
              “They recovered $8,200 I thought was gone. Transparent and easy.”
            </blockquote>
            <figcaption className="mt-1 text-xs text-foreground/80 min-[430px]:text-sm">
              — Sarah M., Verified client
            </figcaption>
            <div className="text-sm text-amber-400 min-[430px]:mt-1 min-[430px]:text-base" aria-label="Five star rating">
              ★★★★★
            </div>
          </figure>
        </section>
      </main>
      <footer className="shrink-0 border-t border-border px-5 py-3 text-center text-xs leading-relaxed text-muted-foreground">
        © 2026 Jane Street Group, LLC. All rights reserved{"\u00A0\u00A0"}|{"\u00A0\u00A0"}
        <Link to="/privacy" className="underline underline-offset-2">Privacy</Link>
        {"\u00A0\u00A0"}|{"\u00A0\u00A0"}
        <Link to="/terms" className="underline underline-offset-2">Terms of Service</Link>
      </footer>
    </div>
  );
}
