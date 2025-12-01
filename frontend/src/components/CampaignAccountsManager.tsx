import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaRedo, FaTrash, FaPlus, FaCog } from 'react-icons/fa';
import { useConfirm } from '@/hooks/useConfirm';

// Configuração da URL base da API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface AccountStatus {
  account_id: number;
  account_name: string;
  phone_number: string;
  is_active: boolean;
  consecutive_failures: number;
  last_error: string | null;
  removed_at: string | null;
  sent_count: number;
  failed_count: number;
  templates: Array<{
    template_id: number;
    template_name: string;
    campaign_template_id: number;
  }>;
}

interface CampaignAccountsManagerProps {
  campaignId: number;
  onClose?: () => void;
  toast?: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

export const CampaignAccountsManager: React.FC<CampaignAccountsManagerProps> = ({
  campaignId,
  onClose,
  toast: externalToast
}) => {
  const { confirm, ConfirmDialog } = useConfirm();
  
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRemoveLimit, setAutoRemoveLimit] = useState(5);
  const [savingConfig, setSavingConfig] = useState(false);
  const [removingAccount, setRemovingAccount] = useState<number | null>(null);
  const [addingAccount, setAddingAccount] = useState<number | null>(null);

  useEffect(() => {
    fetchAccountsStatus();
    const interval = setInterval(fetchAccountsStatus, 3000); // Atualizar a cada 3 segundos
    return () => clearInterval(interval);
  }, [campaignId]);

  const fetchAccountsStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/accounts-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar status das contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAccount = async (accountId: number, accountName: string) => {
    const confirmed = await confirm({
      title: '🗑️ Remover Conta Temporariamente',
      message: `Tem certeza que deseja remover temporariamente a conta "${accountName}"?\n\nA campanha continuará com as contas restantes.`,
      type: 'warning',
      confirmText: 'Sim, Remover',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    setRemovingAccount(accountId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/remove-account`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();

      if (data.success) {
        if (externalToast) {
          externalToast.success(`Conta "${accountName}" removida! ${data.data.active_accounts_remaining} conta(s) ativa(s) restante(s).`);
          
          if (data.data.campaign_paused) {
            externalToast.warning('⚠️ Campanha pausada! Nenhuma conta ativa restante.');
          } else {
            externalToast.info('🔄 Redistribuição automática ativada. Próximos envios usarão contas restantes.');
          }
        }
        fetchAccountsStatus();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao remover conta: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setRemovingAccount(null);
    }
  };

  const handleAddAccount = async (accountId: number, accountName: string) => {
    const confirmed = await confirm({
      title: '✅ Re-Adicionar Conta',
      message: `Tem certeza que deseja re-adicionar a conta "${accountName}"?\n\nEla voltará à rotação de envios imediatamente.`,
      type: 'info',
      confirmText: 'Sim, Re-Adicionar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    setAddingAccount(accountId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/add-account`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();

      if (data.success) {
        if (externalToast) {
          externalToast.success(`Conta "${accountName}" re-adicionada! ${data.data.active_accounts_total} conta(s) ativa(s) no total.`);
          externalToast.info('🔄 Redistribuição automática ativada. Próximos envios incluirão esta conta.');
        }
        fetchAccountsStatus();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao re-adicionar conta: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setAddingAccount(null);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/campaigns/${campaignId}/auto-remove-config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ auto_remove_account_failures: autoRemoveLimit })
      });

      const data = await response.json();

      if (data.success) {
        if (externalToast) {
          externalToast.success(`Configuração salva! Limite: ${autoRemoveLimit} falhas consecutivas.`);
        }
      } else {
        if (externalToast) {
          externalToast.error('Erro ao salvar: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const activeAccounts = accounts.filter(a => a.is_active);
  const removedAccounts = accounts.filter(a => !a.is_active);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaCog className="mr-2 text-blue-600" />
            Gerenciar Contas da Campanha
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-700 font-semibold text-sm">Contas Ativas</div>
            <div className="text-3xl font-bold text-green-600">{activeAccounts.length}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-700 font-semibold text-sm">Contas Removidas</div>
            <div className="text-3xl font-bold text-red-600">{removedAccounts.length}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-700 font-semibold text-sm">Total de Contas</div>
            <div className="text-3xl font-bold text-blue-600">{accounts.length}</div>
          </div>
        </div>

        {/* Configuração de Remoção Automática */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <FaCog className="mr-2 text-gray-600" />
            Configuração de Remoção Automática
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remover conta após quantas falhas consecutivas?
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={autoRemoveLimit}
                onChange={(e) => setAutoRemoveLimit(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {autoRemoveLimit === 0 ? '⚠️ Remoção automática desabilitada' : `Contas com ${autoRemoveLimit} falhas consecutivas serão removidas automaticamente`}
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Contas Ativas */}
        {activeAccounts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <FaCheckCircle className="mr-2 text-green-600" />
              Contas Ativas ({activeAccounts.length})
            </h3>
            <div className="space-y-3">
              {activeAccounts.map(account => (
                <div key={account.account_id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FaCheckCircle className="text-green-600" />
                        <span className="font-semibold text-gray-800">{account.account_name}</span>
                        <span className="text-gray-600">({account.phone_number})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">📊 Enviadas:</span>
                          <span className="ml-2 font-semibold text-green-600">{account.sent_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">❌ Falhas:</span>
                          <span className="ml-2 font-semibold text-red-600">{account.failed_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">⚠️ Falhas consecutivas:</span>
                          <span className="ml-2 font-semibold text-orange-600">{account.consecutive_failures}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">📄 Templates:</span>
                          <span className="ml-2 font-semibold text-blue-600">{account.templates.length}</span>
                        </div>
                      </div>
                      {account.last_error && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                          <strong>Último erro:</strong> {account.last_error}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAccount(account.account_id, account.account_name)}
                      disabled={removingAccount === account.account_id}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <FaTrash />
                      {removingAccount === account.account_id ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contas Removidas */}
        {removedAccounts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <FaTimesCircle className="mr-2 text-red-600" />
              Contas Removidas ({removedAccounts.length})
            </h3>
            <div className="space-y-3">
              {removedAccounts.map(account => (
                <div key={account.account_id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FaTimesCircle className="text-red-600" />
                        <span className="font-semibold text-gray-800">{account.account_name}</span>
                        <span className="text-gray-600">({account.phone_number})</span>
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">REMOVIDA</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-gray-600">📊 Enviadas:</span>
                          <span className="ml-2 font-semibold text-green-600">{account.sent_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">❌ Falhas:</span>
                          <span className="ml-2 font-semibold text-red-600">{account.failed_count}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">⚠️ Falhas consecutivas:</span>
                          <span className="ml-2 font-semibold text-orange-600">{account.consecutive_failures}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">🗑️ Removida em:</span>
                          <span className="ml-2 font-semibold text-gray-600">
                            {account.removed_at ? new Date(account.removed_at).toLocaleString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                      </div>
                      {account.last_error && (
                        <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                          <strong>Motivo:</strong> {account.last_error}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddAccount(account.account_id, account.account_name)}
                      disabled={addingAccount === account.account_id}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <FaPlus />
                      {addingAccount === account.account_id ? 'Adicionando...' : 'Re-adicionar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aviso se não houver contas ativas */}
        {activeAccounts.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <FaExclamationTriangle className="text-red-600 text-2xl" />
            <div>
              <p className="font-semibold text-red-800">⚠️ Nenhuma conta ativa!</p>
              <p className="text-sm text-red-700">A campanha está pausada. Re-adicione pelo menos uma conta para continuar.</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
    </div>
  );
};

