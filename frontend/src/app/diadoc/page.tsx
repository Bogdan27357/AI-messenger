"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentQueue } from "@/components/diadoc/DocumentQueue";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { DiadocQueueItem } from "@/types/diadoc";

export default function DiadocPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [queue, setQueue] = useState<DiadocQueueItem[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        const data = await apiFetch<DiadocQueueItem[]>("/api/diadoc/queue");
        setQueue(data);
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
        <Header title="ЭДО Диадок" />
        <main className="p-6">
          <DocumentQueue queue={queue} />
        </main>
      </div>
    </div>
  );
}
