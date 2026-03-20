"use client";

import { departmentNames } from "@/lib/utils";

interface DepartmentChartProps {
  data: { department: string; count: number }[];
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-bg-secondary border border-bg-card rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-primary mb-4">
        Активность по отделам
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Нет данных</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.department} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-24 truncate">
                {departmentNames[item.department] || item.department}
              </span>
              <div className="flex-1 bg-bg-primary rounded-full h-5 overflow-hidden">
                <div
                  className="h-full bg-accent-blue/60 rounded-full flex items-center justify-end pr-2 transition-all"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                >
                  <span className="text-[10px] text-text-primary font-mono">
                    {item.count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
