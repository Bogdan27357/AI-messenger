"use client";

import { useEffect } from "react";
import { useSyncStore } from "@/stores/useSyncStore";
import { apiFetch } from "@/lib/api";
import { Database, Users, Plane, Building2 } from "lucide-react";

export function OneCWidget() {
  const status = useSyncStore((s) => s.onecStatus);
  const setStatus = useSyncStore((s) => s.setOneCStatus);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiFetch<typeof status>("/api/1c/stats");
        setStatus({ ...data, connected: true });
      } catch {
        setStatus({ ...status, connected: false });
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    { icon: Building2, label: "Контрагенты", value: status.counterparties },
    { icon: Plane, label: "Рейсы", value: status.flights },
    { icon: Users, label: "Сотрудники", value: status.employees },
    { icon: Database, label: "Документы", value: status.documents },
  ];

  return (
    <div className="p-3 border-t border-bg-card">
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status.connected ? "bg-status-onec" : "bg-text-muted"
          }`}
        />
        <span className="text-xs font-medium text-status-onec">1С: Данные</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-[11px]"
          >
            <div className="flex items-center gap-1 text-text-muted">
              <item.icon className="w-3 h-3" />
              {item.label}
            </div>
            <span className="text-text-secondary font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
