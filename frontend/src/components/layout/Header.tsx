"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { logout } from "@/lib/auth";
import { departmentNames } from "@/lib/utils";
import { LogOut, User, Wifi, WifiOff } from "lucide-react";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const connected = useSyncStore((s) => s.onecStatus.connected);

  return (
    <header className="h-14 bg-bg-secondary border-b border-bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <>
              <Wifi className="w-3 h-3 text-status-success" />
              <span className="text-status-success">1С подключена</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-text-muted" />
              <span className="text-text-muted">1С отключена</span>
            </>
          )}
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-text-primary">{user.full_name}</p>
            <p className="text-[10px] text-text-muted">
              {departmentNames[user.department] || user.department}
            </p>
          </div>
          <div className="w-8 h-8 bg-accent-purple/20 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-accent-purple" />
          </div>
          <button
            onClick={logout}
            className="p-1.5 hover:bg-bg-card rounded-lg transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      )}
    </header>
  );
}
