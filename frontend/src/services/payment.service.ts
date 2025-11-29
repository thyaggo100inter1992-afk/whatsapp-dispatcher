/**
 * Serviço de API de Pagamentos
 * Integração com backend de pagamentos Asaas
 */

import api from './api';

export interface Plan {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  limite_usuarios: number;
  limite_contas_whatsapp: number;
  limite_mensagens_mes: number;
  limite_campanhas_mes: number;
  limite_contatos: number;
  limite_templates: number;
  recursos: {
    api_acesso: boolean;
    relatorios_avancados: boolean;
    suporte_prioritario: boolean;
    whitelabel: boolean;
    webhook: boolean;
  };
  destaque: boolean;
  ordem: number;
  duracao_trial_dias: number;
}

export interface PaymentStatus {
  status: string;
  plano: string;
  plano_nome: string;
  preco_mensal: number;
  is_trial: boolean;
  is_blocked: boolean;
  trial_ends_at?: string;
  trial_days_remaining?: number;
  proximo_vencimento?: string;
  blocked_at?: string;
  will_be_deleted_at?: string;
  days_until_deletion?: number;
}

export interface Payment {
  id: number;
  valor: number;
  status: string;
  payment_type: string;
  due_date: string;
  invoice_url?: string;
  bank_slip_url?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  paid_at?: string;
  confirmed_at?: string;
}

export interface CreatePaymentRequest {
  plan_slug: string;
  billing_type: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
}

export interface CreatePaymentResponse {
  success: boolean;
  message: string;
  payment: Payment;
  plan: {
    nome: string;
    preco: number;
  };
}

class PaymentService {
  /**
   * Listar planos disponíveis
   */
  async listPlans(): Promise<Plan[]> {
    const response = await api.get('/payments/plans');
    return response.data.plans;
  }

  /**
   * Obter status de pagamento do tenant atual
   */
  async getPaymentStatus(): Promise<{ tenant: PaymentStatus; last_payment: Payment | null }> {
    const response = await api.get('/payments/status');
    return response.data;
  }

  /**
   * Criar nova cobrança
   */
  async createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const response = await api.post('/payments/create', data);
    return response.data;
  }
}

export default new PaymentService();





