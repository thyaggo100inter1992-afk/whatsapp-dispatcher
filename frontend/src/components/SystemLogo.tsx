import { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import api from '@/services/api';
import { buildFileUrl, getApiBaseUrl } from '@/utils/urlHelpers';

interface SystemLogoProps {
  className?: string;
  showFallback?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function SystemLogo({ className = '', showFallback = true, size = 'medium' }: SystemLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [systemName, setSystemName] = useState('Disparador NettSistemas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      console.log('🎨 SystemLogo: Buscando logo...');
      const response = await api.get('/public/logo');
      console.log('🎨 SystemLogo: Resposta recebida:', response.data);
      
      if (response.data) {
        if (response.data.logo) {
          const assetsHost = getApiBaseUrl();
          const fullLogoUrl = buildFileUrl(response.data.logo) || `${assetsHost}${response.data.logo}`;

          console.log('🎨 SystemLogo: Logo encontrada:', fullLogoUrl);
          setLogoUrl(fullLogoUrl);
        }

        if (response.data.systemName) {
          setSystemName(response.data.systemName);
        }
      } else {
        console.log('🎨 SystemLogo: Nenhuma logo configurada, usando fallback');
      }
    } catch (error: any) {
      console.error('❌ SystemLogo: Erro ao carregar logo:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Tamanhos
  const sizes = {
    small: 'h-16',      // 64px - pequeno
    medium: 'h-24',     // 96px - médio
    large: 'h-32'       // 128px - grande
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`${sizes[size]} w-20 bg-gray-700 animate-pulse rounded`}></div>
      </div>
    );
  }

  // Se tem logo personalizada
  if (logoUrl) {
    return (
      <div className={`flex items-center ${className}`}>
        <img 
          src={logoUrl} 
          alt={systemName}
          className={`${sizes[size]} object-contain`}
          onError={() => setLogoUrl(null)}
        />
      </div>
    );
  }

  // Fallback: Logo padrão com ícone do WhatsApp
  if (showFallback) {
    return (
      <div className={`flex flex-col items-center gap-8 ${className}`}>
        <div className={`bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[3rem] shadow-2xl shadow-emerald-500/50 animate-pulse ${
          size === 'large' ? 'p-20' : size === 'medium' ? 'p-5' : 'p-3'
        }`}>
          <FaWhatsapp className={size === 'large' ? 'text-[16rem]' : size === 'medium' ? 'text-5xl' : 'text-3xl'} />
        </div>
        <div>
          <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600 text-center leading-tight ${
            size === 'large' ? 'text-9xl' : size === 'medium' ? 'text-4xl' : 'text-2xl'
          }`}>
            {systemName}
          </h1>
        </div>
      </div>
    );
  }

  return null;
}
