"use client";

import type { TemplateField } from "@/types/template";

interface FieldWithSourceProps {
  field: TemplateField;
  value: string;
  onChange: (value: string) => void;
}

export function FieldWithSource({ field, value, onChange }: FieldWithSourceProps) {
  const sourceBadge = {
    "1c": { label: "1С ✓", color: "bg-status-onec/20 text-status-onec" },
    ai: { label: "ИИ", color: "bg-accent-purple/20 text-accent-purple" },
    manual: { label: "Вручную", color: "bg-bg-card text-text-muted" },
  }[field.source];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm text-text-secondary">{field.label}</label>
        {field.required && <span className="text-red-400 text-xs">*</span>}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${sourceBadge.color}`}
        >
          {sourceBadge.label}
        </span>
      </div>
      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg-primary border border-bg-card rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue transition-colors resize-y min-h-[80px]"
          placeholder={field.source === "ai" ? "Будет заполнено ИИ..." : ""}
          required={field.required && field.source === "manual"}
        />
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg-primary border border-bg-card rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue transition-colors"
          placeholder={
            field.source === "1c"
              ? "Загрузка из 1С..."
              : field.source === "ai"
              ? "Будет заполнено ИИ..."
              : ""
          }
          required={field.required && field.source === "manual"}
        />
      )}
    </div>
  );
}
