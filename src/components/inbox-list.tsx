"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type InboxItem = {
  id: string;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

function holdoutFiles(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const files = (payload as { files?: unknown }).files;
  if (!Array.isArray(files)) {
    return [];
  }
  return files.flatMap((file) => {
    if (!file || typeof file !== "object") {
      return [];
    }
    const record = file as {
      fileId?: unknown;
      filename?: unknown;
      category?: unknown;
      documentType?: unknown;
      confidence?: unknown;
    };
    if (typeof record.fileId !== "string") {
      return [];
    }
    return [
      {
        fileId: record.fileId,
        filename: typeof record.filename === "string" ? record.filename : "file",
        category:
          typeof record.category === "string" ? record.category : "unknown",
        documentType:
          typeof record.documentType === "string"
            ? record.documentType
            : "unknown",
        confidence:
          typeof record.confidence === "number" ? record.confidence : null,
      },
    ];
  });
}

function jobIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const jobId = (payload as { jobId?: unknown }).jobId;
  return typeof jobId === "string" ? jobId : null;
}

function summary(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { reason?: unknown; message?: unknown };
  if (typeof record.message === "string") {
    return record.message;
  }
  if (typeof record.reason === "string") {
    return record.reason;
  }
  return null;
}

export function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function typeLabel(type: string) {
    if (type === "ingest_holdout") {
      return "Ingest holdout";
    }
    if (type === "ingest_rereview") {
      return "Ingest re-review";
    }
    return "Notice";
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          void fetch("/api/notifications", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "generic",
              payload: { message: "Inbox stub" },
            }),
          }).then(async (response) => {
            const body: unknown = await response.json().catch(() => null);
            setPending(false);
            if (
              !response.ok ||
              !body ||
              typeof body !== "object" ||
              !("notification" in body)
            ) {
              return;
            }
            const notification = (body as { notification: InboxItem })
              .notification;
            setItems((current) => [notification, ...current]);
          });
        }}
        type="button"
      >
        Send test notification
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li className="rounded-md border p-3" key={item.id}>
              <p className="text-sm font-medium">{typeLabel(item.type)}</p>
              {summary(item.payload) ? (
                <p className="text-sm text-muted-foreground">
                  {summary(item.payload)}
                </p>
              ) : null}
              {item.type === "ingest_holdout"
                ? holdoutFiles(item.payload).map((file) => {
                    const jobId = jobIdFromPayload(item.payload);
                    return (
                      <div className="mt-2 text-sm" key={file.fileId}>
                        <p>
                          {file.filename} · {file.documentType} / {file.category}
                          {file.confidence != null
                            ? ` · ${Math.round(file.confidence * 100)}%`
                            : ""}
                        </p>
                        {jobId && !item.readAt ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(
                              [
                                "exclude",
                                "confirm_and_continue",
                                "switch_to_decompose",
                              ] as const
                            ).map((action) => (
                              <Button
                                key={action}
                                onClick={() => {
                                  setError(null);
                                  void fetch(
                                    `/api/ingest-jobs/${jobId}/rereview`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "content-type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        fileId: file.fileId,
                                        action,
                                        notificationId: item.id,
                                      }),
                                    },
                                  ).then(async (response) => {
                                    if (!response.ok) {
                                      const body: unknown = await response
                                        .json()
                                        .catch(() => null);
                                      setError(
                                        body &&
                                          typeof body === "object" &&
                                          "error" in body &&
                                          typeof body.error === "string"
                                          ? body.error
                                          : "Rereview failed",
                                      );
                                      return;
                                    }
                                    setItems((current) =>
                                      current.map((row) =>
                                        row.id === item.id
                                          ? { ...row, readAt: new Date().toISOString() }
                                          : row,
                                      ),
                                    );
                                  });
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {action.replaceAll("_", " ")}
                              </Button>
                            ))}
                            <Button
                              onClick={() => {
                                setError(null);
                                void fetch(
                                  `/api/ingest-jobs/${jobId}/rereview`,
                                  {
                                    method: "POST",
                                    headers: {
                                      "content-type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      fileId: file.fileId,
                                      action: "recategorize",
                                      category: "contract",
                                      documentType: "employment",
                                      notificationId: item.id,
                                    }),
                                  },
                                ).then(async (response) => {
                                  if (!response.ok) {
                                    setError("Recategorize failed");
                                    return;
                                  }
                                  setItems((current) =>
                                    current.map((row) =>
                                      row.id === item.id
                                        ? { ...row, readAt: new Date().toISOString() }
                                        : row,
                                    ),
                                  );
                                });
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Recategorize as employment contract
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                : null}
              <p className="text-xs text-muted-foreground">
                {item.createdAt.replace("T", " ").slice(0, 16)} UTC
                {item.readAt ? " · Read" : " · Unread"}
              </p>
              {!item.readAt ? (
                <Button
                  className="mt-2"
                  onClick={() => {
                    void fetch(`/api/notifications/${item.id}`, {
                      method: "PATCH",
                    }).then(async (response) => {
                      const body: unknown = await response.json().catch(
                        () => null,
                      );
                      if (
                        !response.ok ||
                        !body ||
                        typeof body !== "object" ||
                        !("notification" in body)
                      ) {
                        return;
                      }
                      const next = (body as { notification: InboxItem })
                        .notification;
                      setItems((current) =>
                        current.map((row) =>
                          row.id === next.id ? next : row,
                        ),
                      );
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Mark read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
