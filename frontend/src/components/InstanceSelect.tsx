import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronDown, FaSearch } from 'react-icons/fa';
import { InstanceAvatar } from './InstanceAvatar';

interface Instance {
  id: number;
  name: string;
  session_name?: string;
  phone_number?: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_connected?: boolean;
}

interface InstanceSelectProps {
  instances: Instance[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function InstanceSelect({
  instances,
  value,
  onChange,
  placeholder = 'Selecione uma instância',
  required = false,
  className = ''
}: InstanceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Encontrar instância selecionada
  const selectedInstance = instances.find(inst => inst.id.toString() === value.toString());

  // Filtrar instâncias pela busca
  const filteredInstances = instances.filter(inst => 
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.profile_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevenir scroll do body quando modal está aberto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSelect = (instanceId: number) => {
    onChange(instanceId.toString());
    setIsOpen(false);
    setSearchTerm(''); // Limpar busca ao fechar
  };

  // Limpar busca quando fechar o modal
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Renderizar modal bonito e centralizado usando Portal
  const modalContent = isOpen && typeof window !== 'undefined' ? createPortal(
    <>
      {/* Overlay escuro com blur */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ 
          zIndex: 999998,
          backgroundColor: 'rgba(0,0,0,0.75)', 
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={() => setIsOpen(false)}
      >
        {/* Modal centralizado */}
        <div 
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ 
            zIndex: 999999,
            backgroundColor: '#0a0a0a',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            boxShadow: '0 0 60px rgba(59, 130, 246, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            animation: 'slideUp 0.3s ease-out',
            maxHeight: '85vh'
          }}
        >
          {/* Header do Modal */}
          <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-3xl">📱</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Selecionar Instância</h2>
                <p className="text-sm text-white/80">Escolha uma conexão do WhatsApp</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110"
            >
              <span className="text-2xl text-white">×</span>
            </button>
          </div>

          {/* Campo de Busca */}
          {instances.length > 3 && (
            <div className="px-6 pt-4">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-dark-800/50 border-2 border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Conteúdo - Lista de Instâncias */}
          <div 
            className="overflow-y-auto p-6 space-y-3 instance-modal-scroll flex-1"
            style={{
              maxHeight: '450px',
              minHeight: '200px'
            }}
          >
            {instances.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">📱</div>
                <p className="text-2xl text-white/40 mb-2">Nenhuma instância disponível</p>
                <p className="text-sm text-white/30">Crie uma nova conexão primeiro</p>
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-2xl text-white/40 mb-2">Nenhum resultado encontrado</p>
                <p className="text-sm text-white/30">Tente buscar por outro termo</p>
              </div>
            ) : (
              filteredInstances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(instance.id);
                  }}
                  className={`w-full p-5 rounded-2xl flex items-center gap-4 transition-all duration-200 border-2 ${
                    selectedInstance?.id === instance.id 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-blue-400 shadow-lg shadow-blue-500/50 scale-[1.02]' 
                      : 'bg-dark-800/50 border-white/10 hover:border-blue-500/50 hover:bg-dark-700/50 hover:scale-[1.01]'
                  }`}
                  style={{ 
                    cursor: 'pointer',
                  }}
                >
                  {/* Foto de perfil */}
                  {instance.profile_pic_url ? (
                    <img 
                      src={instance.profile_pic_url} 
                      alt="Perfil"
                      className="w-16 h-16 rounded-2xl object-cover border-3 border-green-500 flex-shrink-0 shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border-3 border-green-500 flex-shrink-0 shadow-lg">
                      <span className="text-green-400 text-3xl">📱</span>
                    </div>
                  )}
                  
                  {/* Informações */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-white font-black text-lg truncate mb-1">{instance.name}</div>
                    {instance.profile_name && (
                      <div className="text-white/80 text-sm truncate mb-1">👤 {instance.profile_name}</div>
                    )}
                    {instance.phone_number && (
                      <div className="text-green-400 text-sm font-bold truncate">📞 {instance.phone_number}</div>
                    )}
                  </div>
                  
                  {/* Status e Check */}
                  <div className="flex flex-col items-center gap-2">
                    {selectedInstance?.id === instance.id && (
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <span className="text-blue-600 text-lg">✓</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        instance.is_connected ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'
                      }`}></div>
                      <span className={`text-xs font-bold ${instance.is_connected ? 'text-green-400' : 'text-red-400'}`}>
                        {instance.is_connected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-dark-900/50 flex justify-end gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Scrollbar personalizada para o modal */
        .instance-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.5) rgba(0, 0, 0, 0.3);
        }
        
        .instance-modal-scroll::-webkit-scrollbar {
          width: 10px;
        }
        
        .instance-modal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
        }
        
        .instance-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.6);
          border-radius: 10px;
          border: 2px solid rgba(0, 0, 0, 0.3);
        }
        
        .instance-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.8);
        }
      `}</style>
    </>,
    document.body
  ) : null;

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Botão principal */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white hover:border-primary-500 transition-all flex items-center justify-between relative"
          style={{ zIndex: 1 }}
        >
          {selectedInstance ? (
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-3">
                {/* Foto de perfil */}
                {selectedInstance.profile_pic_url ? (
                  <img 
                    src={selectedInstance.profile_pic_url} 
                    alt="Perfil"
                    className="w-12 h-12 rounded-full object-cover border-2 border-green-500 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500 flex-shrink-0">
                    <span className="text-green-400 text-lg">📱</span>
                  </div>
                )}
                
                {/* Informações em coluna */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{selectedInstance.name}</div>
                  {selectedInstance.profile_name && (
                    <div className="text-white/70 text-xs truncate">👤 {selectedInstance.profile_name}</div>
                  )}
                  {selectedInstance.phone_number && (
                    <div className="text-green-400 text-xs font-semibold truncate">📞 {selectedInstance.phone_number}</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-white/50">{placeholder}</span>
          )}
          <FaChevronDown className={`text-white/60 transition-transform ml-2 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Renderizar modal via Portal (no body) */}
        {modalContent}

        {/* Input hidden para validação de formulário */}
        {required && (
          <input
            type="hidden"
            required
            value={value}
            onChange={() => {}}
          />
        )}
      </div>
    </>
  );
}

