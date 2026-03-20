export interface DiadocCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DiadocQueueItem {
  id: string;
  document_id: string;
  status: string;
  counterparty_inn: string;
  created_at: string;
}

export interface DiadocStatusRecord {
  id: string;
  document_id: string;
  message_id: string;
  entity_id: string;
  status: string;
  ai_check_result: Record<string, unknown>;
  counterparty_inn: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}
