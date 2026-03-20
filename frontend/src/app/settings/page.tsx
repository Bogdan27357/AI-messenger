"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";
import { departmentNames } from "@/lib/utils";
import { User, Shield, Building2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    fetchMe().then(setUser).catch(() => router.push("/login"));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[200px]">
        <Header title="Настройки" />
        <main className="p-6">
          <div className="max-w-2xl space-y-6">
            <div className="bg-bg-secondary border border-bg-card rounded-xl p-6">
              <h3 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-accent-blue" />
                Профиль
              </h3>
              {user && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Имя</span>
                    <span className="text-text-primary">{user.full_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Логин</span>
                    <span className="text-text-primary">{user.username}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Email</span>
                    <span className="text-text-primary">{user.email}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bg-secondary border border-bg-card rounded-xl p-6">
              <h3 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-status-onec" />
                Отдел
              </h3>
              {user && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Отдел</span>
                    <span className="text-text-primary">
                      {departmentNames[user.department] || user.department}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Роль</span>
                    <span className="flex items-center gap-1 text-text-primary">
                      <Shield className="w-3 h-3 text-accent-purple" />
                      {user.role}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bg-secondary border border-bg-card rounded-xl p-6">
              <h3 className="text-sm font-medium text-text-primary mb-4">
                Система
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Версия платформы</span>
                  <span className="text-text-primary">1.0.0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">LLM</span>
                  <span className="text-text-primary">Ollama (локально)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">ЭДО</span>
                  <span className="text-status-diadoc">Контур.Диадок</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
