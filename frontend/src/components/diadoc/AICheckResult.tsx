"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { DiadocCheckResult } from "@/types/diadoc";

interface AICheckResultProps {
  result: DiadocCheckResult;
}

export function AICheckResult({ result }: AICheckResultProps) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        result.ok
          ? "bg-status-success/5 border-status-success/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {result.ok ? (
          <CheckCircle className="w-4 h-4 text-status-success" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span
          className={`text-sm font-medium ${
            result.ok ? "text-status-success" : "text-red-400"
          }`}
        >
          {result.ok ? "Проверка пройдена" : "Обнаружены ошибки"}
        </span>
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-1 mb-2">
          {result.errors.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-400">
              <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {err}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-status-warning">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {warn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
