/**
 * Página de Planos Disponíveis
 * Exibe todos os planos com preços e recursos
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft } from 'react-icons/fa';
import paymentService, { Plan } from '../services/payment.service';

export default function PlanosPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await paymentService.listPlans();
      
      console.log('📊 Planos carregados:', data);
      
      // Filtrar apenas planos pagos (excluir teste grátis)
      const paidPlans = data.filter(p => p.preco_mensal > 0);
      setPlans(paidPlans);
    } catch (error: any) {
      console.error('Erro ao carregar planos:', error);
      alert(error.response?.data?.message || 'Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (slug: string) => {
    router.push(`/checkout?plan=${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Botão Voltar */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <FaArrowLeft />
          <span>Voltar</span>
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Escolha Seu Plano
          </h1>
          <p className="text-xl text-gray-400">
            3 dias de trial grátis em todos os planos 🎁
          </p>
          <p className="text-gray-500 mt-2">
            Cancele quando quiser, sem taxas adicionais
          </p>
        </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-gray-800 rounded-2xl p-8 border-2 transition-all hover:scale-105 ${
                  plan.destaque
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {/* Badge destaque */}
                {plan.destaque && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      ⭐ Mais Popular
                    </span>
                  </div>
                )}

                {/* Nome do Plano */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {plan.nome}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {plan.descricao}
                  </p>
                </div>

                {/* Preço */}
                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-white">
                      R$ {plan.preco_mensal}
                    </span>
                    <span className="text-gray-400 ml-2">/mês</span>
                  </div>
                  {plan.preco_anual > 0 && (
                    <p className="text-sm text-green-400 mt-2">
                      💰 R$ {plan.preco_anual}/ano (economize 2 meses)
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    🎁 {plan.duracao_trial_dias} dias grátis para testar
                  </p>
                </div>

                {/* Recursos */}
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {(plan.limite_usuarios || 0) === -1 
                        ? 'Usuários Ilimitados' 
                        : `${plan.limite_usuarios || 0} usuários`}
                    </span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {((plan as any).limite_instancias_whatsapp || plan.limite_contas_whatsapp) === -1 
                        ? 'WhatsApp Ilimitado' 
                        : `${(plan as any).limite_instancias_whatsapp || plan.limite_contas_whatsapp || 0} instâncias WhatsApp`}
                    </span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {(plan.limite_mensagens_mes || 0) === -1 
                        ? 'Mensagens Ilimitadas' 
                        : `${(plan.limite_mensagens_mes || 0).toLocaleString()} mensagens/mês`}
                    </span>
                  </li>
                  <li className="flex items-center text-gray-300">
                    <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {(plan.limite_campanhas_mes || 0) === -1 
                        ? 'Campanhas Ilimitadas' 
                        : `${plan.limite_campanhas_mes || 0} campanhas/mês`}
                    </span>
                  </li>
                  
                  {/* Recursos Extras */}
                  {plan.recursos?.api_acesso && (
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-blue-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Acesso à API</span>
                    </li>
                  )}
                  {plan.recursos?.webhook && (
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-blue-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Webhooks</span>
                    </li>
                  )}
                  {plan.recursos?.relatorios_avancados && (
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-blue-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Relatórios Avançados</span>
                    </li>
                  )}
                  {plan.recursos?.suporte_prioritario && (
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-purple-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Suporte Prioritário</span>
                    </li>
                  )}
                </ul>

                {/* Botão */}
                <button
                  onClick={() => handleSelectPlan(plan.slug)}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                    plan.destaque
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  Começar Agora
                </button>
              </div>
            ))}
          </div>

        {/* Garantia */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-300 mb-2">
              ✅ 3 dias grátis para testar • 🔒 Pagamento seguro • 🚀 Ativação imediata
            </p>
            <p className="text-sm text-gray-500">
              Cancelamento a qualquer momento • Sem taxas ocultas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

