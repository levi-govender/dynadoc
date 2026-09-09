"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { studioResolve } from "@/lib/document-types/structure-preview";
import {
  EXAMPLE_ENGAGEMENT_ANSWERS,
  complexEngagementSnapshot,
  type ExampleEngagementPath,
} from "@/lib/tutorial/example-tree";
import {
  TUTORIAL_STEPS,
  canAdvanceTutorial,
  emptyTutorialProgress,
  roleSummary,
  type TutorialProgress,
  type TutorialStepId,
} from "@/lib/tutorial/steps";

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={
        selected
          ? "rounded-md border border-primary bg-primary/8 px-3 py-2 text-left text-sm font-medium"
          : "rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted/60"
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StepPractice({
  stepId,
  progress,
  setProgress,
}: {
  stepId: TutorialStepId;
  progress: TutorialProgress;
  setProgress: (next: TutorialProgress) => void;
}) {
  const fieldToken = progress.fieldLabel.trim()
    ? progress.fieldLabel.trim().replace(/\s+/g, "")
    : "employeeName";

  switch (stepId) {
    case "welcome":
      return (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This walkthrough uses practice fields only—it does not create types or
          send invites.
        </p>
      );
    case "roles":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["org_admin", "Admin"],
              ["author", "Author"],
              ["operator", "Operator"],
            ] as const
          ).map(([value, label]) => (
            <Choice
              key={value}
              onClick={() => setProgress({ ...progress, role: value })}
              selected={progress.role === value}
            >
              {label}
            </Choice>
          ))}
          {progress.role ? (
            <p className="sm:col-span-3 text-sm text-muted-foreground">
              {roleSummary(progress.role)}
            </p>
          ) : null}
        </div>
      );
    case "org":
      return (
        <label className="flex flex-col gap-1.5 text-sm">
          Teammate email
          <Input
            autoComplete="off"
            onChange={(event) =>
              setProgress({ ...progress, inviteEmail: event.target.value })
            }
            placeholder="alex@studio.example"
            type="email"
            value={progress.inviteEmail}
          />
        </label>
      );
    case "studio":
      return (
        <label className="flex flex-col gap-1.5 text-sm">
          Document type name
          <Input
            autoComplete="off"
            onChange={(event) =>
              setProgress({ ...progress, typeName: event.target.value })
            }
            placeholder="Employment contract"
            value={progress.typeName}
          />
        </label>
      );
    case "fields":
      return (
        <label className="flex flex-col gap-1.5 text-sm">
          Field label
          <Input
            autoComplete="off"
            onChange={(event) =>
              setProgress({ ...progress, fieldLabel: event.target.value })
            }
            placeholder="Employee name"
            value={progress.fieldLabel}
          />
        </label>
      );
    case "branching":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            onClick={() =>
              setProgress({ ...progress, employmentType: "permanent" })
            }
            selected={progress.employmentType === "permanent"}
          >
            Permanent — hide end date
          </Choice>
          <Choice
            onClick={() =>
              setProgress({ ...progress, employmentType: "fixed-term" })
            }
            selected={progress.employmentType === "fixed-term"}
          >
            Fixed-term — show end date
          </Choice>
        </div>
      );
    case "tree": {
      const path = progress.examplePath;
      const resolved = path
        ? studioResolve(
            complexEngagementSnapshot,
            EXAMPLE_ENGAGEMENT_ANSWERS[path],
          )
        : null;
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["permanent", "Permanent engineer"],
                ["fixed-term", "Fixed-term manager"],
                ["contractor", "Contractor entity"],
              ] as const
            ).map(([value, label]) => (
              <Choice
                key={value}
                onClick={() =>
                  setProgress({
                    ...progress,
                    examplePath: value satisfies ExampleEngagementPath,
                  })
                }
                selected={progress.examplePath === value}
              >
                {label}
              </Choice>
            ))}
          </div>
          {resolved?.ok ? (
            <ol className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {resolved.result.document.blocks.map((block) => (
                <li
                  className="border-b border-border/60 py-1 last:border-0"
                  key={block.id}
                >
                  <span className="font-medium uppercase tracking-wide text-muted-foreground">
                    {block.type}
                  </span>
                  <span className="ml-2 font-serif text-[13px] text-foreground">
                    {(block.rows ?? [])
                      .map((row) => row.map((child) => child.text).join(""))
                      .join(" · ") ||
                      (block.children ?? [])
                        .map((child) => child.text)
                        .join("") ||
                      "—"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a path to resolve the example tree.
            </p>
          )}
        </div>
      );
    }
    case "template":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            Clause text
            <Input
              autoComplete="off"
              onChange={(event) =>
                setProgress({ ...progress, clause: event.target.value })
              }
              placeholder="This agreement is between the employer and"
              value={progress.clause}
            />
          </label>
          <Button
            onClick={() => {
              const token = `{{${fieldToken}}}`;
              setProgress({
                ...progress,
                bindingInserted: true,
                clause: progress.clause.includes(token)
                  ? progress.clause
                  : `${progress.clause.trim()} ${token}`.trim(),
              });
            }}
            size="sm"
            type="button"
            variant={progress.bindingInserted ? "secondary" : "outline"}
          >
            Insert {`{{${fieldToken}}}`}
          </Button>
        </div>
      );
    case "publish":
      return (
        <Choice
          onClick={() => setProgress({ ...progress, published: true })}
          selected={progress.published}
        >
          Publish this version — freeze schema, template, and theme
        </Choice>
      );
    case "fill":
      return (
        <label className="flex flex-col gap-1.5 text-sm">
          {progress.fieldLabel.trim() || "Employee name"}
          <Input
            autoComplete="off"
            onChange={(event) =>
              setProgress({ ...progress, employeeName: event.target.value })
            }
            placeholder="Ada Lovelace"
            value={progress.employeeName}
          />
        </label>
      );
    case "issue":
      return (
        <Choice
          onClick={() => setProgress({ ...progress, generated: true })}
          selected={progress.generated}
        >
          Generate — create a new frozen instance
        </Choice>
      );
    case "exports":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            onClick={() => setProgress({ ...progress, downloadedPdf: true })}
            selected={progress.downloadedPdf}
          >
            Download PDF
          </Choice>
          <Choice
            onClick={() => setProgress({ ...progress, downloadedDocx: true })}
            selected={progress.downloadedDocx}
          >
            Download Word
          </Choice>
        </div>
      );
    case "esign":
      return (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm">
            Signer email
            <Input
              autoComplete="off"
              onChange={(event) =>
                setProgress({ ...progress, signerEmail: event.target.value })
              }
              placeholder="ada@example.com"
              type="email"
              value={progress.signerEmail}
            />
          </label>
          <Button
            onClick={() => setProgress({ ...progress, esignSent: true })}
            size="sm"
            type="button"
            variant={progress.esignSent ? "secondary" : "outline"}
          >
            {progress.esignSent ? "Request queued (demo)" : "Send issued PDF"}
          </Button>
        </div>
      );
    case "ingest":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            onClick={() =>
              setProgress({ ...progress, sampleFile: "employment.pdf" })
            }
            selected={progress.sampleFile === "employment.pdf"}
          >
            employment.pdf — in family
          </Choice>
          <Choice
            onClick={() =>
              setProgress({ ...progress, sampleFile: "invoice.pdf" })
            }
            selected={progress.sampleFile === "invoice.pdf"}
          >
            invoice.pdf — likely holdout
          </Choice>
        </div>
      );
    case "holdout":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice
            onClick={() =>
              setProgress({ ...progress, holdoutAction: "exclude" })
            }
            selected={progress.holdoutAction === "exclude"}
          >
            Exclude from this job
          </Choice>
          <Choice
            onClick={() =>
              setProgress({ ...progress, holdoutAction: "recategorize" })
            }
            selected={progress.holdoutAction === "recategorize"}
          >
            Recategorize and rereview
          </Choice>
        </div>
      );
    case "inbox":
      return (
        <Choice
          onClick={() => setProgress({ ...progress, rereviewAck: true })}
          selected={progress.rereviewAck}
        >
          Confirm rereview — re-run classify and gates from this action
        </Choice>
      );
    case "done": {
      const preview = progress.typeName.trim() || "your type";
      return (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Practice complete for {preview}
          {progress.employeeName.trim()
            ? `, last filled as ${progress.employeeName.trim()}`
            : ""}
          .
        </p>
      );
    }
    default: {
      const _never: never = stepId;
      return _never;
    }
  }
}

