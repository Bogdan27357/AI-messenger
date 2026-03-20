"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchMe } from "@/lib/auth";

export default function ChatPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    fetchMe().then(setUser).catch(() => router.push("/login"));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[200px] flex flex-col">
        <Header title="Чат-ассистент" />
        <main className="flex-1 p-6">
          <ChatWindow />
        </main>
      </div>
    </div>
  );
}
