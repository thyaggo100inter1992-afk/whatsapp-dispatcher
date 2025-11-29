import React from 'react';
import { FaLock, FaRocket } from 'react-icons/fa';
import { useRouter } from 'next/router';

interface FeatureBlockProps {
  message?: string;
  showUpgradeButton?: boolean;
  className?: string;
}

/**
 * Componente para exibir mensagem de funcionalidade bloqueada
 */
export default function FeatureBlock({ 
  message = '🔒 Esta funcionalidade não está disponível no seu plano atual.',
  showUpgradeButton = true,
  className = ''
}: FeatureBlockProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    router.push('/gestao?tab=financeiro');
  };

  return (
    <div className={`flex flex-col items-center justify-center py-20 px-4 ${className}`}>
      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/30 rounded-3xl p-12 max-w-2xl text-center">
        <div className="bg-orange-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <FaLock className="text-orange-400 text-5xl" />
        </div>

        <h2 className="text-3xl font-black text-white mb-4">
          Funcionalidade Bloqueada
        </h2>

        <p className="text-xl text-gray-300 mb-8">
          {message}
        </p>

        {showUpgradeButton && (
          <button
            onClick={handleUpgrade}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-lg font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transform hover:scale-105"
          >
            <FaRocket className="text-2xl" />
            Fazer Upgrade do Plano
          </button>
        )}
      </div>
    </div>
  );
}


