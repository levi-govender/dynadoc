"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BLOCK_TYPES,
  addBlock,
  blockReferencesField,
  childrenArePlainText,
  deleteBlock,
  flattenText,
  moveBlock,
  setBlockText,
  type BlockType,
} from "@/lib/document-types/template";
import type { Block, Inline, Template } from "@/types/document-type";

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
  template: Template;
  selectedFieldId: string | null;
  onChange: (next: (current: Template) => Template) => void;
};

export function StudioBlockCanvas({
  template,
  selectedFieldId,
  onChange,
}: Props) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-100">
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3">
        <h2 className="text-sm font-medium">Document</h2>
        <p className="text-xs text-muted-foreground">
          Structure review — not the issued PDF.
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
                highlighted={
                  selectedFieldId != null &&
                  blockReferencesField(block, selectedFieldId)
                }
                key={block.id}
                onChange={onChange}
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
  highlighted,
  canMoveUp,
  canMoveDown,
  onChange,
}: {
  block: Block;
  highlighted: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: (current: Template) => Template) => void;
}) {
  const plain = childrenArePlainText(block.children);
  const editable =
    block.type === "heading" ||
    block.type === "paragraph" ||
    block.type === "list" ||
    block.type === "table";

  return (
    <div
      className={cn(
        "group relative rounded-sm px-2 py-1 -mx-2",
        highlighted && "bg-amber-50 ring-2 ring-amber-400/80",
      )}
    >
      <div className="mb-1 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
      {editable && plain ? (
        <textarea
          aria-label={`${block.type} text`}
          className={cn(
            "w-full resize-none bg-transparent outline-none",
            block.type === "heading" &&
              "font-serif text-2xl font-semibold leading-tight text-zinc-900",
            block.type === "paragraph" &&
              "min-h-16 font-serif text-[15px] leading-7 text-zinc-800",
            block.type === "list" &&
              "min-h-12 border-l-2 border-zinc-200 pl-4 font-serif text-[15px] leading-7",
            block.type === "table" &&
              "min-h-12 rounded border border-zinc-300 p-2 font-serif text-sm",
          )}
          onChange={(event) =>
            onChange((current) =>
              setBlockText(current, block.id, event.target.value),
            )
          }
          rows={block.type === "heading" ? 1 : 3}
          value={flattenText(block.children)}
        />
      ) : null}
      {editable && !plain ? (
        <p
          className={cn(
            "font-serif text-zinc-800",
            block.type === "heading" && "text-2xl font-semibold",
            block.type === "paragraph" && "text-[15px] leading-7",
          )}
        >
          <InlinePreview inlines={block.children ?? []} />
        </p>
      ) : null}
    </div>
  );
}

function InlinePreview({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.type === "text") {
          return <span key={index}>{inline.text}</span>;
        }
        if (inline.type === "bind") {
          return (
            <span
              className="mx-0.5 rounded bg-amber-100 px-1 font-mono text-xs text-amber-950"
              key={index}
            >
              {`{{${inline.field}}}`}
            </span>
          );
        }
        return (
          <span
            className="mx-0.5 rounded bg-sky-100 px-1 font-mono text-xs text-sky-950"
            key={index}
          >
            {inline.field} map
          </span>
        );
      })}
    </>
  );
}
