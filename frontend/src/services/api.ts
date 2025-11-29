import axios, { AxiosRequestConfig } from 'axios';
import logger from './logger';

// Estender o tipo AxiosRequestConfig para incluir metadata
declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      startTime?: number;
    };
  }
}

// API_URL já deve incluir /api no .env.local
// Exemplo: NEXT_PUBLIC_API_URL=http://localhost:3001/api
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  // ⚠️ NÃO definir Content-Type aqui!
  // O Axios define automaticamente:
  // - 'application/json' para objetos
  // - 'multipart/form-data' (com boundary) para FormData
});

// ✅ INTERCEPTOR: Adicionar token JWT em todas as requisições
api.interceptors.request.use(
  (config) => {
    // Buscar token do localStorage (mesmo nome usado pelo AuthContext)
    const token = localStorage.getItem('@WhatsAppDispatcher:token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ⚠️ IMPORTANTE: Definir Content-Type apenas se não for FormData
    // FormData precisa que o navegador defina o boundary automaticamente
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    // Se for FormData, NÃO definir Content-Type (Axios define automaticamente com boundary)
    
    // Salvar timestamp para calcular duração da requisição
    config.metadata = { startTime: new Date().getTime() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ INTERCEPTOR: Tratar 401 (token expirado) e logar requisições
api.interceptors.response.use(
  (response) => {
    // Logar requisição bem-sucedida (exceto logs para evitar loop infinito)
    if (!response.config.url?.includes('/logs/activity')) {
      const duration = response.config.metadata?.startTime 
        ? new Date().getTime() - response.config.metadata.startTime 
        : 0;
      
      logger.logApiRequest(
        response.config.method?.toUpperCase() || 'GET',
        response.config.url || '',
        response.status,
        { duration, data: response.data }
      );
    }
    
    return response;
  },
  (error) => {
    // Logar requisição com erro (exceto logs para evitar loop infinito)
    if (!error.config?.url?.includes('/logs/activity')) {
      logger.logApiRequest(
        error.config?.method?.toUpperCase() || 'GET',
        error.config?.url || '',
        error.response?.status || 0,
        { error: error.message }
      );
      
      logger.logError(error, `API ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    }
    
    if (error.response?.status === 401) {
      // Extrair informações do erro
      const errorCode = error.response?.data?.code;
      const forceLogout = error.response?.data?.forceLogout;
      const message = error.response?.data?.message;
      
      // Não mostrar alerts - as mensagens serão exibidas na página de login
      // baseadas no reason query parameter
      
      // Token inválido ou expirado - limpar storage e redirecionar para login
      localStorage.removeItem('@WhatsAppDispatcher:token');
      localStorage.removeItem('@WhatsAppDispatcher:refreshToken');
      localStorage.removeItem('@WhatsAppDispatcher:user');
      localStorage.removeItem('@WhatsAppDispatcher:tenant');
      localStorage.removeItem('lastActivity'); // Limpar também o timer de inatividade
      
      // Redirecionar para login (apenas se não estiver já lá)
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        const reason = errorCode === 'SESSION_INVALID' ? 'session_invalid' : 
                       errorCode === 'TENANT_INACTIVE' ? 'tenant_blocked' : 
                       errorCode === 'TOKEN_EXPIRED' ? 'token_expired' : 
                       'unauthorized';
        window.location.href = `/login?reason=${reason}`;
      }
    }
    
    return Promise.reject(error);
  }
);

// WhatsApp Accounts
export const whatsappAccountsAPI = {
  getAll: () => api.get('/whatsapp-accounts'),
  getActive: () => api.get('/whatsapp-accounts/active'),
  getById: (id: number) => api.get(`/whatsapp-accounts/${id}`),
  create: (data: any) => api.post('/whatsapp-accounts', data),
  update: (id: number, data: any) => api.put(`/whatsapp-accounts/${id}`, data),
  delete: (id: number) => api.delete(`/whatsapp-accounts/${id}`),
  toggleActive: (id: number) => api.patch(`/whatsapp-accounts/${id}/toggle`),
  testConnection: (data: any) => api.post('/whatsapp-accounts/test-connection', data),
  getTemplates: (id: number) => api.get(`/whatsapp-accounts/${id}/templates`),
};

// Campaigns
export const campaignsAPI = {
  getAll: () => api.get('/campaigns'),
  getById: (id: number) => api.get(`/campaigns/${id}`),
  create: (data: any) => api.post('/campaigns', data),
  updateStatus: (id: number, status: string) => api.patch(`/campaigns/${id}/status`, { status }),
  edit: (id: number, data: any) => api.put(`/campaigns/${id}`, data),
  pause: (id: number) => api.post(`/campaigns/${id}/pause`),
  resume: (id: number) => api.post(`/campaigns/${id}/resume`),
  cancel: (id: number) => api.post(`/campaigns/${id}/cancel`),
  delete: (id: number) => api.delete(`/campaigns/${id}`),
  deleteAllFinished: () => api.delete('/campaigns-finished/all'),
  downloadReport: (id: number) => api.get(`/campaigns/${id}/report`, { responseType: 'blob' }),
  getMessages: (id: number, params?: any) => api.get(`/campaigns/${id}/messages`, { params }),
  getStats: (id: number) => api.get(`/campaigns/${id}/stats`),
};

// Messages
export const messagesAPI = {
  sendImmediate: (data: any) => api.post('/messages/send-immediate', data),
  getAll: (params?: any) => api.get('/messages', { params }),
  getById: (id: number) => api.get(`/messages/${id}`),
  getQueueStats: () => api.get('/messages/queue/stats'),
};

// QR Campaigns (WhatsApp QR Connect Campaigns)
export const qrCampaignsAPI = {
  getAll: () => api.get('/qr-campaigns'),
  getById: (id: number) => api.get(`/qr-campaigns/${id}`),
  create: (data: any) => api.post('/qr-campaigns', data),
  edit: (id: number, data: any) => api.put(`/qr-campaigns/${id}/edit`, data),
  pause: (id: number) => api.post(`/qr-campaigns/${id}/pause`),
  resume: (id: number) => api.post(`/qr-campaigns/${id}/resume`),
  cancel: (id: number) => api.post(`/qr-campaigns/${id}/cancel`),
  delete: (id: number) => api.delete(`/qr-campaigns/${id}`),
  deleteAllFinished: () => api.delete('/qr-campaigns/finished/delete-all'),
  getMessages: (id: number, params?: any) => api.get(`/qr-campaigns/${id}/messages`, { params }),
  getContacts: (id: number) => api.get(`/qr-campaigns/${id}/contacts`),
  getStats: (id: number) => api.get(`/qr-campaigns/${id}/stats`),
  getActivityLog: (id: number) => api.get(`/qr-campaigns/${id}/activity-log`),
  getButtonsStats: (id: number) => api.get(`/qr-campaigns/${id}/buttons-stats`),
  getAccountsStatus: (id: number) => api.get(`/qr-campaigns/${id}/accounts-status`),
  removeAccount: (id: number, accountId: number) => api.post(`/qr-campaigns/${id}/remove-account`, { accountId }),
  addAccount: (id: number, accountId: number) => api.post(`/qr-campaigns/${id}/add-account`, { accountId }),
  updateAutoRemoveConfig: (id: number, auto_remove_account_failures: number) => api.post(`/qr-campaigns/${id}/update-auto-remove-config`, { auto_remove_account_failures }),
  downloadReport: (id: number) => api.get(`/qr-campaigns/${id}/download-report`, { responseType: 'blob' }),
};

// Upload
export const uploadAPI = {
  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // ⚠️ NÃO definir Content-Type manualmente para FormData!
    // O Axios define automaticamente com o boundary correto
    return api.post('/upload/media', formData);
  },
};

export default api;

