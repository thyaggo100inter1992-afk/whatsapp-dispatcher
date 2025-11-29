import React from 'react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function QrCriarCampanha() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a página de criar campanha
    router.push('/qr-campanha/criar');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-green-500 mb-4"></div>
        <p className="text-2xl text-white/70">Abrindo criação de campanha...</p>
      </div>
    </div>
  );
}

