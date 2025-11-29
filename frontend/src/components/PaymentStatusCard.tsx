/**
 * Componente: Card de Status de Pagamento
 * Exibe informações sobre plano atual, trial, vencimentos
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import paymentService, { PaymentStatus, Payment } from '../services/payment.service';

export default function PaymentStatusCard() {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await paymentService.getPaymentStatus();
      setStatus(data.tenant);
      setLastPayment(data.last_payment);
    } catch (error: any) {
      console.error('Erro ao carregar status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-8 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Status Trial
  if (status.is_trial && status.trial_days_remaining !== undefined) {
    const isExpiringSoon = status.trial_days_remaining <= 1;
    
    return (
      <div className={`bg-gradient-to-r ${
        isExpiringSoon 
          ? 'from-orange-500/20 to-red-500/20 border-orange-500' 
          : 'from-blue-500/20 to-purple-500/20 border-blue-500'
      } rounded-xl p-6 border-2`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎁</span>
              <h3 className="text-xl font-bold text-white">
                Trial Ativo
              </h3>
            </div>
            <p className="text-gray-300 mb-4">
              Você tem <strong className={isExpiringSoon ? 'text-orange-400' : 'text-blue-400'}>
                {status.trial_days_remaining} {status.trial_days_remaining === 1 ? 'dia' : 'dias'}
              </strong> restantes para testar gratuitamente
            </p>
            
            {isExpiringSoon && (
              <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-3 mb-4">
                <p className="text-orange-300 text-sm font-semibold">
                  ⚠️ Seu trial está acabando! Faça upgrade agora para não perder acesso.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/planos')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                🚀 Fazer Upgrade
              </button>
              <button
                onClick={() => router.push('/gestao')}
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                Ver Recursos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Status Bloqueado
  if (status.is_blocked) {
    return (
      <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl p-6 border-2 border-red-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">
              Conta Bloqueada
            </h3>
            <p className="text-gray-300 mb-2">
              Seu acesso foi bloqueado. Faça o pagamento para reativar sua conta.
            </p>
            
            {status.days_until_deletion !== undefined && status.days_until_deletion > 0 && (
              <div className="bg-red-500/30 border border-red-400 rounded-lg p-3 mb-4">
                <p className="text-red-200 text-sm font-semibold">
                  ⚠️ Sua conta será deletada permanentemente em {status.days_until_deletion} {status.days_until_deletion === 1 ? 'dia' : 'dias'}!
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/planos')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                💳 Reativar Agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Status Ativo
  return (
    <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border-2 border-green-500">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✅</span>
            <h3 className="text-xl font-bold text-white">
              Plano {status.plano_nome} Ativo
            </h3>
          </div>
          <p className="text-gray-300 mb-2">
            Sua assinatura está ativa e em dia
          </p>

          {status.proximo_vencimento && (
            <p className="text-sm text-gray-400 mb-4">
              Próximo vencimento: <strong className="text-white">
                {new Date(status.proximo_vencimento).toLocaleDateString('pt-BR')}
              </strong>
            </p>
          )}

          {lastPayment && (
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-400 mb-1">Último pagamento:</p>
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">
                  R$ {lastPayment.valor}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  lastPayment.status === 'confirmed' || lastPayment.status === 'received'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {lastPayment.status === 'confirmed' || lastPayment.status === 'received'
                    ? '✓ Confirmado'
                    : 'Pendente'}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/planos')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
            >
              🔄 Mudar Plano
            </button>
            <button
              onClick={loadStatus}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-all"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

