"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Field } from "@/types/document-type";

export function AnswerFieldInput({
  field,
  value,
  onChange,
  image,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  image?: boolean;
}) {
  const text = value == null ? "" : String(value);

  if (image) {
    const preview =
      typeof value === "string" && value.startsWith("data:") ? value : null;
    return (
      <div className="flex flex-col gap-2">
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-label={`${field.label} image`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) {
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                onChange(reader.result);
              }
            };
            reader.readAsDataURL(file);
          }}
          type="file"
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-12 w-auto max-w-40 rounded border object-contain"
            src={preview}
          />
        ) : null}
        {value ? (
          <Button
            onClick={() => onChange(undefined)}
            size="xs"
            type="button"
            variant="outline"
          >
            Remove image
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Optional. Skip if they will sign later.
          </p>
        )}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <select
        className="h-8 rounded-md border bg-background px-2"
        onChange={(event) => onChange(event.target.value || undefined)}
        value={text}
      >
        <option value="">Choose…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <input
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className="min-h-16 rounded-md border bg-background px-2 py-1"
        onChange={(event) => onChange(event.target.value)}
        value={text}
      />
    );
  }
  return (
    <Input
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
        )
      }
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      value={text}
    />
  );
}
