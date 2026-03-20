export interface TemplateField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  source: "1c" | "manual" | "ai";
}

export interface Template {
  id: string;
  slug: string;
  title: string;
  description: string;
  department: string;
  model_name: string;
  fields: TemplateField[];
  is_active: boolean;
}

export interface TemplateMeta {
  id: string;
  title: string;
  department: string;
  model: string;
  fields: TemplateField[];
}
