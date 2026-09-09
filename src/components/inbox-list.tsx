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
