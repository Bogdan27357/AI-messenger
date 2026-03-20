"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Send,
  BarChart3,
  Settings,
  Plane,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OneCWidget } from "./OneCWidget";

const navItems = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/documents", label: "Документы", icon: FileText },
  { href: "/chat", label: "Чат-ассистент", icon: MessageSquare },
  { href: "/diadoc", label: "ЭДО Диадок", icon: Send },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] h-screen bg-bg-secondary border-r border-bg-card flex flex-col fixed left-0 top-0">
      <div className="p-4 flex items-center gap-2 border-b border-bg-card">
        <div className="w-8 h-8 bg-accent-blue/20 rounded-lg flex items-center justify-center">
          <Plane className="w-4 h-4 text-accent-blue" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">Pulkovo AI</p>
          <p className="text-[10px] text-text-muted">Platform</p>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-accent-blue/10 text-accent-blue"
                  : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <OneCWidget />
    </aside>
  );
}
