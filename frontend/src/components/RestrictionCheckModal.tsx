import React, { useState } from 'react';
import { FaTimes, FaExclamationTriangle, FaCheckCircle, FaBan, FaUserSlash, FaPhone, FaChartBar } from 'react-icons/fa';

interface RestrictionCheckResult {
  success: boolean;
  total_checked: number;
  restricted_count: number;
  clean_count: number;
  count_by_type: {
    do_not_disturb: number;
    blocked: number;
    not_interested: number;
  };
  restricted_details: Array<{
    phone_number: string;
    matched_number: string;
    contact_name: string | null;
    lists: string[];
    list_names: string[];
    details: Array<{
      list_type: string;
      list_name: string;
      added_at: string;
      notes: string | null;
    }>;
  }>;
}

interface RestrictionCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: RestrictionCheckResult | null;
  totalTemplates: number;
  intervalSeconds: number;
  onExcludeRestricted: () => void;
  onKeepAll: () => void;
}

export default function RestrictionCheckModal({
  isOpen,
  onClose,
  result,
  totalTemplates,
  intervalSeconds,
  onExcludeRestricted,
  onKeepAll,
}: RestrictionCheckModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !result) return null;

  // Calcular impacto na campanha
  const messagesWithRestricted = result.total_checked * totalTemplates;
  const messagesWithoutRestricted = result.clean_count * totalTemplates;
  const messagesSaved = messagesWithRestricted - messagesWithoutRestricted;

  const timeWithRestricted = Math.ceil(
    ((result.total_checked - 1) * intervalSeconds + result.total_checked * 2) / 60
  );
  const timeWithoutRestricted = Math.ceil(
    ((result.clean_count - 1) * intervalSeconds + result.clean_count * 2) / 60
  );

  const getListIcon = (listType: string) => {
    switch (listType) {
      case 'do_not_disturb':
        return <FaBan className="text-yellow-400" />;
      case 'blocked':
        return <FaUserSlash className="text-red-400" />;
      case 'not_interested':
        return <FaTimes className="text-orange-400" />;
      default:
        return null;
    }
  };

  const getListColor = (listType: string) => {
    switch (listType) {
      case 'do_not_disturb':
        return 'text-yellow-300';
      case 'blocked':
        return 'text-red-300';
      case 'not_interested':
        return 'text-orange-300';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl shadow-2xl border-2 border-primary-500/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-yellow-600/30 via-yellow-500/20 to-yellow-600/30 backdrop-blur-xl border-b-2 border-yellow-500/50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-500/20 p-4 rounded-xl">
                <FaExclamationTriangle className="text-4xl text-yellow-400" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-yellow-300">
                  Contatos em Listas de Restrição
                </h2>
                <p className="text-base text-white/70 mt-1">
                  Encontramos contatos que estão nas listas de restrição
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-2"
            >
              <FaTimes className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Resumo Estatístico */}
          <div className="bg-dark-700/60 rounded-xl p-6 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <FaChartBar className="text-primary-400" />
              Resumo da Verificação
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-sm text-blue-300 mb-1">Total Verificado</p>
                <p className="text-3xl font-black text-white">{result.total_checked}</p>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <p className="text-sm text-green-300 mb-1 flex items-center gap-2">
                  <FaCheckCircle /> Livres para Envio
                </p>
                <p className="text-3xl font-black text-green-400">{result.clean_count}</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-300 mb-1 flex items-center gap-2">
                  <FaExclamationTriangle /> Restritos
                </p>
                <p className="text-3xl font-black text-red-400">{result.restricted_count}</p>
              </div>
            </div>
          </div>

          {/* Detalhamento por Lista */}
          <div className="bg-dark-700/60 rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">📋 Detalhamento por Lista</h3>

            <div className="space-y-3">
              {result.count_by_type.do_not_disturb > 0 && (
                <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaBan className="text-2xl text-yellow-400" />
                    <div>
                      <p className="font-bold text-yellow-300">Não Perturbe</p>
                      <p className="text-sm text-white/60">Contatos que não querem ser contatados</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-yellow-400">
                    {result.count_by_type.do_not_disturb}
                  </span>
                </div>
              )}

              {result.count_by_type.blocked > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaUserSlash className="text-2xl text-red-400" />
                    <div>
                      <p className="font-bold text-red-300">Bloqueados</p>
                      <p className="text-sm text-white/60">Contatos bloqueados temporariamente</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-red-400">
                    {result.count_by_type.blocked}
                  </span>
                </div>
              )}

              {result.count_by_type.not_interested > 0 && (
                <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaTimes className="text-2xl text-orange-400" />
                    <div>
                      <p className="font-bold text-orange-300">Sem Interesse</p>
                      <p className="text-sm text-white/60">Contatos que demonstraram desinteresse</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-orange-400">
                    {result.count_by_type.not_interested}
                  </span>
                </div>
              )}

              {result.count_by_type.do_not_disturb === 0 &&
                result.count_by_type.blocked === 0 &&
                result.count_by_type.not_interested === 0 && (
                  <div className="text-center py-4 text-white/50">
                    Nenhum contato restrito encontrado
                  </div>
                )}
            </div>

            {result.restricted_count > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="mt-4 w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-white font-medium transition-all"
              >
                {showDetails ? '▼ Ocultar' : '▶'} Ver Lista Completa dos Restritos
              </button>
            )}

            {showDetails && (
              <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                {result.restricted_details.map((contact, index) => (
                  <div
                    key={index}
                    className="p-3 bg-dark-800/80 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FaPhone className="text-white/50" />
                        <div>
                          <p className="font-bold text-white">{contact.phone_number}</p>
                          {contact.contact_name && (
                            <p className="text-sm text-white/60">{contact.contact_name}</p>
                          )}
                          {contact.matched_number !== contact.phone_number && (
                            <p className="text-xs text-yellow-400">
                              Encontrado como: {contact.matched_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {contact.lists.map((list, i) => (
                          <div key={i} className="flex items-center gap-1">
                            {getListIcon(list)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {contact.list_names.map((name, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-1 rounded ${getListColor(contact.lists[i])} bg-white/5`}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Impacto na Campanha */}
          <div className="bg-gradient-to-r from-primary-500/20 to-primary-600/10 border-2 border-primary-500/40 rounded-xl p-6">
            <h3 className="text-xl font-bold text-primary-300 mb-4">⚡ Impacto na Campanha</h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* SE EXCLUIR */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-sm font-bold text-green-300 mb-3">✅ SE EXCLUIR os restritos:</p>
                <ul className="space-y-2 text-sm text-white/80">
                  <li>
                    • <strong>{result.clean_count}</strong> contatos × <strong>{totalTemplates}</strong> templates ={' '}
                    <strong className="text-green-400">{messagesWithoutRestricted} mensagens</strong>
                  </li>
                  <li>
                    • Tempo estimado: <strong className="text-green-400">~{timeWithoutRestricted} min</strong>
                  </li>
                  <li className="text-green-300 font-bold">
                    • Economia: {messagesSaved} mensagens não enviadas
                  </li>
                </ul>
              </div>

              {/* SE MANTER */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm font-bold text-yellow-300 mb-3">⚠️ SE MANTER todos:</p>
                <ul className="space-y-2 text-sm text-white/80">
                  <li>
                    • <strong>{result.total_checked}</strong> contatos × <strong>{totalTemplates}</strong> templates ={' '}
                    <strong className="text-yellow-400">{messagesWithRestricted} mensagens</strong>
                  </li>
                  <li>
                    • Tempo estimado: <strong className="text-yellow-400">~{timeWithRestricted} min</strong>
                  </li>
                  <li className="text-yellow-300">
                    • ⚠️ {result.restricted_count} contatos podem não responder bem
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="bg-dark-700/60 rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">❓ O que deseja fazer?</h3>

            <div className="space-y-3">
              <button
                onClick={onExcludeRestricted}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transform hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <FaCheckCircle className="text-2xl" />
                Excluir Restritos e Criar Campanha
                <span className="text-sm font-normal opacity-80">
                  (Recomendado - {result.clean_count} contatos)
                </span>
              </button>

              <button
                onClick={onKeepAll}
                className="w-full py-4 px-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transform hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <FaExclamationTriangle className="text-2xl" />
                Manter Todos e Criar Campanha
                <span className="text-sm font-normal opacity-80">
                  (Todos os {result.total_checked} contatos)
                </span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 px-6 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl transition-all duration-200 border border-white/20"
              >
                🔙 Voltar e Revisar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
