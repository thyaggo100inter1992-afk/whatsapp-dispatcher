/**
 * Toast de Sucesso de Pagamento
 * Notificação bonita e não bloqueante
 */

import { useEffect } from 'react';
import { FaCheckCircle, FaQrcode } from 'react-icons/fa';

interface PaymentSuccessToastProps {
  planName: string;
  onClose: () => void;
  autoCloseDelay?: number;
}

export default function PaymentSuccessToast({ 
  planName, 
  onClose, 
  autoCloseDelay = 5000 
}: PaymentSuccessToastProps) {
  
  // Auto-close após o delay
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [autoCloseDelay, onClose]);

  return (
    <div className="fixed top-6 right-6 z-[9999] animate-slide-in-right">
      {/* Toast Container */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl shadow-2xl border-2 border-emerald-400/50 overflow-hidden max-w-md backdrop-blur-xl">
        {/* Barra de Progresso */}
        <div className="h-1 bg-emerald-400/30 relative overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-300 to-emerald-400 animate-progress"
            style={{ animationDuration: `${autoCloseDelay}ms` }}
          />
        </div>

        {/* Conteúdo */}
        <div className="p-6 flex items-start gap-4">
          {/* Ícone Animado */}
          <div className="flex-shrink-0">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-bounce-slow">
              <FaCheckCircle className="text-4xl text-white drop-shadow-lg" />
            </div>
          </div>

          {/* Texto */}
          <div className="flex-1 pt-1">
            <h3 className="text-white font-black text-xl mb-2 flex items-center gap-2">
              ✅ Cobrança Gerada!
            </h3>
            <p className="text-emerald-50 text-sm leading-relaxed mb-3">
              Após o pagamento, você terá acesso ao plano <strong>{planName}</strong> por 30 dias.
            </p>
            
            {/* Badge PIX */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <FaQrcode className="text-white text-sm" />
              <span className="text-white text-xs font-bold">PIX Gerado</span>
            </div>
          </div>

          {/* Botão Fechar (opcional - pode ser removido pois fecha automaticamente) */}
          <button
            onClick={onClose}
            className="flex-shrink-0 text-white/60 hover:text-white transition-colors text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Efeito de Brilho */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

