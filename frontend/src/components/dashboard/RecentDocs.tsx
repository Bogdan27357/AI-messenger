"use client";

import { formatDate, departmentNames } from "@/lib/utils";

interface RecentDocsProps {
  docs: {
    id: string;
    title: string;
    department: string;
    category: string;
    onec_status: string;
    created_at: string;
  }[];
}

export function RecentDocs({ docs }: RecentDocsProps) {
  const statusColors: Record<string, string> = {
    saved: "bg-status-success/20 text-status-success",
    pending: "bg-status-warning/20 text-status-warning",
    error: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="bg-bg-secondary border border-bg-card rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-primary mb-4">
        Последние документы
      </h3>
      {docs.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Нет документов</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 border-b border-bg-card last:border-0"
            >
              <div>
                <p className="text-sm text-text-primary">{doc.title}</p>
                <p className="text-[11px] text-text-muted">
                  {departmentNames[doc.department] || doc.department} •{" "}
                  {doc.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    statusColors[doc.onec_status] || statusColors.pending
                  }`}
                >
                  {doc.onec_status === "saved"
                    ? "1С ✓"
                    : doc.onec_status === "error"
                    ? "Ошибка"
                    : "Ожидание"}
                </span>
                <span className="text-[10px] text-text-muted">
                  {formatDate(doc.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
