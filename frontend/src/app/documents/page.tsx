"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TemplateCard } from "@/components/documents/TemplateCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Template } from "@/types/template";

export default function DocumentsPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        const data = await apiFetch<Template[]>("/api/templates/");
        setTemplates(data);
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
        <Header title="Документы" />
        <main className="p-6">
          <p className="text-sm text-text-secondary mb-4">
            Выберите шаблон для генерации документа
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onClick={() => router.push(`/documents/${tpl.slug}`)}
              />
            ))}
          </div>
          {templates.length === 0 && (
            <p className="text-center text-text-muted py-12">
              Нет доступных шаблонов для вашего отдела
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
