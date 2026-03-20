"use client";

const categories = [
  { value: "reconciliation_act", label: "Акт сверки" },
  { value: "invoice", label: "Счёт-фактура" },
  { value: "hr_order", label: "Кадровый приказ" },
  { value: "commercial_offer", label: "Коммерческое предложение" },
  { value: "certificate", label: "Справка" },
  { value: "service_act", label: "Акт оказания услуг" },
  { value: "memo", label: "Служебная записка" },
  { value: "procurement", label: "Закупка" },
  { value: "legal", label: "Юридический документ" },
  { value: "marketing", label: "Маркетинг" },
];

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div>
      <label className="text-sm text-text-secondary mb-1 block">
        Категория для 1С
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg-primary border border-bg-card rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue"
      >
        <option value="">Автоматически (ИИ)</option>
        {categories.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>
    </div>
  );
}
