/**
 * Serviço de Integração com Asaas
 * Gerencia criação de clientes, cobranças e assinaturas
 */

import axios, { AxiosInstance } from 'axios';
import { pool } from '../database/connection';

interface AsaasCustomer {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
}

interface AsaasPayment {
  customer: string; // ID do customer no Asaas
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
}

interface AsaasSubscription {
  customer: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
}

interface AsaasCredential {
  id: number;
  api_key: string;
  environment: 'production' | 'sandbox';
}

class AsaasService {
  private api: AxiosInstance | null = null;
  private apiKey: string = '';
  private environment: 'production' | 'sandbox' = 'sandbox';

  /**
   * Buscar credencial Asaas do banco de dados
   */
  private async getAsaasCredential(tenantId?: number): Promise<AsaasCredential | null> {
    try {
      let credential: AsaasCredential | null = null;

      if (tenantId) {
        // PRIORIDADE 1: Tentar buscar credencial específica do tenant
        console.log(`🔍 Buscando credencial Asaas específica do tenant ${tenantId}...`);
        const tenantQuery = `
          SELECT ac.id, ac.api_key, ac.environment
          FROM asaas_credentials ac
          INNER JOIN tenants t ON t.asaas_credential_id = ac.id
          WHERE t.id = $1 AND ac.is_active = true
        `;
        
        const tenantResult = await pool.query(tenantQuery, [tenantId]);
        
        if (tenantResult.rows.length > 0) {
          credential = tenantResult.rows[0] as AsaasCredential;
          console.log(`✅ Credencial específica do tenant encontrada: ID ${credential.id}, Ambiente: ${credential.environment}`);
          return credential;
        }
        
        console.log(`⚠️  Tenant ${tenantId} não possui credencial específica vinculada`);
        console.log(`🔄 Fazendo fallback para credencial padrão...`);
      }

      // PRIORIDADE 2: Buscar credencial padrão (fallback ou quando tenantId não informado)
      console.log('🔍 Buscando credencial Asaas padrão...');
      const defaultQuery = `
        SELECT id, api_key, environment
        FROM asaas_credentials
        WHERE is_default = true AND is_active = true
        LIMIT 1
      `;
      
      const defaultResult = await pool.query(defaultQuery);
      
      if (defaultResult.rows.length === 0) {
        console.error('❌ Nenhuma credencial Asaas encontrada');
        console.error('💡 Dica: Verifique se existe uma credencial marcada como padrão (is_default = true) e ativa (is_active = true)');
        return null;
      }

      credential = defaultResult.rows[0] as AsaasCredential;
      console.log(`✅ Credencial padrão encontrada: ID ${credential.id}, Ambiente: ${credential.environment}`);
      return credential;
    } catch (error) {
      console.error('❌ Erro ao buscar credencial Asaas:', error);
      return null;
    }
  }

