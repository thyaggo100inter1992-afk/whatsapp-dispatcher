import React, { useState, useEffect } from 'react';
import { qrCampaignsAPI } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { FaServer, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaTrash, FaPlus, FaTimes, FaCog } from 'react-icons/fa';
import { InstanceAvatar } from '@/components/InstanceAvatar';

interface Instance {
  instance_id: number;
  instance_name: string;
  phone_number: string;
  profile_pic_url?: string | null;
  profile_name?: string | null;
  is_connected?: boolean;
  is_active: boolean;
  consecutive_failures: number;
  last_error?: string;
  removed_at?: string;
  sent_count: number;
  failed_count: number;
  templates: Array<{
    template_id: number;
    template_name: string;
    campaign_template_id: number;
  }>;
}

interface CampaignInstancesManagerQRProps {
  campaignId: number;
  onClose: () => void;
}

export function CampaignInstancesManagerQR({ campaignId, onClose }: CampaignInstancesManagerQRProps) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRemoveFailures, setAutoRemoveFailures] = useState<number>(0);
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadInstances();
    const interval = setInterval(loadInstances, 3001);
    return () => clearInterval(interval);
  }, [campaignId]);

  const loadInstances = async () => {
    try {
      const response = await qrCampaignsAPI.getAccountsStatus(campaignId);
      setInstances(response.data.data);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
      toast.error('❌ Erro ao carregar instâncias');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveInstance = async (instanceId: number, instanceName: string) => {
    const confirmed = await confirm({
      title: '🗑️ Remover Instância',
      message: `Deseja remover temporariamente a instância "${instanceName}"? Ela não enviará mais mensagens até ser re-adicionada.`,
      confirmText: 'Sim, remover',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
      await qrCampaignsAPI.removeAccount(campaignId, instanceId);
      toast.success(`✅ Instância "${instanceName}" removida com sucesso!`);
      loadInstances();
    } catch (error: any) {
      toast.error(`❌ Erro ao remover instância: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleAddInstance = async (instanceId: number, instanceName: string) => {
    const confirmed = await confirm({
      title: '✅ Re-adicionar Instância',
      message: `Deseja re-adicionar a instância "${instanceName}"? Ela voltará a enviar mensagens.`,
      confirmText: 'Sim, re-adicionar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
      await qrCampaignsAPI.addAccount(campaignId, instanceId);
      toast.success(`✅ Instância "${instanceName}" re-adicionada com sucesso!`);
      loadInstances();
    } catch (error: any) {
      toast.error(`❌ Erro ao re-adicionar instância: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleUpdateAutoRemove = async () => {
    try {
      await qrCampaignsAPI.updateAutoRemoveConfig(campaignId, autoRemoveFailures);
      toast.success(`✅ Configuração atualizada! Instâncias serão removidas após ${autoRemoveFailures} falhas`);
    } catch (error: any) {
      toast.error(`❌ Erro ao atualizar configuração: ${error.response?.data?.error || error.message}`);
    }
  };

  const activeInstances = instances.filter(i => i.is_active);
  const removedInstances = instances.filter(i => !i.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl shadow-2xl border-2 border-blue-500/50 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600/30 via-blue-500/20 to-blue-600/30 backdrop-blur-xl border-b-2 border-blue-500/50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/20 p-4 rounded-xl">
                <FaCog className="text-4xl text-blue-400" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-blue-300">
                  Gerenciar Instâncias
                </h2>
                <p className="text-base text-white/70 mt-1">
                  {activeInstances.length} ativa(s) | {removedInstances.length} removida(s) | {instances.length} total
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors"
            >
              <FaTimes className="text-2xl text-white/70 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-white/70">Carregando instâncias...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                  <p className="text-blue-400 font-semibold text-sm">Total</p>
                  <p className="text-3xl font-bold text-white">{instances.length}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-semibold text-sm">Ativas</p>
                  <p className="text-3xl font-bold text-green-400">{activeInstances.length}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                  <p className="text-red-400 font-semibold text-sm">Removidas</p>
                  <p className="text-3xl font-bold text-red-400">{removedInstances.length}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                  <p className="text-purple-400 font-semibold text-sm">Enviadas</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {instances.reduce((sum, i) => sum + i.sent_count, 0)}
                  </p>
                </div>
              </div>

              {/* Config Section */}
              <div className="bg-dark-900/50 rounded-xl p-6 border-2 border-yellow-500/20">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FaExclamationTriangle className="text-yellow-400" />
                  Remoção Automática
                </h3>
                <p className="text-white/70 mb-4 text-sm">
                  Configure o número de falhas consecutivas para remover automaticamente uma instância. Use 0 para desabilitar.
                </p>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-white font-bold mb-2 block text-sm">Falhas Consecutivas:</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={autoRemoveFailures}
                      onChange={(e) => setAutoRemoveFailures(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-dark-800 border-2 border-yellow-500/30 rounded-xl text-white focus:border-yellow-500 focus:outline-none"
                      placeholder="0 = desabilitado"
                    />
                  </div>
                  <button
                    onClick={handleUpdateAutoRemove}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl font-bold transition-all duration-200"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {/* Active Instances */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <FaCheckCircle className="text-green-400" />
                  Instâncias Ativas ({activeInstances.length})
                </h3>

                {activeInstances.length === 0 ? (
                  <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6 text-center">
                    <p className="text-yellow-300 font-bold text-lg">⚠️ Nenhuma instância ativa!</p>
                    <p className="text-white/70 mt-2">A campanha está pausada. Re-adicione pelo menos uma instância para continuar.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeInstances.map((instance) => (
                      <div key={instance.instance_id} className="bg-dark-900/50 rounded-xl p-5 border-2 border-green-500/20">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 flex items-center gap-4">
                            <InstanceAvatar
                              profilePicUrl={instance.profile_pic_url}
                              instanceName={instance.instance_name}
                              profileName={instance.profile_name}
                              phoneNumber={instance.phone_number}
                              isConnected={instance.is_connected ?? true}
                              size="md"
                              showStatus={true}
                              showNames={true}
                              showPhone={true}
                            />
                            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm font-bold border border-green-500/30">
                              ✅ ATIVA
                            </span>
                          </div>

                          <button
                            onClick={() => handleRemoveInstance(instance.instance_id, instance.instance_name)}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                          >
                            <FaTrash /> Remover
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Enviadas:</p>
                            <p className="text-xl font-bold text-green-400">{instance.sent_count}</p>
                          </div>
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Falhas:</p>
                            <p className="text-xl font-bold text-red-400">{instance.failed_count}</p>
                          </div>
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Consecutivas:</p>
                            <p className={`text-xl font-bold ${instance.consecutive_failures >= 5 ? 'text-red-400' : 'text-white'}`}>
                              {instance.consecutive_failures}
                            </p>
                          </div>
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Templates:</p>
                            <p className="text-xl font-bold text-primary-400">{instance.templates.length}</p>
                          </div>
                        </div>

                        {instance.templates.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {instance.templates.map((template, idx) => (
                              <span key={idx} className="px-2 py-1 bg-primary-500/20 text-primary-300 rounded-lg text-xs border border-primary-500/30">
                                {template.template_name || `Template #${template.template_id}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {instance.last_error && (
                          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                            <p className="text-red-300 text-xs">
                              <span className="font-bold">Último erro:</span> {instance.last_error}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Removed Instances */}
              {removedInstances.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <FaTimesCircle className="text-red-400" />
                    Instâncias Removidas ({removedInstances.length})
                  </h3>

                  <div className="space-y-4">
                    {removedInstances.map((instance) => (
                      <div key={instance.instance_id} className="bg-dark-900/50 rounded-xl p-5 border-2 border-red-500/20">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <FaServer className="text-red-400 text-xl" />
                              <h4 className="text-lg font-bold text-white">{instance.instance_name}</h4>
                              <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-xs font-bold border border-red-500/30">
                                🚫 REMOVIDA
                              </span>
                            </div>
                            <p className="text-white/60 ml-8 text-sm">{instance.phone_number}</p>
                          </div>

                          <button
                            onClick={() => handleAddInstance(instance.instance_id, instance.instance_name)}
                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                          >
                            <FaPlus /> Re-adicionar
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Enviadas:</p>
                            <p className="text-xl font-bold text-white">{instance.sent_count}</p>
                          </div>
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Falhas:</p>
                            <p className="text-xl font-bold text-red-400">{instance.failed_count}</p>
                          </div>
                          <div className="bg-dark-800/50 rounded-lg p-3">
                            <p className="text-white/60 mb-1 text-xs">Consecutivas:</p>
                            <p className="text-xl font-bold text-red-400">{instance.consecutive_failures}</p>
                          </div>
                        </div>

                        {instance.last_error && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                            <p className="text-red-300 text-xs">
                              <span className="font-bold">Motivo:</span> {instance.last_error}
                            </p>
                          </div>
                        )}

                        {instance.removed_at && (
                          <p className="mt-2 text-white/50 text-xs">
                            Removida em: {new Date(instance.removed_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-dark-800/90 backdrop-blur-xl border-t-2 border-blue-500/30 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all duration-200"
          >
            Fechar
          </button>
        </div>
      </div>
      
      {/* Modal de Confirmação */}
      <ConfirmDialog />
    </div>
  );
}
