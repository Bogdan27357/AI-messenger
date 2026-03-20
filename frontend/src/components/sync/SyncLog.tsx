"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { RefreshCw } from "lucide-react";

interface SyncEntry {
  id: string;
  template_slug: string;
  category: string;
  department: string;
  status: string;
  message: string;
  created_at: string;
}

export function SyncLog() {
  const [log, setLog] = useState<SyncEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SyncEntry[]>("/api/1c/sync-log?limit=20");
      setLog(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, []);

  return (
    <div className="bg-bg-secondary border border-bg-card rounded-xl">
      <div className="p-4 border-b border-bg-card flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          Лог синхронизации 1С
        </h3>
        <button
          onClick={fetchLog}
          disabled={loading}
          className="p-1.5 hover:bg-bg-card rounded-lg transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-text-muted ${
              loading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {log.length === 0 ? (
        <p className="p-6 text-center text-xs text-text-muted">
          Нет записей
        </p>
      ) : (
        <div className="divide-y divide-bg-card max-h-[500px] overflow-y-auto">
          {log.map((entry) => (
            <div key={entry.id} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-primary truncate max-w-[70%]">
                  {entry.message}
                </span>
                <SyncStatusBadge status={entry.status} />
              </div>
              <p className="text-[10px] text-text-muted">
                {formatDate(entry.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
