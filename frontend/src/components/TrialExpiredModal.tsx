/**
 * Modal Bonito: Período de Teste Expirado
 * Substituição do alert() feio por um modal moderno
 */

import { FaCrown, FaExclamationTriangle, FaClock } from 'react-icons/fa';

interface TrialExpiredModalProps {
  message: string;
  daysUntilDeletion?: number;
  onClose: () => void;
}

export default function TrialExpiredModal({ message, daysUntilDeletion, onClose }: TrialExpiredModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop com blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl border-2 border-red-500/50 max-w-md w-full overflow-hidden">
        {/* Header com Gradiente */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-center relative overflow-hidden">
          {/* Efeito de brilho */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4 animate-pulse">
              <FaExclamationTriangle className="text-5xl text-white drop-shadow-lg" />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
              Período de Teste Expirado
            </h2>
            
            <p className="text-white/90 font-medium text-lg">
              Escolha um plano para continuar
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-8 space-y-6">
          {/* Mensagem Principal */}
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-white text-lg leading-relaxed">
              {message}
            </p>
          </div>

          {/* Contador de dias até exclusão */}
          {daysUntilDeletion !== undefined && daysUntilDeletion > 0 && (
            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-500/50 rounded-2xl p-6">
              <div className="flex items-center justify-center gap-3 mb-3">
                <FaClock className="text-3xl text-orange-400 animate-pulse" />
                <div className="text-center">
                  <p className="text-5xl font-black text-white mb-1">
                    {daysUntilDeletion}
                  </p>
                  <p className="text-orange-200 font-bold">
                    {daysUntilDeletion === 1 ? 'dia restante' : 'dias restantes'}
                  </p>
                </div>
              </div>
              <p className="text-center text-orange-100 text-sm">
                ⚠️ Após este prazo, sua conta será deletada permanentemente
              </p>
            </div>
          )}

          {/* Call to Action */}
          <div className="space-y-3">
            <button
              onClick={onClose}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-lg rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-3"
            >
              <FaCrown className="text-2xl text-yellow-300" />
              Ver Planos Disponíveis
            </button>

            <p className="text-center text-gray-400 text-sm">
              💡 Escolha um plano e continue aproveitando todos os recursos
            </p>
          </div>
        </div>

        {/* Footer decorativo */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />
      </div>
    </div>
  );
}




