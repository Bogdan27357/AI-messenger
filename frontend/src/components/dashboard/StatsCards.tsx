"use client";

import { FileText, Brain, Clock, Cpu } from "lucide-react";

interface StatsCardsProps {
  docsToday: number;
  docsChange: number;
  gpuInfo?: { models?: unknown[] };
}

export function StatsCards({ docsToday, docsChange, gpuInfo }: StatsCardsProps) {
  const gpuActive = (gpuInfo?.models as unknown[])?.length ?? 0;

  const cards = [
    {
      label: "Документов сегодня",
      value: docsToday,
      change: docsChange,
      icon: FileText,
      color: "text-accent-blue",
      bg: "bg-accent-blue/10",
    },
    {
      label: "Запросов к ИИ",
      value: docsToday * 2,
      change: docsChange,
      icon: Brain,
      color: "text-accent-purple",
      bg: "bg-accent-purple/10",
    },
    {
      label: "Среднее время (с)",
      value: "2.4",
      change: -5,
      icon: Clock,
      color: "text-status-success",
      bg: "bg-status-success/10",
    },
    {
      label: "GPU загрузка",
      value: `${gpuActive} моделей`,
      change: 0,
      icon: Cpu,
      color: "text-status-warning",
      bg: "bg-status-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-bg-secondary border border-bg-card rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-muted">{card.label}</span>
            <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{card.value}</p>
          {typeof card.change === "number" && card.change !== 0 && (
            <p
              className={`text-xs mt-1 ${
                card.change > 0 ? "text-status-success" : "text-red-400"
              }`}
            >
              {card.change > 0 ? "+" : ""}
              {card.change}% к вчера
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
