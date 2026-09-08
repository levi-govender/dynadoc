"use client";

import { Button } from "@/components/ui/button";
import { listFormFields } from "@/lib/document-types/form-schema";
import {
  BLOCK_TYPES,
  addBlock,
  appendBind,
  appendVariantMap,
  blockReferencesField,
  deleteBlock,
  flattenText,
  moveBlock,
  removeInline,
  setBlockText,
  setVariantMapEntry,
  updateTextInline,
  type BlockType,
} from "@/lib/document-types/template";
import { GroupActivationCycleError, resolveDocument } from "@/lib/resolver/resolve";
import type { Answers } from "@/lib/expr/evaluate";
import { cn } from "@/lib/utils";
import type {
  Block,
  DocumentTypeVersionSnapshot,
  FormSchema,
  Inline,
  Template,
} from "@/types/document-type";

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "List",
  table: "Table",
  pageBreak: "Page break",
  signature: "Signature",
  initials: "Initials",
};

type Props = {
  snapshot: DocumentTypeVersionSnapshot;
  sampleAnswers: Answers;
  selectedFieldId: string | null;
  onChange: (next: (current: Template) => Template) => void;
};

export function StudioBlockCanvas({
  snapshot,
  sampleAnswers,
  selectedFieldId,
  onChange,
}: Props) {
  const template = snapshot.template;
  let resolvedText = new Map<string, string>();
  try {
    const resolved = resolveDocument(snapshot, sampleAnswers);
    resolvedText = new Map(
      resolved.document.blocks.map((block) => [
        block.id,
        (block.children ?? []).map((child) => child.text).join(""),
      ]),
    );
  } catch (error) {
    if (!(error instanceof GroupActivationCycleError)) {
      throw error;
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-100">
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3">
        <h2 className="text-sm font-medium">Document</h2>
        <p className="text-xs text-muted-foreground">
          Sample answers interpolate binds and variant maps.
        </p>
        <div className="ml-auto flex flex-wrap gap-1">
          {BLOCK_TYPES.map((type) => (
            <Button
              key={type}
              onClick={() => onChange((current) => addBlock(current, type))}
              size="xs"
              type="button"
              variant="outline"
            >
              {BLOCK_LABELS[type]}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        <div className="mx-auto min-h-[36rem] max-w-[40rem] bg-white px-10 py-12 shadow-lg ring-1 ring-black/5">
          {template.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a heading or paragraph to start the document.
            </p>
          ) : null}
          <div className="flex flex-col gap-6">
            {template.blocks.map((block, index) => (
              <BlockRow
                block={block}
                canMoveDown={index < template.blocks.length - 1}
                canMoveUp={index > 0}
                form={snapshot.formSchema}
                highlighted={
                  selectedFieldId != null &&
                  blockReferencesField(block, selectedFieldId)
                }
                key={block.id}
                onChange={onChange}
                preview={resolvedText.get(block.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BlockRow({
  block,
  form,
  preview,
  highlighted,
  canMoveUp,
  canMoveDown,
  onChange,
}: {
  block: Block;
  form: FormSchema;
  preview: string | undefined;
  highlighted: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: (current: Template) => Template) => void;
}) {
  const editable =
    block.type === "heading" ||
    block.type === "paragraph" ||
    block.type === "list" ||
    block.type === "table";
  const fields = listFormFields(form);
  const selectFields = fields.filter((field) => field.type === "select");

  return (
    <div
      className={cn(
        "group relative -mx-2 rounded-sm px-2 py-1",
        highlighted && "bg-amber-50 ring-2 ring-amber-400/80",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {BLOCK_LABELS[block.type]}
        </span>
        <Button
          disabled={!canMoveUp}
          onClick={() =>
            onChange((current) => moveBlock(current, block.id, -1))
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          Up
        </Button>
        <Button
          disabled={!canMoveDown}
          onClick={() =>
            onChange((current) => moveBlock(current, block.id, 1))
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          Down
        </Button>
        <Button
          onClick={() => onChange((current) => deleteBlock(current, block.id))}
          size="xs"
          type="button"
          variant="ghost"
        >
          Delete
        </Button>
        {editable && fields.length > 0 ? (
          <select
            aria-label="Insert field binding"
            className="h-6 rounded border bg-background px-1 text-xs"
            defaultValue=""
            onChange={(event) => {
              const fieldId = event.target.value;
              if (fieldId) {
                onChange((current) => appendBind(current, block.id, fieldId));
                event.target.value = "";
              }
            }}
          >
            <option value="">Insert {"{{field}}"}</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        ) : null}
        {editable && selectFields.length > 0 ? (
          <select
            aria-label="Insert variant map"
            className="h-6 rounded border bg-background px-1 text-xs"
            defaultValue=""
            onChange={(event) => {
              const fieldId = event.target.value;
              const field = selectFields.find((entry) => entry.id === fieldId);
              if (field) {
                onChange((current) =>
                  appendVariantMap(
                    current,
                    block.id,
                    field.id,
                    (field.options ?? []).map((option) => option.value),
                  ),
                );
                event.target.value = "";
              }
            }}
          >
            <option value="">Insert variant map</option>
            {selectFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {block.type === "pageBreak" ? (
        <div className="flex items-center gap-3 py-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 border-t border-dashed" />
          Page break
          <span className="h-px flex-1 border-t border-dashed" />
        </div>
      ) : null}
      {block.type === "signature" ? (
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm text-zinc-700">
          <div>
            <p className="mb-8 border-b border-zinc-400" />
            <p>Signature</p>
          </div>
          <div>
            <p className="mb-8 border-b border-zinc-400" />
            <p>Date</p>
          </div>
        </div>
      ) : null}
      {block.type === "initials" ? (
        <div className="flex items-end gap-2 text-sm text-zinc-700">
          <span className="inline-block size-10 border border-zinc-400" />
          <span>Initials</span>
        </div>
      ) : null}
      {editable ? (
        <>
          <p
            className={cn(
              "font-serif text-zinc-800",
              block.type === "heading" && "text-2xl font-semibold leading-tight",
              block.type === "paragraph" && "min-h-8 text-[15px] leading-7",
              block.type === "list" &&
                "border-l-2 border-zinc-200 pl-4 text-[15px] leading-7",
              block.type === "table" &&
                "rounded border border-zinc-300 p-2 text-sm",
            )}
          >
            {preview || flattenText(block.children) || (
              <span className="text-muted-foreground">Empty</span>
            )}
          </p>
          <WordingEditor block={block} form={form} onChange={onChange} />
        </>
      ) : null}
    </div>
  );
}

function WordingEditor({
  block,
  form,
  onChange,
}: {
  block: Block;
  form: FormSchema;
  onChange: (next: (current: Template) => Template) => void;
}) {
  const children = block.children ?? [];
  const fields = listFormFields(form);
  if (children.length === 0) {
    return (
      <textarea
        aria-label={`${block.type} text`}
        className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-xs"
        onChange={(event) =>
          onChange((current) =>
            setBlockText(current, block.id, event.target.value),
          )
        }
        rows={2}
        value=""
      />
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-dashed p-2">
      {children.map((child, index) => (
        <InlineEditor
          blockId={block.id}
          fields={fields}
          index={index}
          inline={child}
          key={`${block.id}-${index}`}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function InlineEditor({
  blockId,
  index,
  inline,
  fields,
  onChange,
}: {
  blockId: string;
  index: number;
  inline: Inline;
  fields: ReturnType<typeof listFormFields>;
  onChange: (next: (current: Template) => Template) => void;
}) {
  if (inline.type === "text") {
    return (
      <div className="flex gap-1">
        <textarea
          aria-label="Static wording"
          className="min-h-8 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
          onChange={(event) =>
            onChange((current) =>
              updateTextInline(current, blockId, index, event.target.value),
            )
          }
          rows={2}
          value={inline.text}
        />
        <Button
          onClick={() =>
            onChange((current) => removeInline(current, blockId, index))
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          ×
        </Button>
      </div>
    );
  }
  if (inline.type === "bind") {
    const label =
      fields.find((field) => field.id === inline.field)?.label ?? inline.field;
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-950">
          {`{{${inline.field}}}`}
        </span>
        <span className="text-muted-foreground">{label}</span>
        <Button
          onClick={() =>
            onChange((current) => removeInline(current, blockId, index))
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          Remove
        </Button>
      </div>
    );
  }
  const field = fields.find((entry) => entry.id === inline.field);
  const options = field?.options ?? Object.keys(inline.variants).map((value) => ({
    value,
    label: value,
  }));
  return (
    <div className="flex flex-col gap-1 rounded bg-sky-50 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span>
          Variant map · {field?.label ?? inline.field} ({inline.field})
        </span>
        <Button
          onClick={() =>
            onChange((current) => removeInline(current, blockId, index))
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          Remove
        </Button>
      </div>
      {options.map((option) => (
        <label className="flex flex-col gap-0.5" key={option.value}>
          <span className="text-muted-foreground">{option.label}</span>
          <input
            className="h-7 rounded-md border bg-background px-2"
            onChange={(event) =>
              onChange((current) =>
                setVariantMapEntry(
                  current,
                  blockId,
                  index,
                  option.value,
                  event.target.value,
                ),
              )
            }
            value={inline.variants[option.value] ?? ""}
          />
        </label>
      ))}
    </div>
  );
}
