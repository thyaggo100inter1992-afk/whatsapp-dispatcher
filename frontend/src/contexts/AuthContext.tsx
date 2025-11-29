import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import logger from '@/services/logger';
import TrialExpiredModal from '@/components/TrialExpiredModal';

// Tipos
interface User {
  id: number;
  nome: string;
  email: string;
  role: string;
  emailVerificado: boolean;
  avatar?: string; // ADICIONADO: campo de avatar
  tenantId?: number; // ADICIONADO: ID do tenant para facilitar
}

interface Tenant {
  id: number;
  nome: string;
  slug: string;
  plano: string;
  status?: string;
  email?: string;
  telefone?: string;
  documento?: string;
  days_until_deletion?: number;
}

interface AuthContextData {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => void;
  updateUser: (userData: Partial<User>) => void;
  updateTenant: (tenantData: Partial<Tenant>) => void;
  isAuthenticated: boolean;
}

interface SignUpData {
  tenantNome: string;
  tenantEmail: string;
  tenantTelefone?: string;
  tenantDocumento?: string;
  adminNome: string;
  adminEmail: string;
  adminPassword: string;
  plano?: string;
}

// Contexto
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Provider
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialMessage, setTrialMessage] = useState('');
  const [daysUntilDeletion, setDaysUntilDeletion] = useState<number | undefined>(undefined);
  const router = useRouter();

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  // Carregar dados do localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('@WhatsAppDispatcher:token');
    const storedUser = localStorage.getItem('@WhatsAppDispatcher:user');
    const storedTenant = localStorage.getItem('@WhatsAppDispatcher:tenant');

    if (storedToken && storedUser && storedTenant) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setTenant(JSON.parse(storedTenant));
      
      // Configurar axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }

    setLoading(false);
  }, []);

  // Login
  async function signIn(email: string, password: string) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { user: userData, tenant: tenantData, tokens, requires_payment, payment_message } = response.data.data;

      // Adicionar tenantId ao userData
      const userWithTenantId = {
        ...userData,
        tenantId: tenantData.id
      };

      // Salvar no estado
      setUser(userWithTenantId);
      setTenant(tenantData);
      setToken(tokens.accessToken);

      // Salvar no localStorage
      localStorage.setItem('@WhatsAppDispatcher:token', tokens.accessToken);
      localStorage.setItem('@WhatsAppDispatcher:refreshToken', tokens.refreshToken);
      localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify(userWithTenantId));
      localStorage.setItem('@WhatsAppDispatcher:tenant', JSON.stringify(tenantData));

      // Configurar axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Log de sucesso
      logger.logLogin(email, true);

      // Verificar se precisa fazer pagamento (trial expirado ou conta bloqueada)
      if (requires_payment && userData.role !== 'super_admin') {
        console.log('⚠️ Período de teste expirou. Redirecionando para escolha de plano...');
        console.log(`📢 ${payment_message}`);
        
        // Mostrar modal bonito se disponível
        if (payment_message) {
          setTrialMessage(payment_message);
          setDaysUntilDeletion(tenantData.days_until_deletion);
          setShowTrialModal(true);
        }
        
        // Redirecionar para escolher plano
        router.push('/gestao');
        return;
      }

      // Redirecionar baseado no role do usuário
      // Verificar se é usuário master (formato: {ID}@NETTSISTEMAS.COM.BR)
      const isMasterUser = userData.email && /@NETTSISTEMAS\.COM\.BR$/i.test(userData.email);
      
      if (userData.role === 'super_admin' && !isMasterUser) {
        // Super Admin REAL vai direto para a gestão de tenants
        router.push('/admin/tenants');
      } else {
        // Outros usuários (incluindo masters) vão para página de escolha de conexão
        router.push('/');
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      // Log de falha
      logger.logLogin(email, false);
      logger.logError(error, 'Login falhou');
      
      throw new Error(
        error.response?.data?.message || 'Erro ao fazer login. Verifique suas credenciais.'
      );
    }
  }

  // Registro
  async function signUp(data: SignUpData) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, data);

      const { user: userData, tenant: tenantData, tokens } = response.data.data;

      // Adicionar tenantId ao userData
      const userWithTenantId = {
        ...userData,
        tenantId: tenantData.id
      };

      // Salvar no estado
      setUser(userWithTenantId);
      setTenant(tenantData);
      setToken(tokens.accessToken);

      // Salvar no localStorage
      localStorage.setItem('@WhatsAppDispatcher:token', tokens.accessToken);
      localStorage.setItem('@WhatsAppDispatcher:refreshToken', tokens.refreshToken);
      localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify(userWithTenantId));
      localStorage.setItem('@WhatsAppDispatcher:tenant', JSON.stringify(tenantData));

      // Configurar axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Redirecionar para página de escolha do WhatsApp (index)
      router.push('/');
    } catch (error: any) {
      console.error('Erro no registro:', error);
      throw new Error(
        error.response?.data?.message || 'Erro ao criar conta. Tente novamente.'
      );
    }
  }

  // Logout
  function signOut() {
    // Log de logout
    logger.logLogout();
    
    // Chamar API de logout
    if (token) {
      axios.post(`${API_URL}/auth/logout`).catch(console.error);
    }

    // Limpar estado
    setUser(null);
    setTenant(null);
    setToken(null);

    // Limpar localStorage
    localStorage.removeItem('@WhatsAppDispatcher:token');
    localStorage.removeItem('@WhatsAppDispatcher:refreshToken');
    localStorage.removeItem('@WhatsAppDispatcher:user');
    localStorage.removeItem('@WhatsAppDispatcher:tenant');

    // Remover header do axios
    delete axios.defaults.headers.common['Authorization'];

    // Redirecionar para login
    router.push('/login');
  }

  // Atualizar dados do usuário
  function updateUser(userData: Partial<User>) {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('@WhatsAppDispatcher:user', JSON.stringify(updatedUser));
    }
  }

  // Atualizar dados do tenant
  function updateTenant(tenantData: Partial<Tenant>) {
    if (tenant) {
      const updatedTenant = { ...tenant, ...tenantData };
      setTenant(updatedTenant);
      localStorage.setItem('@WhatsAppDispatcher:tenant', JSON.stringify(updatedTenant));
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        loading,
        signIn,
        signUp,
        signOut,
        updateUser,
        updateTenant,
        isAuthenticated: !!user,
      }}
    >
      {children}
      
      {/* Modal bonito de Trial Expirado */}
      {showTrialModal && (
        <TrialExpiredModal
          message={trialMessage}
          daysUntilDeletion={daysUntilDeletion}
          onClose={() => setShowTrialModal(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}



