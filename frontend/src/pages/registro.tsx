import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaWhatsapp, FaBuilding, FaEnvelope, FaPhone, FaIdCard, FaUser, FaLock, FaArrowRight, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import SystemLogo from '../components/SystemLogo';
import axios from 'axios';

interface Plan {
  id: number;
  nome: string;
  slug: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  ativo: boolean;
}

export default function Registro() {
  const { signUp, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Dados do Tenant (Empresa)
  const [tenantNome, setTenantNome] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantTelefone, setTenantTelefone] = useState('');
  const [tenantDocumento, setTenantDocumento] = useState('');
  
  // Dados do Usuário Admin
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Planos
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plano, setPlano] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  
  // Estado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 = Dados da Empresa, 2 = Dados do Admin

  // Carregar planos ao montar o componente
  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      console.log('🔍 Carregando planos de:', `${API_URL}/public/landing/plans`);
      
      const response = await axios.get(`${API_URL}/public/landing/plans`);
      console.log('📦 Resposta da API:', response.data);
      
      if (response.data.success) {
        // A API já filtra por ativo=true e visivel=true
        // Aqui apenas removemos explicitamente trial/teste se existir
        const activePlans = response.data.data.filter((plan: Plan) => 
          plan.slug !== 'trial' && plan.slug !== 'teste'
        );
        console.log('✅ Planos filtrados:', activePlans);
        setPlans(activePlans);
        
        // Definir primeiro plano como padrão
        if (activePlans.length > 0) {
          setPlano(activePlans[0].slug);
        } else {
          console.warn('⚠️ Nenhum plano encontrado após filtro');
        }
      } else {
        console.warn('⚠️ API retornou success=false');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar planos:', error);
      console.error('❌ Detalhes do erro:', error.response?.data || error.message);
      // Não mostrar erro, apenas deixar vazio
    } finally {
      setLoadingPlans(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Validações
    if (step === 1) {
      if (!tenantNome || !tenantEmail) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }
      setStep(2);
      return;
    }

    // Validações finais
    if (!adminNome || !adminEmail || !adminPassword) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (adminPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await signUp({
        tenantNome,
        tenantEmail,
        tenantTelefone,
        tenantDocumento,
        adminNome,
        adminEmail,
        adminPassword,
        plano
      });
      // Redirecionamento é feito automaticamente no AuthContext
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-white text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Criar Conta - Disparador NettSistemas</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full">
          
          {/* Logo do Sistema */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-8">
              <SystemLogo size="large" />
            </div>
            <h1 className="text-5xl font-black text-white mb-3">
              Criar Nova Conta
            </h1>
            <p className="text-xl text-gray-400 font-medium">
              Dados da sua empresa
            </p>
          </div>

          {/* Indicador de Etapas */}
          <div className="flex justify-center items-center gap-4 mb-8">
            <div className={`flex items-center gap-2 px-6 py-3 rounded-full ${step === 1 ? 'bg-emerald-500 text-white' : 'bg-dark-800/50 text-gray-400'} font-bold transition-all`}>
              <span className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 1 ? 'bg-white text-emerald-500' : 'bg-dark-700 text-gray-400'}`}>1</span>
              <span>Empresa</span>
            </div>
            <div className="w-12 h-1 bg-dark-700 rounded"></div>
            <div className={`flex items-center gap-2 px-6 py-3 rounded-full ${step === 2 ? 'bg-emerald-500 text-white' : 'bg-dark-800/50 text-gray-400'} font-bold transition-all`}>
              <span className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 2 ? 'bg-white text-emerald-500' : 'bg-dark-700 text-gray-400'}`}>2</span>
              <span>Admin</span>
            </div>
          </div>

          {/* Formulário de Registro */}
          <div className="bg-dark-800/50 backdrop-blur-xl border-2 border-white/10 rounded-3xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mensagem de Erro */}
              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-center font-bold">
                  {error}
                </div>
              )}

              {/* STEP 1: Dados da Empresa */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
                    <p className="text-emerald-300 text-sm font-bold text-center flex items-center justify-center gap-2">
                      <FaBuilding /> Informações da Empresa
                    </p>
                  </div>

                  {/* Nome da Empresa */}
                  <div>
                    <label htmlFor="tenantNome" className="block text-white font-bold mb-2 flex items-center gap-2">
                      <FaBuilding className="text-emerald-400" /> Nome da Empresa *
                    </label>
                    <input
                      id="tenantNome"
                      type="text"
                      required
                      value={tenantNome}
                      onChange={(e) => setTenantNome(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                      placeholder="Minha Empresa Ltda"
                    />
                  </div>

                  {/* Email da Empresa */}
                  <div>
                    <label htmlFor="tenantEmail" className="block text-white font-bold mb-2 flex items-center gap-2">
                      <FaEnvelope className="text-emerald-400" /> Email da Empresa *
                    </label>
                    <input
                      id="tenantEmail"
                      type="email"
                      required
                      value={tenantEmail}
                      onChange={(e) => setTenantEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                      placeholder="contato@empresa.com"
                    />
                  </div>

                  {/* Telefone e CPF/CNPJ em grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Telefone */}
                    <div>
                      <label htmlFor="tenantTelefone" className="block text-white font-bold mb-2 flex items-center gap-2">
                        <FaPhone className="text-emerald-400" /> Telefone
                      </label>
                      <input
                        id="tenantTelefone"
                        type="tel"
                        value={tenantTelefone}
                        onChange={(e) => setTenantTelefone(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                        placeholder="(11) 99999-9999"
                      />
                    </div>

                    {/* CPF/CNPJ */}
                    <div>
                      <label htmlFor="tenantDocumento" className="block text-white font-bold mb-2 flex items-center gap-2">
                        <FaIdCard className="text-emerald-400" /> CPF/CNPJ
                      </label>
                      <input
                        id="tenantDocumento"
                        type="text"
                        value={tenantDocumento}
                        onChange={(e) => setTenantDocumento(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-all"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>

                  {/* Plano */}
                  <div>
                    <label htmlFor="plano" className="block text-white font-bold mb-2 flex items-center gap-2">
                      <FaCheckCircle className="text-emerald-400" /> Plano *
                    </label>
                    
                    {loadingPlans ? (
                      <div className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white/60 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                        Carregando planos...
                      </div>
                    ) : plans.length === 0 ? (
                      <div className="space-y-3">
                        <div className="w-full px-4 py-3 bg-red-500/20 border-2 border-red-500/40 rounded-xl text-red-300 text-center">
                          <p className="font-bold mb-2">⚠️ Nenhum plano disponível no momento</p>
                          <p className="text-xs text-red-200">Entre em contato com o administrador do sistema.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Debug info */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="mb-2 text-xs text-white/50">
                            Debug: {plans.length} planos carregados
                          </div>
                        )}
                        
                        <select
                          id="plano"
                          value={plano}
                          onChange={(e) => setPlano(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white focus:border-emerald-500 focus:outline-none transition-all"
                        >
                          {plans.length === 0 && (
                            <option value="">Nenhum plano disponível</option>
                          )}
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.slug}>
                              {plan.nome} - R$ {plan.preco_mensal.toFixed(2)}/mês
                            </option>
                          ))}
                        </select>
                        
                        {/* Informações do Plano Selecionado */}
                        {plano && (
                          <>
                            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                              {(() => {
                                const selectedPlan = plans.find(p => p.slug === plano);
                                if (!selectedPlan) return null;
                                
                                return (
                                  <div className="text-emerald-200 text-sm space-y-2">
                                    <p className="font-bold text-emerald-300">📋 {selectedPlan.nome}</p>
                                    <p className="text-white/80">{selectedPlan.descricao}</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-emerald-500/30">
                                      <div>
                                        <p className="text-xs text-emerald-300/70">Mensal</p>
                                        <p className="text-lg font-black text-white">R$ {selectedPlan.preco_mensal.toFixed(2)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-emerald-300/70">Anual</p>
                                        <p className="text-lg font-black text-white">R$ {selectedPlan.preco_anual.toFixed(2)}</p>
                                        <p className="text-xs text-green-400">Economize 17%</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Aviso sobre período de teste e pagamento */}
                            <div className="mt-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/40 rounded-xl p-4">
                              <div className="flex items-start gap-3">
                                <span className="text-3xl">🎁</span>
                                <div className="text-green-200 text-sm space-y-2">
                                  <p className="font-bold text-green-300">✨ Teste Grátis Incluído - 3 Dias!</p>
                                  <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li><strong>Acesso completo:</strong> Teste todas as funcionalidades do plano escolhido</li>
                                    <li><strong>3 dias grátis:</strong> Experimente sem compromisso</li>
                                    <li><strong>Sem cartão de crédito:</strong> Não pedimos dados de pagamento para teste</li>
                                  </ul>
                                </div>
                              </div>
                            </div>

                            {/* Aviso sobre bloqueio e exclusão */}
                            <div className="mt-4 bg-red-500/10 border-2 border-red-500/40 rounded-xl p-4">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div className="text-red-200 text-sm space-y-2">
                                  <p className="font-bold text-red-300">Importante - Após o Período de Teste:</p>
                                  <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li><strong>No 4º dia (após teste):</strong> Conta será bloqueada automaticamente</li>
                                    <li><strong>Para desbloquear:</strong> Realize o pagamento do plano escolhido</li>
                                    <li><strong>Após 7 dias do bloqueio:</strong> Conta e dados serão excluídos permanentemente</li>
                                    <li><strong>Dados não recuperáveis:</strong> Faça backup antes do prazo</li>
                                  </ul>
                                  <p className="text-red-300 font-bold mt-2">
                                    💡 Não perca seus dados! Efetue o pagamento antes do 4º dia.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Botão Próximo */}
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg text-lg font-black text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
                  >
                    Próximo <FaArrowRight />
                  </button>
                </div>
              )}

              {/* STEP 2: Dados do Admin */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                    <p className="text-blue-300 text-sm font-bold text-center flex items-center justify-center gap-2">
                      <FaUser /> Dados do Administrador
                    </p>
                  </div>

                  {/* Nome do Admin */}
                  <div>
                    <label htmlFor="adminNome" className="block text-white font-bold mb-2 flex items-center gap-2">
                      <FaUser className="text-blue-400" /> Nome Completo *
                    </label>
                    <input
                      id="adminNome"
                      type="text"
                      required
                      value={adminNome}
                      onChange={(e) => setAdminNome(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-all"
                      placeholder="Seu Nome Completo"
                    />
                  </div>

                  {/* Email do Admin */}
                  <div>
                    <label htmlFor="adminEmail" className="block text-white font-bold mb-2 flex items-center gap-2">
                      <FaEnvelope className="text-blue-400" /> Email *
                    </label>
                    <input
                      id="adminEmail"
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-all"
                      placeholder="seu@email.com"
                    />
                  </div>

                  {/* Senha e Confirmar Senha em grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Senha */}
                    <div>
                      <label htmlFor="adminPassword" className="block text-white font-bold mb-2 flex items-center gap-2">
                        <FaLock className="text-blue-400" /> Senha *
                      </label>
                      <input
                        id="adminPassword"
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>

                    {/* Confirmar Senha */}
                    <div>
                      <label htmlFor="confirmPassword" className="block text-white font-bold mb-2 flex items-center gap-2">
                        <FaLock className="text-blue-400" /> Confirmar Senha *
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-900/50 border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* Botões Voltar e Criar Conta */}
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 flex justify-center items-center gap-2 py-4 px-4 border-2 border-gray-600 rounded-xl shadow-lg text-lg font-black text-gray-300 bg-transparent hover:bg-gray-800 transition-all"
                    >
                      <FaArrowLeft /> Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg text-lg font-black text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Criando...
                        </>
                      ) : (
                        <>
                          <FaCheckCircle /> Criar Conta
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Link para Login */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-gray-400 mb-4">
                Já tem uma conta?
              </p>
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-bold transition-all"
              >
                Fazer Login
              </Link>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Sistema de Disparo em Massa - <span className="text-emerald-400 font-semibold">NettSistemas</span> © 2024
          </p>
        </div>
      </div>
    </>
  );
}
