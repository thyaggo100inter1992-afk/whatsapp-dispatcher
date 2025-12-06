import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaCrown, FaCheck, FaSpinner, FaArrowUp, FaArrowDown, FaEquals } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import PaymentSuccessToast from '@/components/PaymentSuccessToast';

interface Plan {
  id: number;
  nome: string;
  slug: string;
  preco_mensal: number;
  preco_anual: number;
  limite_usuarios: number;
  limite_contas_whatsapp: number;
  limite_campanhas_mes: number;
  limite_mensagens_dia: number;
  limite_contatos_total: number;
  limite_templates: number;
  limite_storage_mb: number;
  recursos: any;
  status: string;
}

interface UpgradeCalculation {
  is_upgrade: boolean;
  is_first_purchase?: boolean;
  plano_atual: {
    id: number;
    nome: string;
    preco_mensal: number;
  };
  plano_novo: {
    id: number;
    nome: string;
    preco_mensal: number;
  };
  dias_restantes: number;
  proximo_vencimento: string;
  valor_proporcional: number;
  mensagem: string;
}

export default function MudarPlano() {
  const router = useRouter();
  const { user, tenant } = useAuth();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [calculations, setCalculations] = useState<Map<number, UpgradeCalculation>>(new Map());
  const [loadingCalculations, setLoadingCalculations] = useState<Set<number>>(new Set());
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successPlanName, setSuccessPlanName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      alert('❌ Acesso negado! Apenas administradores podem mudar de plano.');
      router.push('/');
      return;
    }
    loadPlans();
  }, [user, router]);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      console.log('🔄 Carregando planos...');
      const response = await api.get('/payments/plans');
      
      console.log('📦 Resposta da API:', response.data);
      console.log('📋 Total de planos recebidos:', response.data.plans?.length);
      
      // Mostrar todos os planos antes do filtro
      response.data.plans?.forEach((p: Plan) => {
        console.log(`📌 Plano: ${p.nome} | Status: ${p.status} | Preço: R$ ${p.preco_mensal}`);
      });
      
      // Filtrar planos: apenas planos ativos e com valor > 0
      const filteredPlans = response.data.plans.filter((p: Plan) => 
        p.status === 'active' && 
        p.preco_mensal > 0
      );
      
      console.log('✅ Planos filtrados:', filteredPlans.length);
      console.log('📊 Planos que vão aparecer:', filteredPlans);
      setPlans(filteredPlans);
      
      // Buscar plano atual do tenant (por ID ou slug)
      let currentPlan = (tenant as any)?.plan_id || null;
      
      // Se não tem plan_id, buscar pelo slug
      if (!currentPlan && tenant?.plano) {
        const planBySlug = filteredPlans.find((p: Plan) => p.slug === tenant.plano);
        if (planBySlug) {
          currentPlan = planBySlug.id;
          console.log(`🔍 Plano encontrado pelo slug '${tenant.plano}': ID ${currentPlan} (${planBySlug.nome})`);
        }
      }
      
      console.log('🎯 Plano atual do tenant:', currentPlan);
      console.log('📋 Tenant completo:', tenant);
      setCurrentPlanId(currentPlan);

      // Calcular valores apenas para planos diferentes do atual
      const newCalculations = new Map();
      for (const plan of filteredPlans) {
        if (plan.id !== currentPlan) {
          try {
            const calcResponse = await api.get(`/payments/calculate-upgrade?new_plan_id=${plan.id}`);
            newCalculations.set(plan.id, calcResponse.data.data);
            console.log(`💰 Cálculo para ${plan.nome}:`, calcResponse.data.data);
          } catch (error) {
            console.error(`❌ Erro ao calcular para plano ${plan.id}:`, error);
          }
        } else {
          console.log(`✅ ${plan.nome} é o plano atual - não calculando`);
        }
      }
      setCalculations(newCalculations);
      console.log('✅ Carregamento completo!');

    } catch (error: any) {
      console.error('❌ Erro ao carregar planos:', error);
      alert('Erro ao carregar planos: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleChangePlan = async (plan: Plan, calculation: UpgradeCalculation) => {
    if (!calculation) return;

    // Se é primeira compra ou upgrade, mostrar modal de pagamento
    if (calculation.is_upgrade || calculation.is_first_purchase) {
      setSelectedPlanId(plan.id);
      setShowPaymentModal(true);
    } else {
      // DOWNGRADE: Confirmar e agendar
      if (confirm(`${calculation.mensagem}\n\nDeseja confirmar?`)) {
        try {
          setProcessing(true);
          await api.post('/payments/downgrade', { new_plan_id: plan.id });
          alert(`✅ Downgrade agendado com sucesso! Você mudará para o plano ${plan.nome} no próximo vencimento.`);
          router.push('/gestao');
        } catch (error: any) {
          console.error('Erro ao agendar downgrade:', error);
          
          // Mostrar mensagem detalhada de validação se disponível
          if (error.response?.data?.details) {
            const details = error.response.data.details;
            let message = `❌ ${error.response.data.message}\n\n`;
            message += `${details.message}\n`;
            if (details.errors && details.errors.length > 0) {
              details.errors.forEach((err: string) => {
                message += `• ${err}\n`;
              });
            }
            message += `\n${details.action}`;
            alert(message);
          } else {
            alert('❌ Erro ao agendar downgrade: ' + (error.response?.data?.message || error.message));
          }
        } finally {
          setProcessing(false);
        }
      }
    }
  };

  const handleProcessUpgrade = async (billingType: 'PIX' | 'BOLETO') => {
    if (!selectedPlanId) return;

    try {
      setProcessing(true);
      const response = await api.post('/payments/upgrade', {
        new_plan_id: selectedPlanId,
        billing_type: billingType
      });
      
      setPaymentData(response.data.payment);
      
      // Buscar nome do plano selecionado
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        setSuccessPlanName(selectedPlan.nome);
        setShowSuccessToast(true);
      }
      
    } catch (error: any) {
      console.error('Erro ao processar upgrade:', error);
      
      // Mostrar mensagem detalhada de validação se disponível
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        let message = `❌ ${error.response.data.message}\n\n`;
        message += `${details.message}\n`;
        if (details.errors && details.errors.length > 0) {
          details.errors.forEach((err: string) => {
            message += `• ${err}\n`;
          });
        }
        message += `\n${details.action}`;
        alert(message);
        setShowPaymentModal(false); // Fechar modal se houver erro de validação
      } else {
        alert('❌ Erro ao processar upgrade: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loadingPlans) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1f35] via-[#0f1419] to-black flex items-center justify-center">
        <FaSpinner className="animate-spin text-6xl text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1f35] via-[#0f1419] to-black">
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-12">
        {/* Título e Botão Voltar */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white hover:text-emerald-400 transition font-bold"
          >
            <FaArrowLeft /> Voltar
          </button>
          <h1 className="text-4xl font-black text-white flex items-center gap-3">
            <FaCrown className="text-yellow-400" />
            Mudar de Plano
          </h1>
          <div className="w-24"></div>
        </div>
        {/* Debug Info */}
        {plans.length === 0 && (
          <div className="mb-8 p-6 bg-red-900/30 border-2 border-red-500/50 rounded-2xl text-center">
            <p className="text-red-300 font-bold text-lg mb-2">
              ⚠️ Nenhum plano disponível
            </p>
            <p className="text-gray-400 text-sm">
              Verifique o console do navegador (F12) para mais detalhes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const calculation = calculations.get(plan.id);
            const isUpgrade = calculation?.is_upgrade;
            const isDowngrade = calculation && !calculation.is_upgrade;

            return (
              <div
                key={plan.id}
                className={`relative bg-gradient-to-br backdrop-blur-xl border-2 rounded-3xl p-8 transition-all ${
                  isCurrentPlan
                    ? 'from-emerald-900/50 to-emerald-800/30 border-emerald-500/50 shadow-2xl shadow-emerald-500/30'
                    : 'from-dark-800/50 to-dark-900/30 border-white/10 hover:border-white/30'
                }`}
              >
                {/* Badge Plano Atual */}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <span className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2">
                      <FaCheck /> Plano Atual
                    </span>
                  </div>
                )}

                {/* Badge Upgrade/Downgrade */}
                {!isCurrentPlan && calculation && (
                  <div className="absolute top-4 right-4">
                    {isUpgrade ? (
                      <span className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl text-sm flex items-center gap-2">
                        <FaArrowUp /> Upgrade
                      </span>
                    ) : (
                      <span className="px-4 py-2 bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center gap-2">
                        <FaArrowDown /> Downgrade
                      </span>
                    )}
                  </div>
                )}

                {/* Nome do Plano */}
                <h2 className="text-3xl font-black text-white mb-2">{plan.nome}</h2>
                
                {/* Preço */}
                <div className="mb-6">
                  <p className="text-4xl font-black text-emerald-400">
                    {formatCurrency(plan.preco_mensal)}
                  </p>
                  <p className="text-sm text-gray-400">/mês</p>
                </div>

                {/* Valor Proporcional (se upgrade) */}
                {!isCurrentPlan && calculation && isUpgrade && (
                  <div className="mb-6 p-4 bg-purple-500/20 border-2 border-purple-500/50 rounded-xl">
                    <p className="text-sm text-purple-300 font-bold mb-1">VALOR PROPORCIONAL</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(calculation.valor_proporcional)}</p>
                    <p className="text-xs text-gray-400 mt-2">{calculation.mensagem}</p>
                  </div>
                )}

                {/* Mensagem de Downgrade */}
                {!isCurrentPlan && calculation && isDowngrade && (
                  <div className="mb-6 p-4 bg-orange-500/20 border-2 border-orange-500/50 rounded-xl">
                    <p className="text-sm text-gray-300">{calculation.mensagem}</p>
                  </div>
                )}

                {/* Recursos */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-gray-300">
                    <FaCheck className="text-emerald-400" />
                    <span>{plan.limite_usuarios} usuários</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <FaCheck className="text-emerald-400" />
                    <span>{plan.limite_contas_whatsapp} contas WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <FaCheck className="text-emerald-400" />
                    <span>{plan.limite_campanhas_mes} campanhas/mês</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <FaCheck className="text-emerald-400" />
                    <span>{plan.limite_mensagens_dia} mensagens/dia</span>
                  </div>
                </div>

                {/* Botão */}
                {!isCurrentPlan && calculation && (
                  <button
                    onClick={() => handleChangePlan(plan, calculation)}
                    disabled={processing}
                    className={`w-full py-4 font-black rounded-xl transition-all ${
                      isUpgrade
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-lg shadow-orange-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {processing ? (
                      <FaSpinner className="animate-spin inline mr-2" />
                    ) : isUpgrade ? (
                      'Fazer Upgrade'
                    ) : (
                      'Agendar Downgrade'
                    )}
                  </button>
                )}

                {isCurrentPlan && (
                  <div className="w-full py-4 text-center font-bold text-emerald-400 bg-emerald-500/10 rounded-xl border-2 border-emerald-500/30">
                    Seu plano atual
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Pagamento (Upgrade) */}
      {showPaymentModal && selectedPlanId && !paymentData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-white/20 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-6">Pagamento via PIX</h2>
            <p className="text-gray-300 mb-6">
              Após o pagamento via PIX, seu plano será ativado IMEDIATAMENTE.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => handleProcessUpgrade('PIX')}
                disabled={processing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {processing ? <FaSpinner className="animate-spin inline mr-2" /> : null}
                Pagar com PIX
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPlanId(null);
                }}
                className="w-full py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dados de Pagamento */}
      {paymentData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-emerald-500/50 rounded-3xl p-8 max-w-2xl w-full">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-2">
              <FaCheck className="text-emerald-400" />
              Cobrança Gerada!
            </h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-gray-400 mb-2">Valor:</p>
                <p className="text-3xl font-black text-white">{formatCurrency(paymentData.valor)}</p>
              </div>

              {/* PIX QR Code */}
              {paymentData.payment_type === 'PIX' && paymentData.pix_qr_code && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
                    <img 
                      src={paymentData.pix_qr_code} 
                      alt="QR Code PIX" 
                      className="w-48 h-48"
                    />
                  </div>
                </div>
              )}

              {/* PIX Copia e Cola */}
              {paymentData.payment_type === 'PIX' && paymentData.pix_copy_paste && (
                <div>
                  <p className="text-gray-400 mb-2">PIX Copia e Cola:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={paymentData.pix_copy_paste}
                      readOnly
                      className="flex-1 bg-dark-600 border border-white/10 rounded-xl px-4 py-3 text-white"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentData.pix_copy_paste);
                        alert('✅ Código PIX copiado!');
                      }}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              {/* Boleto */}
              {paymentData.bank_slip_url && (
                <a
                  href={paymentData.bank_slip_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
                >
                  Ver Boleto
                </a>
              )}

              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={() => router.push('/gestao')}
                  className="w-full py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition"
                >
                  Voltar para Gestão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Sucesso */}
      {showSuccessToast && (
        <PaymentSuccessToast
          planName={successPlanName}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}

