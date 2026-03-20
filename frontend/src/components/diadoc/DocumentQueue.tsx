"use client";

import { formatDate } from "@/lib/utils";
import { DiadocStatus } from "./DiadocStatus";
import type { DiadocQueueItem } from "@/types/diadoc";

interface DocumentQueueProps {
  queue: DiadocQueueItem[];
}

export function DocumentQueue({ queue }: DocumentQueueProps) {
  return (
    <div className="bg-bg-secondary border border-bg-card rounded-xl">
      <div className="p-4 border-b border-bg-card">
        <h3 className="text-sm font-medium text-text-primary">
          Очередь документов
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Документы для отправки через Контур.Диадок
        </p>
      </div>

      {queue.length === 0 ? (
        <p className="p-8 text-center text-sm text-text-muted">
          Нет документов в очереди
        </p>
      ) : (
        <div className="divide-y divide-bg-card">
          {queue.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">
                  Документ #{item.document_id.slice(0, 8)}
                </p>
                <p className="text-xs text-text-muted">
                  ИНН: {item.counterparty_inn || "—"} •{" "}
                  {formatDate(item.created_at)}
                </p>
              </div>
              <DiadocStatus status={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
