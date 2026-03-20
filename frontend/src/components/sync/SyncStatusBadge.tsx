"use client";

interface SyncStatusBadgeProps {
  status: string;
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const config: Record<string, { label: string; color: string }> = {
    saved: { label: "Сохранено", color: "bg-status-success/20 text-status-success" },
    pending: { label: "Ожидание", color: "bg-status-warning/20 text-status-warning" },
    error: { label: "Ошибка", color: "bg-red-500/20 text-red-400" },
  };

  const c = config[status] || config.pending;

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.color}`}>
      {c.label}
    </span>
  );
}
