"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DepartmentChart } from "@/components/dashboard/DepartmentChart";
import { RecentDocs } from "@/components/dashboard/RecentDocs";
import { SyncLog } from "@/components/sync/SyncLog";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function AnalyticsPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        const dashboard = await apiFetch<Record<string, unknown>>("/api/analytics/dashboard");
        setData(dashboard);
      } catch {
        router.push("/login");
      }
    };
    init();
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[200px]">
        <Header title="Аналитика" />
        <main className="p-6 space-y-6">
          <StatsCards
            docsToday={(data?.docs_today as number) ?? 0}
            docsChange={(data?.docs_change_percent as number) ?? 0}
            gpuInfo={data?.gpu_info as { models?: unknown[] }}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <DepartmentChart
                data={(data?.department_stats as { department: string; count: number }[]) ?? []}
              />
              <RecentDocs
                docs={
                  (data?.recent_documents as {
                    id: string;
                    title: string;
                    department: string;
                    category: string;
                    onec_status: string;
                    created_at: string;
                  }[]) ?? []
                }
              />
            </div>
            <SyncLog />
          </div>
        </main>
      </div>
    </div>
  );
}
