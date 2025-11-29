import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaCrown, FaCheck, FaSpinner } from 'react-icons/fa';
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

export default function EscolherPlano() {
  const router = useRouter();
  const { user, tenant } = useAuth();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [documento, setDocumento] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successPlanName, setSuccessPlanName] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    loadPlans();
  }, [user, router]);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await api.get('/payments/plans');
      
      // Filtrar planos: apenas planos ativos e com valor > 0
      const filteredPlans = response.data.plans.filter((p: Plan) => 
        p.status === 'active' && 
        p.preco_mensal > 0
      );
      
      console.log('📊 Planos carregados:', filteredPlans);
      setPlans(filteredPlans);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      alert('Erro ao carregar planos: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (billingType: 'PIX' | 'BOLETO') => {
    if (!selectedPlanId) return;

    // Validar documento
    if (!documento || documento.trim().length < 11) {
      alert('❌ Por favor, informe um CPF ou CNPJ válido');
      return;
    }

    try {
      setProcessing(true);
      
      // Buscar plano selecionado
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      
      if (!selectedPlan) {
        alert('❌ Plano não encontrado');
        return;
      }
      
      const response = await api.post('/payments/create', {
        plan_slug: selectedPlan.slug,  // ✅ Enviando slug em vez de ID
        billing_type: billingType,
        documento: documento.replace(/\D/g, '')  // Remove formatação
      });
      
      setPaymentData(response.data.payment);
      
      // Mostrar toast de sucesso
      setSuccessPlanName(selectedPlan.nome);
      setShowSuccessToast(true);
      
    } catch (error: any) {
      console.error('Erro ao gerar cobrança:', error);
      
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
        alert('❌ Erro ao gerar cobrança: ' + (error.response?.data?.message || error.message));
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
      {/* Plans Grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-8 py-12">
        {/* Título */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white mb-4 flex items-center justify-center gap-3">
            <FaCrown className="text-yellow-400" />
            Escolha Seu Plano
          </h1>
          <p className="text-xl text-gray-300">
            Selecione o plano ideal para seu negócio e comece agora mesmo!
          </p>
        </div>

        {/* Alerta de Trial Expirado */}
        {tenant?.status === 'blocked' && (
          <div className="mb-8 p-6 bg-red-900/30 border-2 border-red-500/50 rounded-2xl text-center">
            <p className="text-red-300 font-bold text-lg">
              ⚠️ Seu período de teste expirou. Escolha um plano para continuar usando o sistema.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="relative bg-gradient-to-br from-dark-800/50 to-dark-900/30 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-500/50 rounded-3xl p-8 transition-all hover:shadow-2xl hover:shadow-emerald-500/20"
            >
              {/* Nome do Plano */}
              <h2 className="text-3xl font-black text-white mb-2">{plan.nome}</h2>
              
              {/* Preço */}
              <div className="mb-6">
                <p className="text-5xl font-black text-emerald-400">
                  {formatCurrency(plan.preco_mensal)}
                </p>
                <p className="text-sm text-gray-400">/mês</p>
              </div>

              {/* Recursos */}
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_usuarios}</strong> usuários</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_contas_whatsapp}</strong> contas WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_campanhas_mes}</strong> campanhas/mês</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_mensagens_dia}</strong> mensagens/dia</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_contatos_total}</strong> contatos</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_templates}</strong> templates</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FaCheck className="text-emerald-400" />
                  <span><strong>{plan.limite_storage_mb}MB</strong> armazenamento</span>
                </div>
              </div>

              {/* Botão */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={processing}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <FaSpinner className="animate-spin inline mr-2" />
                ) : (
                  'Escolher Este Plano'
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedPlanId && !paymentData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border-2 border-white/20 rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-6">Pagamento via PIX</h2>
            <p className="text-gray-300 mb-6">
              Após o pagamento via PIX, sua conta será ativada imediatamente e você terá acesso por 30 dias.
            </p>
            
            {/* Campo de CPF/CNPJ */}
            <div className="mb-6">
              <label className="block text-white font-bold mb-2">
                CPF ou CNPJ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="w-full px-4 py-3 bg-dark-700 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                maxLength={18}
              />
              <p className="text-gray-400 text-sm mt-1">
                Necessário para emitir a cobrança
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => handleProcessPayment('PIX')}
                disabled={processing || !documento}
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

              {/* PIX */}
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
                  {paymentData.pix_qr_code && (
                    <div className="mt-4">
                      <p className="text-gray-400 mb-2">QR Code PIX:</p>
                      <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                        <img 
                          src={(() => {
                            const qr = paymentData.pix_qr_code;
                            // Se for URL HTTP, retorna direto
                            if (qr.startsWith('http')) return qr;
                            // Remove duplicação do prefixo data:image se existir
                            let cleanQr = qr;
                            const duplicatedPrefix = 'data:image/png;base64,data:image/png;base64,';
                            if (cleanQr.startsWith(duplicatedPrefix)) {
                              cleanQr = cleanQr.replace(duplicatedPrefix, 'data:image/png;base64,');
                            }
                            // Adiciona o prefixo apenas se não existir
                            return cleanQr.startsWith('data:') ? cleanQr : `data:image/png;base64,${cleanQr}`;
                          })()}
                          alt="QR Code PIX" 
                          className="w-64 h-64"
                        />
                      </div>
                      <p className="text-gray-400 text-sm mt-2 text-center">
                        Escaneie com seu app de pagamentos
                      </p>
                    </div>
                  )}
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
                <p className="text-sm text-gray-400 mb-4">
                  💡 Após o pagamento, sua conta será ativada automaticamente. Você pode acompanhar o status do pagamento na página de Gestão.
                </p>
                <button
                  onClick={() => router.push('/gestao')}
                  className="w-full py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition"
                >
                  Ir para Gestão
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

