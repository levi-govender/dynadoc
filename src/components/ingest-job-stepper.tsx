const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "classify", label: "Classify" },
  { id: "cluster", label: "Group clauses" },
  { id: "drafts", label: "Review drafts" },
] as const;

export function IngestJobStepper({ status }: { status: string }) {
  const current =
    status === "uploaded"
      ? 1
      : status === "classified"
        ? 2
        : status === "clustered"
          ? 3
          : 0;

  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            className={
              active
                ? "rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                : done
                  ? "rounded-full bg-muted px-2.5 py-1 text-foreground"
                  : "rounded-full px-2.5 py-1 text-muted-foreground"
            }
            key={step.id}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
