import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaSearch } from 'react-icons/fa';

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
  className = '',
}: InstanceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedInstance = instances.find((inst) => inst.id.toString() === value.toString());

  const filteredInstances = instances.filter(
    (inst) =>
      inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.phone_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.profile_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (instanceId: number) => {
    onChange(instanceId.toString());
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white hover:border-primary-500 transition-all flex items-center justify-between"
      >
        {selectedInstance ? (
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-3">
              {selectedInstance.profile_pic_url ? (
                <img
                  src={selectedInstance.profile_pic_url}
                  alt="Perfil"
                  className="w-10 h-10 rounded-full object-cover border-2 border-green-500 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500 flex-shrink-0">
                  <span className="text-green-400 text-sm">📱</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm truncate">{selectedInstance.name}</div>
                {selectedInstance.phone_number && (
                  <div className="text-green-400 text-xs font-semibold truncate">
                    {selectedInstance.phone_number}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-white/50">{placeholder}</span>
        )}
        <FaChevronDown className={`text-white/60 transition-transform ml-2 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-2 bg-dark-700 border-2 border-white/20 rounded-xl shadow-2xl overflow-hidden">
          {instances.length > 6 && (
            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-dark-800/80 border border-white/10 text-white text-sm placeholder-white/40 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="max-h-[24rem] overflow-y-auto origin-dropdown-scroll">
            {instances.length === 0 ? (
              <div className="px-4 py-6 text-center text-white/50 text-sm">Nenhuma instância disponível</div>
            ) : filteredInstances.length === 0 ? (
              <div className="px-4 py-6 text-center text-white/50 text-sm">Nenhum resultado encontrado</div>
            ) : (
              filteredInstances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  onClick={() => handleSelect(instance.id)}
                  className={`w-full h-16 px-4 flex items-center gap-3 transition-colors text-left ${
                    selectedInstance?.id === instance.id
                      ? 'bg-primary-500/30 text-white'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  {instance.profile_pic_url ? (
                    <img
                      src={instance.profile_pic_url}
                      alt="Perfil"
                      className="w-10 h-10 rounded-full object-cover border-2 border-green-500 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500 flex-shrink-0">
                      <span className="text-green-400 text-sm">📱</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm truncate">{instance.name}</div>
                    {instance.phone_number && (
                      <div className="text-green-400 text-xs font-semibold truncate">{instance.phone_number}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        instance.is_connected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className={`text-xs ${instance.is_connected ? 'text-green-400' : 'text-red-400'}`}>
                      {instance.is_connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {required && <input type="hidden" required value={value} onChange={() => {}} />}
    </div>
  );
}