export function ProductTutorial({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(emptyTutorialProgress);
  const step = TUTORIAL_STEPS[index];
  const canAdvance = canAdvanceTutorial(step.id, progress);
  const isLast = index === TUTORIAL_STEPS.length - 1;
  const percent = useMemo(
    () => Math.round(((index + 1) / TUTORIAL_STEPS.length) * 100),
    [index],
  );

  function resetAndClose() {
    setIndex(0);
    setProgress(emptyTutorialProgress());
    onOpenChange(false);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          setIndex(0);
          setProgress(emptyTutorialProgress());
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent
        className="max-h-[min(40rem,calc(100vh-2rem))] sm:max-w-xl"
        showCloseButton
      >
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
            Step {index + 1} of {TUTORIAL_STEPS.length}
          </p>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.explanation}</DialogDescription>
        </DialogHeader>
        <div className="h-px bg-border">
          <div
            className="h-px bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <StepPractice
          progress={progress}
          setProgress={setProgress}
          stepId={step.id}
        />
        <DialogFooter className="rounded-b-md">
          <Button
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            type="button"
            variant="outline"
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={resetAndClose} type="button">
              Finish
            </Button>
          ) : (
            <Button
              disabled={!canAdvance}
              onClick={() =>
                setIndex((value) =>
                  Math.min(TUTORIAL_STEPS.length - 1, value + 1),
                )
              }
              type="button"
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
