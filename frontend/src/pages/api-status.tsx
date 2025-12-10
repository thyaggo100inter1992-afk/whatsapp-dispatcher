import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaWhatsapp, FaEnvelope, FaClock, FaChartLine, FaSync, FaShieldAlt
} from 'react-icons/fa';
import api from '@/services/api';

interface AccountStatus {
  id: number;
  name: string;
  phone_number: string;
  is_active: boolean;
  
  // Estatísticas
  messages_sent_today: number;
  
  // Qualidade da conta
  quality_score: 'GREEN' | 'YELLOW' | 'RED' | 'FLAGGED' | 'UNKNOWN';
  
  // Status da API
  api_connected: boolean;
  api_last_check: string | null;
  
  // Webhook
  webhook_active: boolean;
  webhook_last_received: string | null;
  
  // Último erro
  last_error: string | null;
  last_error_at: string | null;
}

export default function ApiStatus() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadAccountsStatus();
  }, []);

  // Auto-refresh a cada 30 segundos se ativado
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadAccountsStatus(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadAccountsStatus = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get('/whatsapp-accounts/status');
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Erro ao carregar status das contas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'GREEN': return 'text-green-400 border-green-500/40 bg-green-500/10';
      case 'YELLOW': return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
      case 'RED': return 'text-red-400 border-red-500/40 bg-red-500/10';
      case 'FLAGGED': return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
      default: return 'text-gray-400 border-gray-500/40 bg-gray-500/10';
    }
  };

  const getQualityText = (quality: string) => {
    switch (quality) {
      case 'GREEN': return '✅ Excelente';
      case 'YELLOW': return '⚠️ Atenção';
      case 'RED': return '❌ Crítico';
      case 'FLAGGED': return '🚩 Sinalizada';
      default: return '❓ Desconhecido';
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    return `Há ${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <FaSync className="text-6xl text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-xl text-white/70">Carregando status das contas...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Status das Contas API - WhatsApp Dispatcher</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-8">
        <div className="max-w-[1800px] mx-auto">
          {/* HEADER */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/configuracoes')}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
            >
              <FaArrowLeft />
              Voltar para Configurações
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
                  <FaShieldAlt className="text-cyan-400" />
                  Status das Contas API
                </h1>
                <p className="text-lg text-white/60">
                  Monitoramento em tempo real de todas as contas WhatsApp Business API
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                    autoRefresh
                      ? 'bg-green-500/20 border-2 border-green-500/40 text-green-300'
                      : 'bg-dark-700 border-2 border-white/20 text-white/70'
                  }`}
                >
                  <FaSync className={autoRefresh ? 'animate-spin' : ''} />
                  {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
                </button>

                <button
                  onClick={() => loadAccountsStatus(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border-2 border-cyan-500/40 text-cyan-300 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  <FaSync className={refreshing ? 'animate-spin' : ''} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {/* RESUMO RÁPIDO */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-dark-800/60 border-2 border-white/10 rounded-xl p-6">
              <div className="text-white/60 text-sm font-bold mb-2">TOTAL DE CONTAS</div>
              <div className="text-4xl font-black text-white">{accounts.length}</div>
            </div>

            <div className="bg-dark-800/60 border-2 border-green-500/40 rounded-xl p-6">
              <div className="text-green-300 text-sm font-bold mb-2">ATIVAS</div>
              <div className="text-4xl font-black text-green-400">
                {accounts.filter(a => a.is_active).length}
              </div>
            </div>

            <div className="bg-dark-800/60 border-2 border-cyan-500/40 rounded-xl p-6">
              <div className="text-cyan-300 text-sm font-bold mb-2">CONECTADAS</div>
              <div className="text-4xl font-black text-cyan-400">
                {accounts.filter(a => a.api_connected).length}
              </div>
            </div>

            <div className="bg-dark-800/60 border-2 border-blue-500/40 rounded-xl p-6">
              <div className="text-blue-300 text-sm font-bold mb-2">MENSAGENS HOJE</div>
              <div className="text-4xl font-black text-blue-400">
                {accounts.reduce((sum, a) => sum + a.messages_sent_today, 0)}
              </div>
            </div>
          </div>

          {/* GRID DE CARDS DAS CONTAS */}
          {accounts.length === 0 ? (
            <div className="bg-dark-800/60 border-2 border-white/10 rounded-2xl p-20 text-center">
              <div className="text-6xl mb-6">📭</div>
              <p className="text-2xl text-white/70 font-medium">
                Nenhuma conta configurada ainda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 hover:border-cyan-500/40 transition-all duration-200 shadow-xl hover:shadow-cyan-500/20"
                >
                  {/* HEADER DO CARD */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        account.is_active ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">
                          {account.name}
                        </h3>
                        <p className="text-sm text-white/60 truncate">
                          {account.phone_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* QUALIDADE DA CONTA */}
                  <div className={`border-2 rounded-xl p-4 mb-4 ${getQualityColor(account.quality_score)}`}>
                    <div className="text-xs font-bold mb-1 opacity-70">QUALIDADE</div>
                    <div className="text-lg font-black">
                      {getQualityText(account.quality_score)}
                    </div>
                  </div>

                  {/* MENSAGENS ENVIADAS HOJE */}
                  <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-blue-300 font-bold mb-1">MENSAGENS HOJE</div>
                        <div className="text-2xl font-black text-blue-400">
                          {account.messages_sent_today}
                        </div>
                      </div>
                      <FaEnvelope className="text-3xl text-blue-400 opacity-50" />
                    </div>
                  </div>

                  {/* STATUS DA API */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Status da API:</span>
                      <div className="flex items-center gap-2">
                        {account.api_connected ? (
                          <>
                            <FaCheckCircle className="text-green-400" />
                            <span className="text-sm font-bold text-green-400">Conectada</span>
                          </>
                        ) : (
                          <>
                            <FaTimesCircle className="text-red-400" />
                            <span className="text-sm font-bold text-red-400">Desconectada</span>
                          </>
                        )}
                      </div>
                    </div>

                    {account.api_last_check && (
                      <div className="text-xs text-white/40">
                        Última verificação: {formatRelativeTime(account.api_last_check)}
                      </div>
                    )}
                  </div>

                  {/* STATUS DO WEBHOOK */}
                  <div className="bg-dark-700/60 border-2 border-white/10 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/60 font-bold">WEBHOOK:</span>
                      <div className="flex items-center gap-2">
                        {account.webhook_active ? (
                          <>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-green-400">ATIVO</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-400 rounded-full" />
                            <span className="text-xs font-bold text-red-400">INATIVO</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <FaClock />
                      <span>Último recebido: {formatRelativeTime(account.webhook_last_received)}</span>
                    </div>
                  </div>

                  {/* ÚLTIMO ERRO */}
                  {account.last_error && (
                    <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <FaExclamationTriangle className="text-red-400 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-red-300 font-bold mb-1">ÚLTIMO ERRO:</div>
                          <div className="text-xs text-red-300/80 break-words">
                            {account.last_error}
                          </div>
                          <div className="text-xs text-red-300/60 mt-2">
                            {formatDateTime(account.last_error_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

