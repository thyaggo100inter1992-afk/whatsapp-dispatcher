/**
 * Banner de Alerta: Trial Expirando
 * Aparece no topo de todas as páginas quando trial está acabando
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import paymentService, { PaymentStatus } from '../services/payment.service';

export default function TrialExpiringBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadStatus();
    // Verificar a cada minuto
    const interval = setInterval(loadStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await paymentService.getPaymentStatus();
      setStatus(data.tenant);

      // Mostrar apenas se:
      // - Está em trial
      // - Tem 2 dias ou menos
      // - Não foi dismissed
      if (
        data.tenant.is_trial &&
        data.tenant.trial_days_remaining !== undefined &&
        data.tenant.trial_days_remaining <= 2 &&
        !dismissed
      ) {
        setShow(true);
      } else {
        setShow(false);
      }
    } catch (error) {
      // Silencioso - não mostrar erro se não conseguir carregar
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
  };

  const handleUpgrade = () => {
    router.push('/planos');
  };

  if (!show || !status) {
    return null;
  }

  const isLastDay = status.trial_days_remaining === 0 || status.trial_days_remaining === 1;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isLastDay
          ? 'bg-gradient-to-r from-red-600 to-orange-600'
          : 'bg-gradient-to-r from-orange-500 to-yellow-500'
      } text-white shadow-lg`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-2xl animate-bounce">
              {isLastDay ? '⚠️' : '🎁'}
            </div>
            <div>
              <p className="font-bold text-lg">
                {isLastDay ? (
                  <>
                    ⏰ Seu trial acaba <strong>HOJE</strong>!
                  </>
                ) : (
                  <>
                    ⏰ Seu trial expira em <strong>{status.trial_days_remaining} dias</strong>
                  </>
                )}
              </p>
              <p className="text-sm opacity-90">
                Faça upgrade agora para não perder acesso ao sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleUpgrade}
              className={`${
                isLastDay
                  ? 'bg-white text-red-600 hover:bg-gray-100'
                  : 'bg-white text-orange-600 hover:bg-gray-100'
              } px-6 py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              🚀 Fazer Upgrade
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              title="Dispensar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}





