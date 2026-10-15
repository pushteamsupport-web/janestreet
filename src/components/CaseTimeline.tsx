import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Loader2 } from "lucide-react";
import { CASE_STATUS_LABELS, CASE_STATUSES, fetchCaseEvents } from "@/lib/cases";

/** Shows how a case has progressed, newest step last. */
export function CaseTimeline({ caseId, status }: { caseId: string; status: string }) {
  const query = useQuery({
    queryKey: ["case-events", caseId],
    queryFn: () => fetchCaseEvents(caseId),
  });

  if (query.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading timeline…
      </p>
    );
  }

  const events = query.data ?? [];
  const reached = new Set(events.map((event) => event.status));
  reached.add(status);

  return (
    <div>
      <ol className="space-y-4">
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          return (
            <li key={event.id} className="relative flex gap-3 pl-1">
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.6875rem] top-6 h-[calc(100%+0.25rem)] w-px bg-border"
                />
              ) : null}
              <span
                className={
                  isLast
                    ? "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                }
              >
                {isLast ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {CASE_STATUS_LABELS[event.status] ?? event.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </p>
                {event.note ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {event.note}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {CASE_STATUSES.map((value) => (
          <span
            key={value}
            className={
              reached.has(value)
                ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                : "rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
            }
          >
            {CASE_STATUS_LABELS[value]}
          </span>
        ))}
      </div>
    </div>
  );
}
