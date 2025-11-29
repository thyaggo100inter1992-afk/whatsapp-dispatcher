/**
 * Página de Checkout
 * Escolher forma de pagamento e finalizar compra
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft } from 'react-icons/fa';
import paymentService, { Plan, CreatePaymentResponse } from '../services/payment.service';

export default function CheckoutPage() {
  const router = useRouter();
  const { plan: planSlug, cycle } = router.query;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>((cycle as 'mensal' | 'anual') || 'mensal');
  const [billingType, setBillingType] = useState<'BOLETO' | 'PIX'>('PIX');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);

  useEffect(() => {
    if (planSlug) {
      loadPlan();
    }
  }, [planSlug]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const plans = await paymentService.listPlans();
      const selectedPlan = plans.find(p => p.slug === planSlug);
      
      if (!selectedPlan) {
        alert('Plano não encontrado');
        router.push('/planos');
        return;
      }

      setPlan(selectedPlan);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao carregar plano');
      router.push('/planos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!plan) return;

    try {
      setProcessing(true);
      const response = await paymentService.createPayment({
        plan_slug: plan.slug,
        billing_type: billingType
      });

      setPayment(response);
      alert('Cobrança criada com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar cobrança');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Código copiado!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  // Se já criou o pagamento, mostrar tela de pagamento
  if (payment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Botão Voltar */}
          <button
            onClick={() => router.push('/planos')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
          >
            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            <span>Voltar para Planos</span>
          </button>

          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Cobrança Criada!
                </h1>
                <p className="text-gray-400">
                  Plano {payment.plan.nome} - R$ {payment.plan.preco}
                </p>
              </div>

              {/* Boleto */}
              {billingType === 'BOLETO' && payment.payment.bank_slip_url && (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-4">
                      Pague o boleto até {new Date(payment.payment.due_date!).toLocaleDateString('pt-BR')}
                    </p>
                    <a
                      href={payment.payment.bank_slip_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      📄 Visualizar Boleto
                    </a>
                  </div>

                  <div className="text-center text-sm text-gray-500">
                    <p>Após o pagamento, seu acesso será liberado automaticamente</p>
                    <p>Tempo de confirmação: até 2 dias úteis</p>
                  </div>
                </div>
              )}

              {/* PIX */}
              {billingType === 'PIX' && (
                <div className="space-y-6">
                  {/* QR Code */}
                  {payment.payment.pix_qr_code && (
                    <div className="bg-white rounded-lg p-6 text-center">
                      <p className="text-gray-800 font-semibold mb-4">
                        Escaneie o QR Code
                      </p>
                      <img
                        src={payment.payment.pix_qr_code}
                        alt="QR Code PIX"
                        className="mx-auto max-w-xs"
                      />
                    </div>
                  )}

                  {/* Código Copia e Cola */}
                  {payment.payment.pix_copy_paste && (
                    <div className="bg-gray-900 rounded-lg p-6">
                      <p className="text-gray-400 text-sm mb-3 text-center">
                        Ou copie o código PIX:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={payment.payment.pix_copy_paste}
                          readOnly
                          className="flex-1 bg-gray-800 text-white px-4 py-2 rounded text-sm font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(payment.payment.pix_copy_paste!)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition-all"
                        >
                          📋 Copiar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-sm text-gray-400">
                    <p className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Aguardando pagamento...
                    </p>
                    <p className="mt-2">Após confirmar o pagamento, seu acesso será liberado <strong>imediatamente</strong></p>
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => router.push('/gestao')}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Voltar ao Sistema
                </button>
                <button
                  onClick={() => setPayment(null)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Gerar Nova Cobrança
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de seleção de forma de pagamento
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Botão Voltar */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
        >
          <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
          <span>Voltar</span>
        </button>

        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Finalizar Pagamento
              </h1>
              <p className="text-gray-400">
                Você está assinando o plano <strong className="text-white">{plan.nome}</strong>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Resumo do Plano */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">
                  📋 Resumo do Pedido
                </h3>
                <div className="bg-gray-900 rounded-lg p-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plano:</span>
                    <span className="text-white font-semibold">{plan.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Valor:</span>
                    <span className="text-white font-semibold">R$ {plan.preco_mensal}/mês</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trial:</span>
                    <span className="text-green-400 font-semibold">{plan.duracao_trial_dias} dias GRÁTIS</span>
                  </div>
                  <div className="border-t border-gray-700 pt-3 mt-3">
                    <div className="flex justify-between text-lg">
                      <span className="text-white font-bold">Total:</span>
                      <span className="text-white font-bold">R$ {plan.preco_mensal}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Primeiro pagamento vence em 3 dias
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-2 text-sm text-gray-400">
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.limite_usuarios === -1 ? 'Usuários ilimitados' : `${plan.limite_usuarios || 0} usuários`}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.limite_contas_whatsapp === -1 ? 'WhatsApp ilimitado' : `${plan.limite_contas_whatsapp || 0} instâncias WhatsApp`}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.limite_mensagens_mes === -1 ? 'Mensagens ilimitadas' : `${(plan.limite_mensagens_mes || 0).toLocaleString()} mensagens/mês`}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.limite_campanhas_mes === -1 ? 'Campanhas ilimitadas' : `${plan.limite_campanhas_mes || 0} campanhas/mês`}
                  </p>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">
                  💳 Forma de Pagamento
                </h3>
                
                <div className="space-y-4">
                  {/* PIX */}
                  <label
                    className={`block bg-gray-900 rounded-lg p-4 border-2 cursor-pointer transition-all ${
                      billingType === 'PIX'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="billing"
                        value="PIX"
                        checked={billingType === 'PIX'}
                        onChange={(e) => setBillingType(e.target.value as 'PIX')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">PIX</span>
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
                            Instantâneo
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Aprovação imediata • Disponível 24/7
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Botão Finalizar */}
                <button
                  onClick={handleCreatePayment}
                  disabled={processing}
                  className="w-full mt-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processando...
                    </span>
                  ) : (
                    `Finalizar Pagamento`
                  )}
                </button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  🔒 Pagamento seguro • Dados protegidos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

