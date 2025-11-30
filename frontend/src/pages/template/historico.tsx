import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaSearch, FaTrash, FaSync, FaCalendar, FaFilter, FaCheckCircle, FaExclamationCircle, FaClock, FaShieldAlt, FaPause, FaPlay } from 'react-icons/fa';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import api from '../../services/api';

interface TemplateHistory {
  id: number;
  template_name: string;
  account_id: number;
  account_name: string;
  phone_number: string;
  status: string;
  category: string;
  type: string; // CREATE, DELETE, EDIT, CLONE
  created_at: string;
  error_message?: string;
  proxy_used: boolean;
  proxy_host?: string;
  proxy_type?: string;
  template_id?: string;
}

export default function HistoricoTemplates() {
  const router = useRouter();
  const toast = useToast();
  
  const [templates, setTemplates] = useState<TemplateHistory[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TemplateHistory[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [filterPeriod, setFilterPeriod] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false); // Desativado por padrão, ativa apenas se houver pendentes
  const [refreshing, setRefreshing] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadAccounts();
    loadTemplates();
  }, []);

  // Auto-refresh inteligente: atualiza a cada 3 segundos quando há pendentes
  useEffect(() => {
    if (!autoRefresh) return;

    console.log('🔄 Auto-refresh ativado - aguardando aprovação de', pendingCount, 'template(s)');
    
    const interval = setInterval(() => {
      setRefreshing(true);
      loadTemplates().finally(() => {
        setTimeout(() => setRefreshing(false), 500);
      });
    }, 3000); // 3 segundos quando há pendentes

    return () => {
      console.log('⏸️ Auto-refresh desativado - todos os templates processados');
      clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    applyFilters();
  }, [templates, filterPeriod, startDate, endDate, filterAccount, filterStatus, searchTerm]);

  const loadAccounts = async () => {
    try {
      const response = await api.get('/whatsapp-accounts');
      setAccounts(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      setAccounts([]);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Primeiro, atualizar os status buscando da API do WhatsApp
      try {
        console.log('🔄 Atualizando status dos templates da API do WhatsApp...');
        await api.post('/templates/history/update-statuses');
        console.log('✅ Status atualizados com sucesso!');
      } catch (updateError: any) {
        console.warn('⚠️ Erro ao atualizar status (não crítico):', updateError.message);
      }
      
      // Depois, buscar os dados atualizados
      const response = await api.get('/templates/history');
      const data = response.data || [];
      setTemplates(data);
      
      // Verificar se há templates pendentes ou na fila (aguardando aprovação do WhatsApp)
      const pending = data.filter((t: TemplateHistory) => 
        t.status === 'PENDING' || 
        t.status === 'pending' || 
        t.status === 'queued' ||
        t.status === 'processing'
      );
      
      console.log('📊 Status dos templates:', data.map((t: any) => ({ name: t.template_name, status: t.status, error: t.error_message })));
      
      const hasPendingTemplates = pending.length > 0;
      setHasPending(hasPendingTemplates);
      setPendingCount(pending.length);
      
      // Ativar/desativar auto-refresh baseado em pendentes
      setAutoRefresh(hasPendingTemplates);
      
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      toast.error(error.response?.data?.error || 'Erro ao carregar histórico de templates');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...templates];

    // Filtro de período
    if (filterPeriod !== 'custom') {
      const now = new Date();
      let startDateFilter = new Date();

      if (filterPeriod === 'today') {
        startDateFilter.setHours(0, 0, 0, 0);
      } else if (filterPeriod === '7days') {
        startDateFilter.setDate(now.getDate() - 7);
      } else if (filterPeriod === '30days') {
        startDateFilter.setDate(now.getDate() - 30);
      }

      filtered = filtered.filter(t => new Date(t.created_at) >= startDateFilter);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(t => {
        const date = new Date(t.created_at);
        return date >= start && date <= end;
      });
    }

    // Filtro por conta
    if (filterAccount && filterAccount !== 'all') {
      filtered = filtered.filter(t => t.account_id.toString() === filterAccount);
    }

    // Filtro por status (considerar variações maiúscula/minúscula)
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => {
        const status = t.status.toLowerCase();
        const filter = filterStatus.toLowerCase();
        
        if (filter === 'approved') {
          return status === 'approved' || status === 'completed';
        } else if (filter === 'pending') {
          return status === 'pending' || status === 'queued' || status === 'processing';
        } else if (filter === 'rejected' || filter === 'error') {
          return status === 'rejected' || status === 'error' || status === 'failed';
        }
        
        return status === filter;
      });
    }

    // Busca por nome
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.template_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleDelete = async (template: TemplateHistory) => {
    const confirmationMessage = `Tem certeza que deseja excluir o template "${template.template_name}" também lá na Meta?`;
    if (!confirm(confirmationMessage)) return;

    try {
      // Enviar para a fila de deleção (ou deletar imediatamente, dependendo do backend)
      const response = await api.delete(`/templates/${template.account_id}/${template.template_name}`, {
        data: { useQueue: true }
      });

      if (response.data?.queueId) {
        toast.success('Template enviado para a fila de exclusão. Aguarde o processamento.');
      } else {
        toast.success('Template excluído com sucesso!');
      }

      await loadTemplates();
    } catch (error: any) {
      console.error('Erro ao excluir template:', error);
      const backendError = error.response?.data?.error || 'Erro ao excluir template na Meta';
      toast.error(backendError);
    }
  };

  const setToday = () => {
    setFilterPeriod('today');
  };

  const getStatusBadge = (status: string) => {
    const badges: any = {
      // Status do WhatsApp
      'APPROVED': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40', icon: FaCheckCircle, label: 'Aprovado' },
      'approved': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40', icon: FaCheckCircle, label: 'Aprovado' },
      'PENDING': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', icon: FaClock, label: 'Pendente' },
      'pending': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', icon: FaClock, label: 'Pendente' },
      'REJECTED': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: FaExclamationCircle, label: 'Rejeitado' },
      'rejected': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: FaExclamationCircle, label: 'Rejeitado' },
      // Status de ações
      'DELETED': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', icon: FaCheckCircle, label: 'Deletado' },
      'CLONED': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', icon: FaCheckCircle, label: 'Clonado' },
      // Status de processamento
      'processing': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', icon: FaClock, label: 'Processando' },
      'queued': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', icon: FaClock, label: 'Na Fila' },
      // Status de erro
      'failed': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: FaExclamationCircle, label: 'Erro' },
      'error': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', icon: FaExclamationCircle, label: 'Erro' },
    };

    const badge = badges[status] || badges['pending'];
    const Icon = badge.icon;

    return (
      <div className={`px-4 py-2 rounded-lg ${badge.bg} ${badge.text} border-2 ${badge.border} flex items-center gap-2 font-bold text-sm`}>
        <Icon />
        {badge.label}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-8">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-5xl font-black text-white mb-2 flex items-center gap-4">
                📋 Histórico de Templates
              </h1>
              <p className="text-xl text-white/60 font-medium">
                Acompanhe todos os templates criados no sistema
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Indicador de status inteligente */}
              {hasPending ? (
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold bg-yellow-500/10 px-6 py-3 rounded-xl border-2 border-yellow-500/40">
                  <FaSync className="animate-spin text-xl" />
                  <div>
                    <div className="text-base">Aguardando aprovação...</div>
                    <div className="text-xs text-yellow-300/80">{pendingCount} template(s) pendente(s)</div>
                  </div>
                </div>
              ) : filteredTemplates.length > 0 ? (
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-500/10 px-6 py-3 rounded-xl border-2 border-green-500/40">
                  <FaCheckCircle className="text-xl" />
                  <div>
                    <div className="text-base">Todos processados!</div>
                    <div className="text-xs text-green-300/80">Nenhum template pendente</div>
                  </div>
                </div>
              ) : null}
              
              {/* Indicador quando está atualizando manualmente */}
              {!hasPending && refreshing && (
                <div className="flex items-center gap-2 text-blue-400 text-sm font-bold bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/30">
                  <FaSync className="animate-spin" />
                  Atualizando...
                </div>
              )}
              
              {/* Botão Atualizar Manual */}
              <button
                onClick={loadTemplates}
                disabled={loading}
                className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/40 flex items-center gap-3 disabled:opacity-50"
              >
                <FaSync className={loading ? 'animate-spin' : ''} />
                Atualizar Agora
              </button>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-6 mb-6 shadow-xl">
          <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
            <FaFilter />
            Filtros
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Busca por nome */}
            <div>
              <label className="text-white font-bold text-sm mb-2 block">🔍 Buscar por nome:</label>
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome do template..."
                  className="w-full pl-12 pr-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>
            </div>

            {/* Filtro de período */}
            <div>
              <label className="text-white font-bold text-sm mb-2 block">📅 Período:</label>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value as any)}
                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
              >
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
                <option value="custom">Período personalizado</option>
              </select>
            </div>

            {/* Filtro por conta */}
            <div>
              <label className="text-white font-bold text-sm mb-2 block">📱 Conta:</label>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
              >
                <option value="all">Todas as contas</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name || acc.phone_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por status */}
            <div>
              <label className="text-white font-bold text-sm mb-2 block">🎯 Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
              >
                <option value="all">Todos</option>
                <option value="APPROVED">Aprovados</option>
                <option value="PENDING">Pendentes</option>
                <option value="REJECTED">Rejeitados</option>
                <option value="error">Com Erro</option>
                <option value="queued">Na Fila</option>
              </select>
            </div>
          </div>

          {/* Datas personalizadas */}
          {filterPeriod === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-white font-bold text-sm mb-2 block">Data Início:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>
              <div>
                <label className="text-white font-bold text-sm mb-2 block">Data Fim:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/30 transition-all"
                />
              </div>
            </div>
          )}

          {/* Botões rápidos */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={setToday}
              className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-2 border-blue-500/40 rounded-lg font-bold transition-all flex items-center gap-2"
            >
              <FaCalendar />
              Hoje
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterPeriod('30days');
                setFilterAccount('all');
                setFilterStatus('all');
                setStartDate('');
                setEndDate('');
              }}
              className="px-6 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border-2 border-gray-500/40 rounded-lg font-bold transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* ESTATÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-2 border-blue-500/40 rounded-xl p-6">
            <div className="text-blue-300 text-sm font-bold mb-2">TOTAL</div>
            <div className="text-white text-4xl font-black">{filteredTemplates.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/40 rounded-xl p-6">
            <div className="text-green-300 text-sm font-bold mb-2">APROVADOS</div>
            <div className="text-white text-4xl font-black">
              {filteredTemplates.filter(t => 
                t.status === 'APPROVED' || 
                t.status === 'approved' || 
                t.status === 'completed'
              ).length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/40 rounded-xl p-6">
            <div className="text-yellow-300 text-sm font-bold mb-2">PENDENTES</div>
            <div className="text-white text-4xl font-black">
              {filteredTemplates.filter(t => 
                t.status === 'PENDING' || 
                t.status === 'pending' || 
                t.status === 'queued' || 
                t.status === 'processing'
              ).length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/40 rounded-xl p-6">
            <div className="text-red-300 text-sm font-bold mb-2">COM ERRO</div>
            <div className="text-white text-4xl font-black">
              {filteredTemplates.filter(t => 
                t.status === 'REJECTED' || 
                t.status === 'rejected' || 
                t.status === 'error' || 
                t.status === 'failed'
              ).length}
            </div>
          </div>
        </div>

        {/* TABELA */}
        <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center">
              <FaSync className="animate-spin text-6xl text-primary-500 mx-auto mb-4" />
              <p className="text-white text-xl font-bold">Carregando histórico...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-white/60 text-2xl font-bold">📭 Nenhum template encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-700/80 border-b-2 border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Template</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Operação</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Conta</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Data/Hora</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Categoria</th>
                    <th className="px-6 py-4 text-left text-sm font-black text-white uppercase">Proxy</th>
                    <th className="px-6 py-4 text-center text-sm font-black text-white uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className="hover:bg-white/5 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="text-white font-bold text-base">{template.template_name}</div>
                          {template.error_message && (
                            <div className="flex-shrink-0 px-3 py-1 bg-red-500 rounded-full">
                              <span className="text-white text-xs font-bold">🚫 ERRO</span>
                            </div>
                          )}
                        </div>
                        {template.error_message && (
                          <div className="mt-3 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl animate-pulse">
                            <div className="flex items-start gap-3">
                              <FaExclamationCircle className="text-red-400 text-2xl mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-red-300 font-black text-sm mb-2">
                                  ❌ ERRO AO CRIAR TEMPLATE - NÃO FOI ENVIADO AO WHATSAPP
                                </p>
                                <div className="p-3 bg-red-500/10 rounded-lg">
                                  <p className="text-red-200 text-xs font-semibold mb-1">📋 Motivo da rejeição:</p>
                                  <p className="text-red-100 text-xs leading-relaxed">
                                    {template.error_message.includes('example') || template.error_message.includes('campo(s) esperado')
                                      ? '⚠️ FALTOU PREENCHER OS EXEMPLOS DAS VARIÁVEIS! O WhatsApp exige que TODAS as variáveis ({{1}}, {{2}}, etc.) tenham exemplos preenchidos. Volte na criação do template e preencha todos os campos de exemplo das variáveis.'
                                      : template.error_message.includes('Invalid parameter')
                                      ? '⚠️ ERRO DE PARÂMETRO INVÁLIDO: Algum campo do template está incorreto ou faltando. Verifique: variáveis com exemplos, textos obrigatórios, formato de botões.'
                                      : template.error_message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const operationType = template.type?.toUpperCase() || 'CREATE';
                          const badges: any = {
                            'CREATE': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40', icon: '➕', label: 'Criado' },
                            'DELETE': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40', icon: '🗑️', label: 'Deletado' },
                            'EDIT': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40', icon: '✏️', label: 'Editado' },
                            'CLONE': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', icon: '📋', label: 'Clonado' },
                          };
                          const badge = badges[operationType] || badges['CREATE'];
                          return (
                            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm inline-flex items-center gap-2 border ${badge.bg} ${badge.text} ${badge.border}`}>
                              <span>{badge.icon}</span>
                              <span>{badge.label}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-semibold">{template.account_name}</div>
                        <div className="text-white/60 text-sm">{template.phone_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{formatDate(template.created_at)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(template.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`px-3 py-1 rounded-lg font-bold text-sm inline-block ${
                          template.category === 'MARKETING' 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}>
                          {template.category}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {template.proxy_used ? (
                          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                            <FaShieldAlt />
                            <div>
                              <div>Usado</div>
                              {template.proxy_host && (
                                <div className="text-xs text-white/60">{template.proxy_type}: {template.proxy_host}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-white/40 text-sm font-medium">Não usado</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(template)}
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-lg font-bold transition-all flex items-center gap-2 mx-auto"
                        >
                          <FaTrash />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

