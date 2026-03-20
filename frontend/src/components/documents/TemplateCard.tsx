"use client";

import { FileText, ChevronRight } from "lucide-react";
import { departmentNames } from "@/lib/utils";
import type { Template } from "@/types/template";

interface TemplateCardProps {
  template: Template;
  onClick: () => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  const aiFields = template.fields.filter((f) => f.source === "ai").length;
  const onecFields = template.fields.filter((f) => f.source === "1c").length;

  return (
    <button
      onClick={onClick}
      className="bg-bg-secondary border border-bg-card rounded-xl p-5 text-left hover:border-accent-blue/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-accent-blue" />
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors" />
      </div>
      <h3 className="text-sm font-medium text-text-primary mb-1">
        {template.title}
      </h3>
      <p className="text-xs text-text-muted mb-3">
        {template.description || departmentNames[template.department] || template.department}
      </p>
      <div className="flex gap-2">
        {onecFields > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-status-onec/20 text-status-onec">
            1С: {onecFields} полей
          </span>
        )}
        {aiFields > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">
            ИИ: {aiFields} полей
          </span>
        )}
      </div>
    </button>
  );
}
