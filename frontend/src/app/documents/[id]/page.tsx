"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DocumentForm } from "@/components/documents/DocumentForm";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { TemplateMeta } from "@/types/template";

export default function DocumentGeneratePage() {
  const params = useParams();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [meta, setMeta] = useState<TemplateMeta | null>(null);

  const slug = params.id as string;

  useEffect(() => {
    const init = async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        const data = await apiFetch<TemplateMeta>(`/api/templates/meta/${slug}`);
        setMeta(data);
      } catch {
        router.push("/login");
      }
    };
    init();
  }, [slug]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[200px]">
        <Header title={meta?.title ?? "Генерация документа"} />
        <main className="p-6">
          {meta ? (
            <DocumentForm meta={meta} />
          ) : (
            <p className="text-text-muted">Загрузка...</p>
          )}
        </main>
      </div>
    </div>
  );
}
