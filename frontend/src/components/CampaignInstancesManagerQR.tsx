import React, { useState, useEffect } from 'react';
import { qrCampaignsAPI } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { FaServer, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaTrash, FaPlus } from 'react-icons/fa';
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-white text-xl">🔄 Carregando instâncias...</div>
      </div>
    );
  }

  const activeInstances = instances.filter(i => i.is_active);
  const removedInstances = instances.filter(i => !i.is_active);

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Config Section */}
      <div className="bg-dark-900/50 rounded-xl p-6 border-2 border-primary-500/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FaExclamationTriangle className="text-yellow-400" />
          Remoção Automática
        </h3>
        <p className="text-white/70 mb-4">
          Configure o número de falhas consecutivas para remover automaticamente uma instância da campanha. Use 0 para desabilitar.
        </p>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-white font-bold mb-2 block">Falhas Consecutivas:</label>
            <input
              type="number"
              min="0"
              max="20"
              value={autoRemoveFailures}
              onChange={(e) => setAutoRemoveFailures(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-dark-800 border-2 border-primary-500/30 rounded-xl text-white focus:border-primary-500 focus:outline-none"
              placeholder="0 = desabilitado"
            />
          </div>
          <button
            onClick={handleUpdateAutoRemove}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold transition-all duration-200"
          >
            Salvar
          </button>
        </div>
      </div>

      {/* Active Instances */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
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
              <div key={instance.instance_id} className="bg-dark-900/50 rounded-xl p-6 border-2 border-green-500/20">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Mensagens Enviadas:</p>
                    <p className="text-2xl font-bold text-green-400">{instance.sent_count}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Falhas:</p>
                    <p className="text-2xl font-bold text-red-400">{instance.failed_count}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Falhas Consecutivas:</p>
                    <p className={`text-2xl font-bold ${instance.consecutive_failures >= 5 ? 'text-red-400' : 'text-white'}`}>
                      {instance.consecutive_failures}
                    </p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Templates:</p>
                    <p className="text-2xl font-bold text-primary-400">{instance.templates.length}</p>
                  </div>
                </div>

                {instance.templates.length > 0 && (
                  <div className="bg-dark-800/30 rounded-lg p-4">
                    <p className="text-white/70 text-sm font-bold mb-2">Templates Associados:</p>
                    <div className="flex flex-wrap gap-2">
                      {instance.templates.map((template, idx) => (
                        <span key={idx} className="px-3 py-1 bg-primary-500/20 text-primary-300 rounded-lg text-sm border border-primary-500/30">
                          {template.template_name || `Template #${template.template_id}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {instance.consecutive_failures >= 3 && (
                  <div className="mt-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-300 font-bold text-sm">
                      ⚠️ Esta instância tem {instance.consecutive_failures} falhas consecutivas. Considere verificar a conexão.
                    </p>
                  </div>
                )}

                {instance.last_error && (
                  <div className="mt-4 bg-red-500/10 border-2 border-red-500/30 rounded-lg p-3">
                    <p className="text-red-300 text-sm">
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
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <FaTimesCircle className="text-red-400" />
            Instâncias Removidas ({removedInstances.length})
          </h3>

          <div className="space-y-4">
            {removedInstances.map((instance) => (
              <div key={instance.instance_id} className="bg-dark-900/50 rounded-xl p-6 border-2 border-red-500/20">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FaServer className="text-red-400 text-xl" />
                      <h4 className="text-xl font-bold text-white">{instance.instance_name}</h4>
                      <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm font-bold border border-red-500/30">
                        🚫 REMOVIDA
                      </span>
                    </div>
                    <p className="text-white/60 ml-8">{instance.phone_number}</p>
                  </div>

                  <button
                    onClick={() => handleAddInstance(instance.instance_id, instance.instance_name)}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border-2 border-green-500/40 rounded-xl font-bold transition-all duration-200 flex items-center gap-2"
                  >
                    <FaPlus /> Re-adicionar
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Mensagens Enviadas:</p>
                    <p className="text-2xl font-bold text-white">{instance.sent_count}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Falhas:</p>
                    <p className="text-2xl font-bold text-red-400">{instance.failed_count}</p>
                  </div>
                  <div className="bg-dark-800/50 rounded-lg p-3">
                    <p className="text-white/60 mb-1">Falhas Consecutivas:</p>
                    <p className="text-2xl font-bold text-red-400">{instance.consecutive_failures}</p>
                  </div>
                </div>

                {instance.last_error && (
                  <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-3">
                    <p className="text-red-300 text-sm">
                      <span className="font-bold">Motivo da remoção:</span> {instance.last_error}
                    </p>
                  </div>
                )}

                {instance.removed_at && (
                  <div className="mt-2 text-white/60 text-sm">
                    Removida em: {new Date(instance.removed_at).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-r from-primary-500/10 to-primary-600/5 border-2 border-primary-500/30 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">📊 Resumo</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/60 text-sm">Total de Instâncias:</p>
            <p className="text-3xl font-black text-white">{instances.length}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Ativas:</p>
            <p className="text-3xl font-black text-green-400">{activeInstances.length}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Removidas:</p>
            <p className="text-3xl font-black text-red-400">{removedInstances.length}</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Total Enviadas:</p>
            <p className="text-3xl font-black text-primary-400">
              {instances.reduce((sum, i) => sum + i.sent_count, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Close Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          className="px-8 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl font-bold transition-all duration-200 border-2 border-white/20"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}


