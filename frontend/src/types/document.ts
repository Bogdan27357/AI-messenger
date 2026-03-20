export interface Document {
  id: string;
  title: string;
  template_slug: string;
  category: string;
  department: string;
  input_data: Record<string, unknown>;
  ai_data: Record<string, unknown>;
  file_path: string;
  onec_status: string;
  onec_doc_id?: string;
  created_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  template_slug: string;
  category: string;
  department: string;
  onec_status: string;
  created_at: string;
}
