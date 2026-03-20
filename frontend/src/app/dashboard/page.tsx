"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DepartmentChart } from "@/components/dashboard/DepartmentChart";
import { RecentDocs } from "@/components/dashboard/RecentDocs";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  docs_today: number;
  docs_change_percent: number;
  department_stats: { department: string; count: number }[];
  recent_documents: {
    id: string;
    title: string;
    department: string;
    category: string;
    onec_status: string;
    created_at: string;
  }[];
  gpu_info: { models?: unknown[] };
}

export default function DashboardPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        const dashboard = await apiFetch<DashboardData>("/api/analytics/dashboard");
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
        <Header title="Дашборд" />
        <main className="p-6 space-y-6">
          <StatsCards
            docsToday={data?.docs_today ?? 0}
            docsChange={data?.docs_change_percent ?? 0}
            gpuInfo={data?.gpu_info}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DepartmentChart data={data?.department_stats ?? []} />
            <RecentDocs docs={data?.recent_documents ?? []} />
          </div>
        </main>
      </div>
    </div>
  );
}
