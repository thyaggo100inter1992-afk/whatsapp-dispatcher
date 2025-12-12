import React, { useState, useEffect, useRef } from 'react';
import { FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaCog, FaList, FaRedo, FaEdit, FaExclamationTriangle, FaTrash } from 'react-icons/fa';
import { useConfirm } from '@/hooks/useConfirm';
import api from '@/services/api';

interface QueueItem {
  id: string;
  type: 'create' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  templateName: string;
  accountPhone: string;
  error?: string;
  createdAt: string;
}

interface FailureItem {
  id: number;
  queue_id: string;
  type: 'create' | 'delete';
  status: string;
  whatsapp_account_id: number;
  template_name: string;
  template_data: any;
  error_message: string;
  created_at: string;
  processed_at: string;
  account_phone: string;
  account_name: string;
}

interface QueueStatus {
  total: number;
  processing: number;
  pending: number;
  isProcessing: boolean;
  interval: number;
  items: QueueItem[];
}

interface TemplateQueueProps {
  onClose?: () => void;
  toast?: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
  };
}

export const TemplateQueue: React.FC<TemplateQueueProps> = ({ onClose, toast: externalToast }) => {
  const { confirm, ConfirmDialog } = useConfirm();
  
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [newInterval, setNewInterval] = useState<number>(5);
  const [updating, setUpdating] = useState(false);
  const [intervalInitialized, setIntervalInitialized] = useState(false);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [showFailures, setShowFailures] = useState(false);
  const [editingFailure, setEditingFailure] = useState<number | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const hasPermissionRef = useRef(true);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fazer primeira requisição
    fetchQueueStatus();
    fetchFailures();
    
    // Criar intervalo
    intervalIdRef.current = setInterval(() => {
      // Verificar se ainda tem permissão antes de fazer requisição
      if (!hasPermissionRef.current) {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        return;
      }
      fetchQueueStatus();
      fetchFailures();
    }, 2000);
    
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);

  const fetchQueueStatus = async () => {
    // Verificar permissão antes de fazer requisição
    if (!hasPermissionRef.current) return;
    
    try {
      const response = await api.get('/templates/queue/status');
      const data = response.data;
      if (data.success) {
        setQueueStatus(data.queue);
        // Só define o newInterval na primeira vez para não sobrescrever o que o usuário está digitando
        if (!intervalInitialized) {
          setNewInterval(data.queue.interval);
          setIntervalInitialized(true);
        }
      }
    } catch (error: any) {
      // Se for 403, significa que não tem permissão
      if (error.response?.status === 403) {
        // Desabilitar polling IMEDIATAMENTE
        hasPermissionRef.current = false;
        // Parar o intervalo
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        // Setar um status vazio para não ficar em loading infinito
        setQueueStatus({
          total: 0,
          processing: 0,
          pending: 0,
          isProcessing: false,
          interval: 5,
          items: []
        });
      } else {
        console.error('Erro ao buscar status da fila:', error);
      }
    }
  };

  const fetchFailures = async () => {
    // Verificar permissão antes de fazer requisição
    if (!hasPermissionRef.current) return;
    
    try {
      const response = await api.get('/templates/queue/failures');
      const data = response.data;
      if (data.success) {
        setFailures(data.failures);
      }
    } catch (error: any) {
      // Se for 403, significa que não tem permissão
      if (error.response?.status === 403) {
        // Desabilitar polling IMEDIATAMENTE
        hasPermissionRef.current = false;
        // Parar o intervalo
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        setFailures([]);
      } else {
        console.error('Erro ao buscar falhas:', error);
      }
    }
  };

  const updateInterval = async () => {
    setUpdating(true);
    try {
      const response = await api.post('/templates/queue/interval', { seconds: newInterval });
      const data = response.data;
      if (data.success) {
        if (externalToast) {
          externalToast.success(`Intervalo atualizado para ${newInterval} segundos`);
        }
        fetchQueueStatus();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao atualizar intervalo: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <FaClock className="text-yellow-400" />;
      case 'processing':
        return <FaSpinner className="text-blue-400 animate-spin" />;
      case 'completed':
        return <FaCheckCircle className="text-green-400" />;
      case 'failed':
        return <FaTimesCircle className="text-red-400" />;
      default:
        return <FaClock className="text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Aguardando';
      case 'processing':
        return 'Processando';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  };

  const getTypeText = (type: string) => {
    return type === 'create' ? 'Criar' : 'Deletar';
  };

  const getTypeColor = (type: string) => {
    return type === 'create' ? 'text-green-400' : 'text-red-400';
  };

  const retryFailure = async (historyId: number, newName?: string) => {
    setRetrying(true);
    try {
      const response = await api.post(`/templates/queue/retry/${historyId}`, {
        newTemplateName: newName || undefined,
      });
      const data = response.data;
      if (data.success) {
        if (externalToast) {
          externalToast.success(`Template adicionado à fila! (${data.queue.total} na fila, intervalo: ${data.queue.interval}s)`);
        }
        setEditingFailure(null);
        setNewTemplateName('');
        fetchQueueStatus();
        fetchFailures();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao re-tentar: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setRetrying(false);
    }
  };

  const retryAllFailures = async () => {
    const confirmed = await confirm({
      title: '🔄 Retentar Templates Falhados',
      message: `Tem certeza que deseja re-tentar TODOS os ${failures.length} templates que falharam?`,
      type: 'warning',
      confirmText: `Sim, Retentar ${failures.length}`,
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    setRetrying(true);
    try {
      const response = await api.post('/templates/queue/retry-all');
      const data = response.data;
      if (data.success) {
        if (externalToast) {
          externalToast.success(`${data.total} template(s) adicionado(s) à fila! (Total: ${data.queue.total}, Intervalo: ${data.queue.interval}s)`);
        }
        fetchQueueStatus();
        fetchFailures();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao re-tentar: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setRetrying(false);
    }
  };

  const cancelQueue = async () => {
    const confirmed = await confirm({
      title: '🛑 Cancelar Fila de Templates',
      message: `Tem certeza que deseja CANCELAR a criação de ${queueStatus?.pending || 0} templates pendentes?\n\n⚠️ Os templates que já estão sendo processados serão concluídos.\n\n❌ Os templates pendentes serão removidos da fila.`,
      type: 'danger',
      confirmText: `Sim, Cancelar ${queueStatus?.pending || 0} Templates`,
      cancelText: 'Voltar'
    });
    
    if (!confirmed) return;

    setCancelling(true);
    try {
      const response = await api.post('/templates/queue/cancel');
      const data = response.data;
      if (data.success) {
        if (externalToast) {
          externalToast.success(`✅ ${data.cancelled} template(s) removido(s) da fila!`);
        }
        fetchQueueStatus();
      } else {
        if (externalToast) {
          externalToast.error('Erro ao cancelar fila: ' + data.error);
        }
      }
    } catch (error: any) {
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setCancelling(false);
    }
  };

  const clearAllFailures = async () => {
    const confirmed = await confirm({
      title: '🗑️ Limpar Templates com Erro',
      message: `Tem certeza que deseja REMOVER PERMANENTEMENTE os ${failures.length} templates que falharam do histórico?\n\n⚠️ ATENÇÃO: Esta ação não pode ser desfeita!\n\n💡 Se esses templates falharam, provavelmente eles NÃO foram criados no WhatsApp, então é seguro removê-los do histórico.`,
      type: 'danger',
      confirmText: `Sim, Limpar ${failures.length}`,
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    setRetrying(true);
    console.log(`🗑️ Iniciando limpeza de ${failures.length} templates com erro...`);
    
    try {
      // Deletar cada template do histórico
      let successCount = 0;
      let errorCount = 0;

      for (const failure of failures) {
        try {
          console.log(`🗑️ Deletando template ${failure.template_name} (ID: ${failure.id})...`);
          const response = await api.delete(`/templates/history/${failure.id}`);
          console.log(`✅ Template ${failure.template_name} deletado com sucesso:`, response.data);
          successCount++;
        } catch (error: any) {
          console.error(`❌ Erro ao remover template ${failure.template_name} (ID: ${failure.id}) do histórico:`, error);
          console.error('   Detalhes do erro:', error.response?.data);
          errorCount++;
        }
      }

      console.log(`📊 Resultado: ${successCount} sucesso, ${errorCount} erros`);

      if (successCount > 0) {
        if (externalToast) {
          externalToast.success(`✅ ${successCount} template(s) com erro removido(s) do histórico!`);
        }
        fetchFailures(); // Atualizar a lista
      }
      
      if (errorCount > 0) {
        if (externalToast) {
          externalToast.error(`❌ Erro ao remover ${errorCount} template(s)`);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro geral ao limpar histórico:', error);
      if (externalToast) {
        externalToast.error('Erro: ' + error.message);
      }
    } finally {
      setRetrying(false);
    }
  };

  if (!queueStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <FaSpinner className="text-blue-400 text-3xl animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <FaList className="mr-3 text-blue-400" />
          Fila de Templates
        </h2>
        <div className="flex items-center gap-3">
          {/* Botão Cancelar Fila */}
          {queueStatus.pending > 0 && (
            <button
              onClick={cancelQueue}
              disabled={cancelling}
              className="btn bg-red-600 hover:bg-red-700 text-white border-red-500 flex items-center gap-2"
            >
              {cancelling ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <FaTimesCircle />
                  Cancelar Fila ({queueStatus.pending})
                </>
              )}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary">
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-500/50">
          <div className="text-blue-300 text-sm mb-1">Total na Fila</div>
          <div className="text-3xl font-bold text-white">{queueStatus.total}</div>
        </div>

        <div className="card bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-500/50">
          <div className="text-yellow-300 text-sm mb-1">Aguardando</div>
          <div className="text-3xl font-bold text-white">{queueStatus.pending}</div>
        </div>

        <div className="card bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/50">
          <div className="text-purple-300 text-sm mb-1">Processando</div>
          <div className="text-3xl font-bold text-white">{queueStatus.processing}</div>
        </div>

        <div className="card bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-500/50">
          <div className="text-green-300 text-sm mb-1">Intervalo</div>
          <div className="text-3xl font-bold text-white">{queueStatus.interval}s</div>
        </div>
      </div>

      {/* Configuração de Intervalo */}
      <div className="card bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <FaCog className="mr-2 text-purple-400" />
          Configurar Intervalo entre Templates
        </h3>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-white/70 text-sm mb-2">
              Tempo de espera entre cada operação (segundos)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={newInterval}
              onChange={(e) => setNewInterval(parseInt(e.target.value) || 1)}
              className="input w-full"
            />
            <p className="text-white/50 text-xs mt-1">
              💡 Recomendado: 5-10 segundos para evitar bloqueios
            </p>
          </div>

          <button
            onClick={updateInterval}
            disabled={updating || newInterval === queueStatus.interval}
            className={`btn btn-primary self-end ${
              updating || newInterval === queueStatus.interval ? 'opacity-50' : ''
            }`}
          >
            {updating ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Atualizando...
              </>
            ) : (
              <>
                <FaCog className="mr-2" />
                Atualizar
              </>
            )}
          </button>
        </div>

        {queueStatus.isProcessing && (
          <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="text-blue-300 text-sm flex items-center">
              <FaSpinner className="animate-spin mr-2" />
              Fila em processamento... O intervalo será aplicado ao próximo item.
            </div>
          </div>
        )}
      </div>

      {/* Lista de Items */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4">
          Items na Fila ({queueStatus.items.length})
        </h3>

        {queueStatus.items.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <FaCheckCircle className="text-5xl mx-auto mb-3 text-green-400/50" />
            <div className="text-lg">Fila vazia</div>
            <div className="text-sm">Todos os templates foram processados</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {queueStatus.items.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  item.status === 'pending'
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : item.status === 'processing'
                    ? 'bg-blue-900/20 border-blue-500/50 animate-pulse'
                    : item.status === 'completed'
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-red-900/20 border-red-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1">
                    <div className="mt-1 mr-3">{getStatusIcon(item.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-lg">
                          #{index + 1}
                        </span>
                        <span className={`font-bold ${getTypeColor(item.type)}`}>
                          {getTypeText(item.type)}
                        </span>
                        <span className="text-white font-mono">
                          {item.templateName}
                        </span>
                      </div>
                      <div className="text-white/70 text-sm space-y-1">
                        <div>📱 Conta: {item.accountPhone}</div>
                        <div>📊 Status: {getStatusText(item.status)}</div>
                        {item.error && (
                          <div className="text-red-300 mt-2 p-2 bg-red-900/30 rounded">
                            ❌ Erro: {item.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Falhas Recentes */}
      {failures.length > 0 && (
        <div className="card bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-500/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              <FaExclamationTriangle className="mr-2 text-red-400" />
              Templates que Falharam ({failures.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFailures(!showFailures)}
                className="btn btn-secondary text-sm"
              >
                {showFailures ? 'Ocultar' : 'Mostrar'}
              </button>
              {failures.length > 0 && (
                <>
                <button
                  onClick={retryAllFailures}
                  disabled={retrying}
                  className="btn btn-primary text-sm"
                >
                  <FaRedo className="mr-1" />
                  Re-tentar Todos
                </button>
                  <button
                    onClick={clearAllFailures}
                    disabled={retrying}
                    className="btn bg-red-600 hover:bg-red-700 text-white border-red-500 text-sm"
                  >
                    <FaTrash className="mr-1" />
                    Limpar Histórico
                  </button>
                </>
              )}
            </div>
          </div>

          {showFailures && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {failures.map((failure) => (
                <div
                  key={failure.id}
                  className="p-4 bg-red-900/20 border-2 border-red-500/50 rounded-lg"
                >
                  {editingFailure === failure.id ? (
                    // Modo de edição
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-red-300">
                          Editar e Re-tentar
                        </div>
                        <button
                          onClick={() => {
                            setEditingFailure(null);
                            setNewTemplateName('');
                          }}
                          className="text-white/50 hover:text-white"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div>
                        <label className="block text-white/70 text-sm mb-1">
                          Novo Nome do Template
                        </label>
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => {
                            const formatted = e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, '_')
                              .replace(/[^a-z0-9_]/g, '');
                            setNewTemplateName(formatted);
                          }}
                          placeholder={failure.template_name}
                          className="input w-full"
                        />
                        <p className="text-xs text-white/50 mt-1">
                          Deixe vazio para usar o nome original
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => retryFailure(failure.id, newTemplateName || undefined)}
                          disabled={retrying}
                          className="flex-1 btn btn-primary"
                        >
                          {retrying ? (
                            <>
                              <FaSpinner className="animate-spin mr-2" />
                              Re-tentando...
                            </>
                          ) : (
                            <>
                              <FaRedo className="mr-2" />
                              Re-tentar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FaTimesCircle className="text-red-400" />
                            <span className="font-bold text-white text-lg">
                              {failure.type === 'create' ? 'CRIAR' : 'DELETAR'}
                            </span>
                            <span className="text-white font-mono">
                              {failure.template_name}
                            </span>
                          </div>
                          <div className="text-white/70 text-sm space-y-1 mb-2">
                            <div>📱 Conta: {failure.account_phone}</div>
                            <div className="text-red-300">
                              ❌ {failure.error_message}
                            </div>
                            <div className="text-white/50 text-xs">
                              {new Date(failure.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            setEditingFailure(failure.id);
                            setNewTemplateName('');
                          }}
                          className="btn btn-secondary text-sm flex-1"
                        >
                          <FaEdit className="mr-1" />
                          Editar e Re-tentar
                        </button>
                        <button
                          onClick={() => retryFailure(failure.id)}
                          disabled={retrying}
                          className="btn btn-primary text-sm flex-1"
                        >
                          <FaRedo className="mr-1" />
                          Re-tentar Mesmo Nome
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
        <div className="text-blue-300 text-sm space-y-1">
          <div>💡 <strong>Dica:</strong> A fila processa um template por vez</div>
          <div>⏱️ Aguarda {queueStatus.interval} segundos entre cada operação</div>
          <div>🔒 Isso evita bloqueios da API do WhatsApp</div>
          {failures.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-500/30">
              <div>🔄 <strong>Templates com erro:</strong> Você pode editá-los e re-tentar!</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
    </div>
  );
};

