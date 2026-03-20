"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { toast } from "sonner";
import { Plane } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Вход выполнен");
      router.push("/dashboard");
    } catch {
      toast.error("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8 bg-bg-secondary rounded-2xl border border-bg-card shadow-xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-accent-blue/20 rounded-xl flex items-center justify-center">
            <Plane className="w-6 h-6 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Pulkovo AI</h1>
            <p className="text-sm text-text-secondary">Platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Имя пользователя
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-bg-primary border border-bg-card rounded-lg text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
              placeholder="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-bg-primary border border-bg-card rounded-lg text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Аэропорт Пулково — AI Document Platform
        </p>
      </div>
    </div>
  );
}
