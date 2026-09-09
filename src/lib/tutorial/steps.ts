export const TUTORIAL_STEP_IDS = [
  "welcome",
  "roles",
  "org",
  "studio",
  "fields",
  "branching",
  "tree",
  "template",
  "publish",
  "fill",
  "issue",
  "exports",
  "esign",
  "ingest",
  "holdout",
  "inbox",
  "done",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

export type TutorialRole = "org_admin" | "author" | "operator";

export type TutorialProgress = {
  role: TutorialRole | null;
  inviteEmail: string;
  typeName: string;
  fieldLabel: string;
  employmentType: "permanent" | "fixed-term" | null;
  examplePath: "permanent" | "fixed-term" | "contractor" | null;
  clause: string;
  bindingInserted: boolean;
  published: boolean;
  employeeName: string;
  generated: boolean;
  downloadedPdf: boolean;
  downloadedDocx: boolean;
  signerEmail: string;
  esignSent: boolean;
  sampleFile: "employment.pdf" | "invoice.pdf" | null;
  holdoutAction: "exclude" | "recategorize" | null;
  rereviewAck: boolean;
};

export const emptyTutorialProgress = (): TutorialProgress => ({
  role: null,
  inviteEmail: "",
  typeName: "",
  fieldLabel: "",
  employmentType: null,
  examplePath: null,
  clause: "",
  bindingInserted: false,
  published: false,
  employeeName: "",
  generated: false,
  downloadedPdf: false,
  downloadedDocx: false,
  signerEmail: "",
  esignSent: false,
  sampleFile: null,
  holdoutAction: null,
  rereviewAck: false,
});

export type TutorialStep = {
  id: TutorialStepId;
  title: string;
  explanation: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "What Dynadoc does",
    explanation:
      "Authors publish one document type; operators fill answers; each generate freezes a new PDF, Word file, and optional e-sign request.",
  },
  {
    id: "roles",
    title: "Pick a role",
    explanation:
      "Admins invite people and set branding, authors edit drafts and ingest corpora, and operators fill published types and download issued files.",
  },
  {
    id: "org",
    title: "Invite your team",
    explanation:
      "Organization invites send a magic-link email (or show the link locally) so the invitee joins with Author or Operator—not a role they claim in the browser.",
  },
  {
    id: "studio",
    title: "Name a document type",
    explanation:
      "Author Studio is where you create a draft type, then edit field groups, the block canvas, sample answers, and JSON import or export.",
  },
  {
    id: "fields",
    title: "Add a fillable field",
    explanation:
      "Groups hold fields operators will answer; a group can be repeatable so they add rows, and options can activate other groups.",
  },
  {
    id: "branching",
    title: "Branch the form",
    explanation:
      "Choosing Permanent versus Fixed-term shows or hides groups and clauses through option activations and visibleWhen or includeWhen rules—never JavaScript.",
  },
  {
    id: "tree",
    title: "Walk a complex tree",
    explanation:
      "Pick a path through the example engagement: employment branches drop contractor clauses, fixed-term swaps notice for an end date, and deliverables expand into table rows.",
  },
  {
    id: "template",
    title: "Write a bound clause",
    explanation:
      "Template blocks (heading, paragraph, list, table, break, signature, initials) interpolate field ids like {{employeeName}} from the same resolver as PDF and Word.",
  },
  {
    id: "publish",
    title: "Publish a frozen version",
    explanation:
      "Publish writes a version snapshot; later draft edits and sample answers never change that published JSON or any already-issued instance.",
  },
  {
    id: "fill",
    title: "Fill as an operator",
    explanation:
      "Fill uses the published snapshot with a live print preview; hidden groups unmount, and Generate stays off until visible required fields and rules pass.",
  },
  {
    id: "issue",
    title: "Generate an instance",
    explanation:
      "Generate always inserts a new instance with frozen answers and a resolved AST; issued PDF bytes are never overwritten.",
  },
  {
    id: "exports",
    title: "Download PDF and Word",
    explanation:
      "History lists issued files so you can download the PDF and a Word file built from that same resolved tree, not a second template language.",
  },
  {
    id: "esign",
    title: "Send for e-sign",
    explanation:
      "E-sign ships the issued PDF to Dropbox Sign and stores envelope status on the instance without rewriting stored PDF bytes.",
  },
  {
    id: "ingest",
    title: "Ingest a corpus",
    explanation:
      "Authors upload PDF or Word samples, classify them, then cluster eligible files into draft family JSON—never a published type.",
  },
  {
    id: "holdout",
    title: "Handle a holdout",
    explanation:
      "Mismatched or low-confidence files are held out of clustering until an author excludes, recategorizes, or switches mode; they never silently merge.",
  },
  {
    id: "inbox",
    title: "Act from Inbox",
    explanation:
      "Inbox holdout rows trigger rereview from your action, then you confirm draft trees, reject clauses, and optionally accept a proposed style theme.",
  },
  {
    id: "done",
    title: "You have the map",
    explanation:
      "Use Studio and Ingest to author, Fill and History to issue, and Organization to invite—issued documents stay frozen once generated.",
  },
];

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function canAdvanceTutorial(
  stepId: TutorialStepId,
  progress: TutorialProgress,
) {
  switch (stepId) {
    case "welcome":
    case "done":
      return true;
    case "roles":
      return progress.role !== null;
    case "org":
      return looksLikeEmail(progress.inviteEmail);
    case "studio":
      return progress.typeName.trim().length > 1;
    case "fields":
      return progress.fieldLabel.trim().length > 1;
    case "branching":
      return progress.employmentType !== null;
    case "tree":
      return progress.examplePath !== null;
    case "template":
      return progress.clause.trim().length > 2 && progress.bindingInserted;
    case "publish":
      return progress.published;
    case "fill":
      return progress.employeeName.trim().length > 1;
    case "issue":
      return progress.generated;
    case "exports":
      return progress.downloadedPdf && progress.downloadedDocx;
    case "esign":
      return looksLikeEmail(progress.signerEmail) && progress.esignSent;
    case "ingest":
      return progress.sampleFile !== null;
    case "holdout":
      return progress.holdoutAction !== null;
    case "inbox":
      return progress.rereviewAck;
    default: {
      const _never: never = stepId;
      return _never;
    }
  }
}

export function roleSummary(role: TutorialRole) {
  if (role === "org_admin") {
    return "You can invite members, author drafts, ingest corpora, fill published types, and manage issued files.";
  }
  if (role === "author") {
    return "You can edit drafts, ingest and review corpora, fill published types, and download issued files—but not invite teammates.";
  }
  return "You can fill published types and download or e-sign issued files—drafts and ingest stay with authors.";
}
