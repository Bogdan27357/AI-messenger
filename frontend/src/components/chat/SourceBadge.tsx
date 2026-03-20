"use client";

import { FileText } from "lucide-react";

interface SourceBadgeProps {
  text: string;
  score: number;
}

export function SourceBadge({ text, score }: SourceBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue cursor-help"
      title={text}
    >
      <FileText className="w-2.5 h-2.5" />
      {(score * 100).toFixed(0)}%
    </span>
  );
}
