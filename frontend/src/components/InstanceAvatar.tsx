import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';

interface InstanceAvatarProps {
  profilePicUrl?: string | null;
  instanceName: string;
  profileName?: string | null;
  phoneNumber?: string | null;
  isConnected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  showNames?: boolean;
  showPhone?: boolean;
  className?: string;
}

export function InstanceAvatar({
  profilePicUrl,
  instanceName,
  profileName,
  phoneNumber,
  isConnected = true,
  size = 'md',
  showStatus = true,
  showNames = true,
  showPhone = false,
  className = ''
}: InstanceAvatarProps) {
  
  // Tamanhos do avatar
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24'
  };

  // Tamanhos dos ícones
  const iconSizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl'
  };

  // Tamanho do indicador de status
  const statusSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6'
  };

  // Tamanhos de texto
  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  const borderColor = isConnected ? 'border-green-500' : 'border-red-500';
  const bgColor = isConnected ? 'bg-green-500/20' : 'bg-red-500/20';
  const iconColor = isConnected ? 'text-green-400' : 'text-red-400';
  const statusBgColor = isConnected ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Avatar com Foto ou Ícone */}
      <div className="relative flex-shrink-0">
        {profilePicUrl ? (
          <img 
            src={profilePicUrl} 
            alt={`Perfil de ${instanceName}`}
            className={`${sizeClasses[size]} rounded-full object-cover border-4 ${borderColor} shadow-lg`}
            onError={(e) => {
              // Fallback: esconde imagem e mostra ícone
              e.currentTarget.style.display = 'none';
              const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallbackDiv) {
                fallbackDiv.style.display = 'flex';
              }
            }}
          />
        ) : null}
        
        {/* Ícone padrão do WhatsApp (fallback ou quando não tem foto) */}
        <div 
          className={`${sizeClasses[size]} rounded-full ${bgColor} 
            flex items-center justify-center border-4 ${borderColor}
            ${profilePicUrl ? 'hidden' : 'flex'}`}
          style={{ display: profilePicUrl ? 'none' : 'flex' }}
        >
          <FaWhatsapp className={`${iconSizes[size]} ${iconColor}`} />
        </div>
        
        {/* Indicador de Status (bolinha) */}
        {showStatus && (
          <div 
            className={`absolute -bottom-1 -right-1 ${statusSizes[size]} rounded-full 
              border-4 border-dark-800 ${statusBgColor} 
              ${isConnected ? 'animate-pulse' : ''}`}
          />
        )}
      </div>

      {/* Informações de Texto */}
      {showNames && (
        <div className="flex-1 min-w-0">
          {/* Nome da Instância */}
          <h3 className={`${textSizes[size]} font-bold text-white truncate`}>
            {instanceName}
          </h3>
          
          {/* Nome do Perfil do WhatsApp */}
          {profileName && (
            <p className="text-white/80 text-sm truncate flex items-center gap-1">
              <span>👤</span>
              <span>{profileName}</span>
            </p>
          )}
          
          {/* Telefone */}
          {showPhone && phoneNumber && (
            <p className="text-green-400 text-sm font-bold truncate flex items-center gap-1">
              <span>📞</span>
              <span>{phoneNumber}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}







