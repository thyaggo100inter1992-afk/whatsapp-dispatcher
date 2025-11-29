/**
 * Restriction List Model
 * Model para gerenciar listas de restrição de envio
 */

export interface RestrictionListType {
  id: 'do_not_disturb' | 'blocked' | 'not_interested';
  name: string;
  description: string;
  retention_days: number | null;
  auto_add_enabled: boolean;
  created_at: Date;
}

export interface RestrictionListEntry {
  id: number;
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  
  // Informações do contato
  phone_number: string;
  phone_number_alt: string | null;
  contact_name: string | null;
  
  // Rastreamento de origem
  keyword_matched: string | null;
  button_payload: string | null;
  button_text: string | null;
  added_method: 'manual' | 'webhook_button' | 'webhook_keyword' | 'import';
  
  // Datas
  added_at: Date;
  expires_at: Date | null;
  
  // Metadados
  campaign_id: number | null;
  message_id: number | null;
  notes: string | null;
  
  created_at: Date;
  updated_at: Date;
}

export interface RestrictionListKeyword {
  id: number;
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  
  keyword: string;
  keyword_type: 'text' | 'button_payload' | 'button_text';
  case_sensitive: boolean;
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with';
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RestrictionListLog {
  id: number;
  entry_id: number | null;
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  
  action: string;
  phone_number: string;
  contact_name: string | null;
  
  performed_by: string | null;
  performed_at: Date;
  
  details: any;
  ip_address: string | null;
  user_agent: string | null;
}

export interface RestrictionListStats {
  id: number;
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  date: Date;
  
  total_entries: number;
  added_today: number;
  removed_today: number;
  expired_today: number;
  
  created_at: Date;
  updated_at: Date;
}

// DTO para criação de entrada
export interface CreateRestrictionEntryDTO {
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  phone_number: string;
  contact_name?: string;
  keyword_matched?: string;
  button_payload?: string;
  button_text?: string;
  added_method?: 'manual' | 'webhook_button' | 'webhook_keyword' | 'import';
  campaign_id?: number;
  message_id?: number;
  notes?: string;
}

// DTO para busca/filtro
export interface RestrictionListFilterDTO {
  list_type?: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id?: number;
  search?: string; // Busca por nome ou telefone
  added_method?: string;
  date_from?: Date;
  date_to?: Date;
  page?: number;
  limit?: number;
}

// DTO para importação em massa
export interface BulkImportDTO {
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  contacts: Array<{
    phone_number: string;
    contact_name?: string;
    notes?: string;
  }>;
}

// DTO para configuração de palavra-chave
export interface CreateKeywordDTO {
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  keyword: string;
  keyword_type: 'text' | 'button_payload' | 'button_text';
  case_sensitive?: boolean;
  match_type?: 'exact' | 'contains' | 'starts_with' | 'ends_with';
}

// DTO de resposta com paginação
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// DTO para estatísticas do dashboard
export interface DashboardStatsDTO {
  list_type: 'do_not_disturb' | 'blocked' | 'not_interested';
  whatsapp_account_id: number;
  total_entries: number;
  added_last_24h: number;
  added_last_7d: number;
  added_last_30d: number;
  expiring_soon: number; // Expira nos próximos 7 dias
  by_method: {
    manual: number;
    webhook_button: number;
    webhook_keyword: number;
    import: number;
  };
  timeline: Array<{
    date: string;
    added: number;
    removed: number;
    expired: number;
  }>;
}

export interface AllListsOverview {
  accounts: Array<{
    account_id: number;
    account_name: string;
    lists: {
      do_not_disturb: {
        total: number;
        added_today: number;
      };
      blocked: {
        total: number;
        added_today: number;
        expiring_soon: number;
      };
      not_interested: {
        total: number;
        added_today: number;
        expiring_soon: number;
      };
    };
  }>;
  global_totals: {
    do_not_disturb: number;
    blocked: number;
    not_interested: number;
  };
}




