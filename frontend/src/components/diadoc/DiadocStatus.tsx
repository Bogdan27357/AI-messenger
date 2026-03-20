"use client";

interface DiadocStatusProps {
  status: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: "Создан", color: "bg-text-muted/20 text-text-muted" },
  ai_checked: { label: "ИИ проверил", color: "bg-accent-purple/20 text-accent-purple" },
  signed: { label: "КЭП подписан", color: "bg-accent-blue/20 text-accent-blue" },
  sent: { label: "Отправлен", color: "bg-status-diadoc/20 text-status-diadoc" },
  accepted: { label: "Подписан контрагентом", color: "bg-status-success/20 text-status-success" },
  error: { label: "Ошибка", color: "bg-red-500/20 text-red-400" },
};

export function DiadocStatus({ status }: DiadocStatusProps) {
  const config = statusConfig[status] || statusConfig.created;

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
}
