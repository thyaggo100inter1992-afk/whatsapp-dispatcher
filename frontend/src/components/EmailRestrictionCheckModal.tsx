import React, { useState } from 'react';
import { FaTimes, FaExclamationTriangle, FaCheckCircle, FaEnvelope, FaBan } from 'react-icons/fa';

export interface EmailRestrictionCheckResult {
  success: boolean;
  total_checked: number;
  restricted_count: number;
  clean_count: number;
  restricted_emails: string[];
  restricted_details: Array<{
    email: string;
    reason?: string;
    source?: string;
    notes?: string | null;
    added_at?: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: EmailRestrictionCheckResult | null;
  onExcludeRestricted: () => void;
  onKeepAll: () => void;
  actionLabelExclude?: string;
  actionLabelKeep?: string;
}

export default function EmailRestrictionCheckModal({
  isOpen,
  onClose,
  result,
  onExcludeRestricted,
  onKeepAll,
  actionLabelExclude = 'Excluir restritos e continuar',
  actionLabelKeep = 'Manter todos e continuar',
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl shadow-2xl border-2 border-red-500/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-red-600/30 via-orange-500/20 to-red-600/30 backdrop-blur-xl border-b-2 border-red-500/40 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-red-500/20 p-4 rounded-xl">
                <FaBan className="text-3xl text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-red-300">E-mails na lista de restrição</h2>
                <p className="text-sm text-white/70 mt-1">
                  Estes destinatários cancelaram a inscrição e pediram para não receber e-mails.
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white p-2">
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-300 mb-1">Verificados</p>
              <p className="text-2xl font-black text-white">{result.total_checked}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-green-300 mb-1 flex items-center justify-center gap-1">
                <FaCheckCircle /> Livres
              </p>
              <p className="text-2xl font-black text-green-400">{result.clean_count}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-xs text-red-300 mb-1 flex items-center justify-center gap-1">
                <FaExclamationTriangle /> Restritos
              </p>
              <p className="text-2xl font-black text-red-400">{result.restricted_count}</p>
            </div>
          </div>

          {result.restricted_count > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-white text-sm font-medium"
              >
                {showDetails ? '▼ Ocultar' : '▶'} Ver e-mails restritos
              </button>
              {showDetails && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                  {(result.restricted_details.length
                    ? result.restricted_details
                    : result.restricted_emails.map((email) => ({ email }))
                  ).map((row, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-dark-800/80 border border-white/10 rounded-lg">
                      <FaEnvelope className="text-white/40 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{row.email}</p>
                        {row.reason && (
                          <p className="text-xs text-white/50">{row.reason}{row.source ? ` · ${row.source}` : ''}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onExcludeRestricted}
              className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-3"
            >
              <FaCheckCircle />
              {actionLabelExclude}
              <span className="text-sm font-normal opacity-80">({result.clean_count} e-mails)</span>
            </button>
            <button
              type="button"
              onClick={onKeepAll}
              className="w-full py-4 px-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-bold rounded-xl flex items-center justify-center gap-3"
            >
              <FaExclamationTriangle />
              {actionLabelKeep}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-6 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl border border-white/20"
            >
              Voltar e revisar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
