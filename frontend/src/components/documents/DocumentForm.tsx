"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { FieldWithSource } from "./FieldWithSource";
import { Loader2, Download, CheckCircle } from "lucide-react";
import type { TemplateMeta } from "@/types/template";

interface DocumentFormProps {
  meta: TemplateMeta;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function DocumentForm({ meta }: DocumentFormProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    category: string;
    onec_status: string;
  } | null>(null);

  const handleChange = (name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<{
        id: string;
        category: string;
        onec_status: string;
      }>("/api/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          template_slug: meta.id,
          fields,
        }),
      });
      setResult(data);
      toast.success("Документ сгенерирован");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const token = localStorage.getItem("access_token");
    window.open(
      `${API_URL}/api/documents/${result.id}/download?token=${token}`,
      "_blank"
    );
  };

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {meta.fields.map((field) => (
          <FieldWithSource
            key={field.name}
            field={field}
            value={fields[field.name] || ""}
            onChange={(val) => handleChange(field.name, val)}
          />
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Генерация...
            </>
          ) : (
            "Сгенерировать документ"
          )}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-bg-secondary border border-status-success/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-status-success" />
            <span className="text-sm font-medium text-status-success">
              Документ готов
            </span>
          </div>
          <p className="text-xs text-text-secondary mb-1">
            Категория: <span className="text-text-primary">{result.category}</span>
          </p>
          <p className="text-xs text-text-secondary mb-3">
            Статус 1С:{" "}
            <span
              className={
                result.onec_status === "saved"
                  ? "text-status-success"
                  : "text-status-warning"
              }
            >
              {result.onec_status === "saved" ? "Сохранён" : "Ожидание"}
            </span>
          </p>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Скачать .docx
          </button>
        </div>
      )}
    </div>
  );
}