  /**
   * Inicializar API Asaas com credenciais do banco
   */
  private async initializeApi(tenantId?: number): Promise<void> {
    const credential = await this.getAsaasCredential(tenantId);
    
    if (!credential) {
      throw new Error('Sistema de pagamentos não configurado. Configure uma credencial Asaas no painel de administração.');
    }

    // IMPORTANTE: Limpar a chave de espaços e quebras de linha
    this.apiKey = credential.api_key.trim();
    this.environment = credential.environment;
    
    // Log detalhado para debug
    console.log(`🔐 Inicializando Asaas Service:`);
    console.log(`   - Tenant ID: ${tenantId || 'padrão'}`);
    console.log(`   - Credencial ID: ${credential.id}`);
    console.log(`   - Ambiente: ${this.environment}`);
    console.log(`   - API Key (início): ${this.apiKey.substring(0, 20)}...`);
    console.log(`   - Tamanho da chave: ${this.apiKey.length} caracteres`);
    
    const baseURL = this.environment === 'production' 
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey
      },
      timeout: 30000
    });

    console.log(`✅ Asaas Service inicializado com sucesso`);
  }

  /**
   * Criar cliente no Asaas
   */
  async createCustomer(data: AsaasCustomer, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('📝 Criando cliente no Asaas:', data.email);
      
      const response = await this.api!.post('/customers', {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        phone: data.phone,
        mobilePhone: data.mobilePhone || data.phone
      });

      console.log('✅ Cliente criado no Asaas:', response.data.id);
      return response.data;
    } catch (error: any) {
      console.error('❌ ========================================');
      console.error('❌ ERRO AO CRIAR CLIENTE NO ASAAS');
      console.error('❌ ========================================');
      console.error('❌ Status HTTP:', error.response?.status);
      console.error('❌ Dados enviados:', data);
      console.error('❌ Resposta do Asaas:', JSON.stringify(error.response?.data, null, 2));
      console.error('❌ Mensagem:', error.message);
      
      const asaasError = error.response?.data?.errors?.[0];
      const errorMessage = asaasError?.description || error.response?.data?.message || error.message;
      
      throw new Error(`Erro ao criar cliente no Asaas: ${errorMessage}`);
    }
  }

  /**
   * Atualizar cliente no Asaas
   */
  async updateCustomer(customerId: string, data: AsaasCustomer, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('📝 Atualizando cliente no Asaas:', customerId);
      
      const response = await this.api!.put(`/customers/${customerId}`, {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        phone: data.phone,
        mobilePhone: data.mobilePhone || data.phone
      });

      console.log('✅ Cliente atualizado no Asaas:', response.data.id);
      return response.data;
    } catch (error: any) {
      console.error('❌ ========================================');
      console.error('❌ ERRO AO ATUALIZAR CLIENTE NO ASAAS');
      console.error('❌ ========================================');
      console.error('❌ Status HTTP:', error.response?.status);
      console.error('❌ Customer ID:', customerId);
      console.error('❌ Dados enviados:', data);
      console.error('❌ Resposta do Asaas:', JSON.stringify(error.response?.data, null, 2));
      console.error('❌ Mensagem:', error.message);
      
      const asaasError = error.response?.data?.errors?.[0];
      const errorMessage = asaasError?.description || error.response?.data?.message || error.message;
      
      throw new Error(`Erro ao atualizar cliente no Asaas: ${errorMessage}`);
    }
  }

  /**
   * Buscar cliente por email
   */
  async findCustomerByEmail(email: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      const response = await this.api!.get('/customers', {
        params: { email }
      });

      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;
    } catch (error: any) {
      console.error('❌ Erro ao buscar cliente:', error.message);
      return null;
    }
  }

  /**
   * Buscar dados do QR Code PIX
   */
  async getPixQrCode(paymentId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);

      console.log('🔍 Buscando QR Code PIX:', paymentId);

      const response = await this.api!.get(`/payments/${paymentId}/pixQrCode`);

      console.log('✅ QR Code PIX obtido com sucesso');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Code PIX:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Criar cobrança única (Boleto ou PIX)
   */
  async createPayment(data: AsaasPayment, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('💰 Criando cobrança no Asaas:');
      console.log('   - Customer:', data.customer);
      console.log('   - Tipo:', data.billingType);
      console.log('   - Valor:', data.value);
      console.log('   - Vencimento:', data.dueDate);
      console.log('   - Descrição:', data.description);
      
      const response = await this.api!.post('/payments', {
        customer: data.customer,
        billingType: data.billingType,
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
        externalReference: data.externalReference,
        // Configurações adicionais
        postalService: false, // Não enviar pelos correios
        ...( data.billingType === 'BOLETO' && {
          fine: {
            value: 2.00 // Multa de R$ 2,00
          },
          interest: {
            value: 1.00 // Juros de R$ 1,00 por dia
          }
        })
      });

      console.log('✅ Cobrança criada com sucesso:', response.data.id);
      return response.data;
    } catch (error: any) {
      console.error('❌ ========================================');
      console.error('❌ ERRO AO CRIAR COBRANÇA NO ASAAS');
      console.error('❌ ========================================');
      console.error('❌ Tenant ID:', tenantId || 'padrão');
      console.error('❌ Status HTTP:', error.response?.status);
      console.error('❌ Dados enviados:', JSON.stringify(data, null, 2));
      console.error('❌ Resposta do Asaas:', JSON.stringify(error.response?.data, null, 2));
      console.error('❌ Headers da requisição:', {
        baseURL: this.api?.defaults.baseURL,
        access_token: this.apiKey ? `${this.apiKey.substring(0, 20)}...` : 'NÃO DEFINIDO'
      });
      console.error('❌ Mensagem:', error.message);
      
      const asaasError = error.response?.data?.errors?.[0];
      const errorMessage = asaasError?.description || error.response?.data?.message || error.message;
      
      throw new Error(`Erro ao criar cobrança: ${errorMessage}`);
    }
  }

  /**
   * Buscar cobrança no Asaas
   */
  async getPayment(paymentId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log(`📊 Buscando cobrança ${paymentId} no Asaas...`);
      
      const response = await this.api!.get(`/payments/${paymentId}`);
      
      console.log(`✅ Cobrança encontrada: Status = ${response.data.status}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar cobrança no Asaas:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Criar assinatura recorrente
   */
  async createSubscription(data: AsaasSubscription, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('🔄 Criando assinatura no Asaas:', data);
      
      const response = await this.api.post('/subscriptions', {
        customer: data.customer,
        billingType: data.billingType,
        value: data.value,
        nextDueDate: data.nextDueDate,
        cycle: data.cycle,
        description: data.description,
        externalReference: data.externalReference,
        // Configurações
        fine: {
          value: 2.00
        },
        interest: {
          value: 1.00
        }
      });

      console.log('✅ Assinatura criada:', response.data.id);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura:', error.response?.data || error.message);
      throw new Error(`Erro ao criar assinatura: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(subscriptionId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('❌ Cancelando assinatura:', subscriptionId);
      
      const response = await this.api!.delete(`/subscriptions/${subscriptionId}`);
      
      console.log('✅ Assinatura cancelada');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao cancelar assinatura:', error.message);
      throw new Error(`Erro ao cancelar assinatura: ${error.message}`);
    }
  }

  /**
   * Cancelar cobrança
   */
  async cancelPayment(paymentId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      console.log('🚫 Cancelando cobrança:', paymentId);
      
      const response = await this.api!.delete(`/payments/${paymentId}`);
      
      console.log('✅ Cobrança cancelada no Asaas');
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao cancelar cobrança no Asaas:', error.message);
      throw new Error(`Erro ao cancelar cobrança: ${error.message}`);
    }
  }

  /**
   * Buscar assinatura por ID
   */
  async getSubscription(subscriptionId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      const response = await this.api!.get(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar assinatura:', error.message);
      throw new Error(`Erro ao buscar assinatura: ${error.message}`);
    }
  }

  /**
   * Listar cobranças de um cliente
   */
  async listCustomerPayments(customerId: string, tenantId?: number): Promise<any> {
    try {
      await this.initializeApi(tenantId);
      
      const response = await this.api!.get('/payments', {
        params: {
          customer: customerId,
          limit: 100
        }
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar cobranças:', error.message);
      return [];
    }
  }

  /**
   * Verificar se API Key está configurada
   */
  async isConfigured(tenantId?: number): Promise<boolean> {
    const credential = await this.getAsaasCredential(tenantId);
    return !!credential;
  }

  /**
   * Obter ambiente atual
   */
  getEnvironment(): string {
    return this.environment;
  }
}

export default new AsaasService();

