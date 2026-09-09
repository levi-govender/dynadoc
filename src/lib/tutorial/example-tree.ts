import type { Answers } from "@/lib/expr/evaluate";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import payload from "@/types/fixtures/complex-engagement.export.json";

export const complexEngagementSnapshot = parseDocumentTypeVersionSnapshot(
  payload.snapshot,
);

export type ExampleEngagementPath = "permanent" | "fixed-term" | "contractor";

const schedule = [
  { description: "Kickoff workshop", hours: 8 },
  { description: "Handover pack", hours: 4 },
];

export const EXAMPLE_ENGAGEMENT_ANSWERS: Record<
  ExampleEngagementPath,
  Answers
> = {
  permanent: {
    employeeName: "Ada Lovelace",
    employerName: "Analytical Engines Ltd",
    engagementKind: "employment",
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 8,
    schedule,
  },
  "fixed-term": {
    employeeName: "Ada Lovelace",
    employerName: "Analytical Engines Ltd",
    engagementKind: "employment",
    employmentType: "fixed-term",
    jobTitle: "Manager",
    startDate: "2026-04-01",
    endDate: "2026-10-01",
    schedule,
  },
  contractor: {
    employeeName: "Ada Lovelace",
    employerName: "Analytical Engines Ltd",
    engagementKind: "contractor",
    companyName: "Difference Engine LLC",
    dayRate: 950,
    startDate: "2026-04-01",
    schedule,
  },
};
