import { useState, useEffect } from 'react';
import api from '../services/api';
import { FaDownload, FaTrash, FaTimes, FaCheck } from 'react-icons/fa';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import ToastContainer from '@/components/ToastContainer';

interface ButtonClick {
  id: number;
  phone_number: string;
  contact_name: string;
  button_text: string;
  button_payload: string;
  clicked_at: string;
  campaign_id: number | null;
  campaign_type: string | null;
  campaign_name: string | null;
  template_name: string | null;
  account_name: string | null;
  account_phone: string | null;
}

interface RankingItem {
  rank: number;
  button_text: string;
  button_payload: string;
  click_count: number;
  unique_contacts: number;
  campaigns_count: number;
  first_click: string;
  last_click: string;
}

interface Stats {
  total_clicks: number;
  unique_buttons: number;
  unique_contacts: number;
  campaigns_with_clicks: number;
  days_with_clicks: number;
}

export default function RelatorioCliques() {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [clicks, setClicks] = useState<ButtonClick[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [filters, setFilters] = useState({
    button_text: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadData();
    loadRanking();
    loadStats();
  }, [page, filters]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectAll(false);
  }, [page, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...filters,
      });

      const response = await api.get(`/button-clicks?${params}`);
      
      // Backend retorna { success: true, data: { clicks: [...], pagination: {...} } }
      if (response.data.success && response.data.data) {
        setClicks(response.data.data.clicks || []);
        setTotalPages(response.data.data.pagination?.totalPages || 1);
        setTotal(response.data.data.pagination?.total || 0);
      } else {
        setClicks([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Erro ao carregar cliques:', error);
      toast.error(error.response?.data?.error || 'Erro ao carregar cliques');
      setClicks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRanking = async () => {
    try {
      const params = new URLSearchParams({
        date_from: filters.date_from,
        date_to: filters.date_to,
      });

      const response = await api.get(`/button-clicks/ranking?${params}`);
      // Backend retorna { success: true, data: { ranking: [...] } }
      if (response.data.success && response.data.data) {
        setRanking(response.data.data.ranking || []);
      } else {
        setRanking([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar ranking:', error);
      setRanking([]); // Garantir que sempre seja array
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams({
        date_from: filters.date_from,
        date_to: filters.date_to,
      });

      const response = await api.get(`/button-clicks/stats?${params}`);
      if (response.data.success && response.data.data) {
        setStats(response.data.data);
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      setStats(null);
    }
  };

  const handleFilterToday = () => {
    const today = new Date().toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    setFilters({
      ...filters,
      date_from: today,
      date_to: today,
    });
    setPage(1); // Voltar para primeira página
  };

  const handleClearFilters = () => {
    setFilters({
      button_text: '',
      date_from: '',
      date_to: '',
    });
    setPage(1);
  };

  const handleExport = async () => {
    try {
      toast.info('Gerando arquivo Excel...');
      
      const params = new URLSearchParams(filters);
      const response = await api.get(`/button-clicks/export?${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cliques-botoes-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Relatório exportado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao exportar relatório');
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(clicks.map(click => click.id));
      setSelectAll(true);
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
      setSelectAll(false);
    } else {
      const newSelectedIds = [...selectedIds, id];
      setSelectedIds(newSelectedIds);
      if (newSelectedIds.length === clicks.length) {
        setSelectAll(true);
      }
    }
  };

  const handleDeleteOne = async (id: number) => {
    const confirmed = await confirm({
      title: '🗑️ Excluir Registro',
      message: 'Tem certeza que deseja excluir este registro?',
      type: 'danger',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/restriction-list/entries/${id}`);
      toast.success('✅ Registro excluído com sucesso!');
      loadData();
      loadRanking();
      setSelectedIds([]);
      setSelectAll(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || '❌ Erro ao excluir registro');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.warning('⚠️ Selecione pelo menos um registro para excluir');
      return;
    }

    const confirmed = await confirm({
      title: '🗑️ Excluir Múltiplos Registros',
      message: `Tem certeza que deseja excluir ${selectedIds.length} registro(s)?`,
      type: 'danger',
      confirmText: `Sim, Excluir ${selectedIds.length}`,
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    try {
      await api.delete(`/restriction-list/entries/bulk`, {
        data: { ids: selectedIds },
      });
      toast.success(`✅ ${selectedIds.length} registro(s) excluído(s) com sucesso!`);
      loadData();
      loadRanking();
      setSelectedIds([]);
      setSelectAll(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || '❌ Erro ao excluir registros');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRankingIcon = (index: number) => {
    const icons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return icons[index] || '•';
  };

  if (loading && clicks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mb-4"></div>
          <p className="text-2xl text-white/70">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      
      {/* Modal de Confirmação Elegante */}
      <ConfirmDialog />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* CABEÇALHO PRINCIPAL */}
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600/30 via-cyan-500/20 to-cyan-600/30 backdrop-blur-xl border-2 border-cyan-500/40 rounded-3xl p-10 shadow-2xl shadow-cyan-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative flex items-center gap-6">
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-2xl shadow-lg shadow-cyan-500/50">
                <span className="text-6xl">📊</span>
              </div>
              <div>
                <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                  Relatório de Cliques em Botões
                </h1>
                <p className="text-2xl text-white/80 font-medium">
                  Analise todos os cliques recebidos de todas as contas
                </p>
              </div>
            </div>
          </div>

          {/* CARDS DE ESTATÍSTICAS */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-2 border-cyan-500/30 rounded-2xl p-6 shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">👆</span>
                  <h3 className="text-xl font-black text-white">Total de Cliques</h3>
                </div>
                <p className="text-5xl font-black text-cyan-300">{stats.total_clicks}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 rounded-2xl p-6 shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">👥</span>
                  <h3 className="text-xl font-black text-white">Contatos Únicos</h3>
                </div>
                <p className="text-5xl font-black text-purple-300">{stats.unique_contacts}</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/30 rounded-2xl p-6 shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">🔘</span>
                  <h3 className="text-xl font-black text-white">Botões Únicos</h3>
                </div>
                <p className="text-5xl font-black text-yellow-300">{stats.unique_buttons}</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6 shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">📢</span>
                  <h3 className="text-xl font-black text-white">Campanhas</h3>
                </div>
                <p className="text-5xl font-black text-green-300">{stats.campaigns_with_clicks}</p>
              </div>

              <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 border-2 border-pink-500/30 rounded-2xl p-6 shadow-xl hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl">📅</span>
                  <h3 className="text-xl font-black text-white">Dias Ativos</h3>
                </div>
                <p className="text-5xl font-black text-pink-300">{stats.days_with_clicks}</p>
              </div>
            </div>
          )}

          {/* RANKING TOP 5 */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-yellow-500/20 p-4 rounded-2xl">
                <span className="text-5xl">🏆</span>
              </div>
              <div>
                <h2 className="text-4xl font-black text-white">Top 5 Botões Mais Clicados</h2>
                <p className="text-xl text-white/70 mt-1 font-medium">Ranking dos botões com mais interações</p>
              </div>
            </div>

            {ranking.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">📭</div>
                <p className="text-2xl text-white/70 font-medium">Nenhum clique registrado ainda</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-5 gap-6">
                {ranking.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-primary-500/20 to-primary-600/10 border-2 border-primary-500/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 hover:border-primary-500/50 shadow-lg"
                  >
                    <div className="text-center mb-4">
                      <span className="text-6xl">{getRankingIcon(index)}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-black text-xl mb-4 line-clamp-2 min-h-[56px]">{item.button_text}</p>
                      <div className="bg-primary-500/30 rounded-xl py-4 px-4 mb-4 border-2 border-primary-500/40">
                        <p className="text-5xl font-black text-primary-300 mb-1">{item.click_count}</p>
                        <p className="text-white/70 text-base font-bold">cliques</p>
                      </div>
                      <p className="text-white/70 text-base font-medium">
                        {item.unique_contacts} número{item.unique_contacts > 1 ? 's' : ''} único{item.unique_contacts > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FILTROS E AÇÕES */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-8 shadow-xl">
            <div className="flex flex-wrap gap-6 items-end mb-8">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-xl font-black text-white mb-3">
                  🔍 Buscar Botão
                </label>
                <input
                  type="text"
                  value={filters.button_text}
                  onChange={(e) => setFilters({ ...filters, button_text: e.target.value })}
                  placeholder="Ex: BLOQUEAR CONTATO"
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xl font-black text-white mb-3">
                  📅 Data Inicial
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xl font-black text-white mb-3">
                  📅 Data Final
                </label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-white/20 rounded-xl text-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleFilterToday}
                  className="px-6 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/50 flex items-center gap-2 whitespace-nowrap"
                  title="Filtrar apenas hoje"
                >
                  📅 Hoje
                </button>
                
                <button
                  onClick={handleClearFilters}
                  className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-lg font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"
                  title="Limpar todos os filtros"
                >
                  <FaTimes className="text-xl" />
                  Limpar
                </button>
              </div>

              <button
                onClick={handleExport}
                disabled={loading || total === 0}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/50 flex items-center gap-3 whitespace-nowrap disabled:opacity-50"
              >
                <FaDownload className="text-xl" />
                Exportar Excel
              </button>

              {selectedIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-red-500/50 flex items-center gap-3 whitespace-nowrap"
                >
                  <FaTrash className="text-xl" />
                  Excluir ({selectedIds.length})
                </button>
              )}
            </div>

            <div className="flex gap-8 pt-8 border-t-2 border-white/10">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6 flex-1">
                <p className="text-white/70 text-lg font-medium mb-2">Total de Cliques</p>
                <p className="text-5xl font-black text-blue-300">{total}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 rounded-2xl p-6 flex-1">
                <p className="text-white/70 text-lg font-medium mb-2">Botões Únicos</p>
                <p className="text-5xl font-black text-purple-300">{ranking.length}</p>
              </div>
              {selectedIds.length > 0 && (
                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-2 border-cyan-500/30 rounded-2xl p-6 flex-1">
                  <p className="text-white/70 text-lg font-medium mb-2">Selecionados</p>
                  <p className="text-5xl font-black text-cyan-300">{selectedIds.length}</p>
                </div>
              )}
            </div>
          </div>

          {/* TABELA DE CLIQUES */}
          <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-8 border-b-2 border-white/10">
              <h3 className="text-4xl font-black text-white flex items-center gap-3">
                <span className="text-5xl">📋</span>
                Lista de Cliques ({total})
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mb-4"></div>
                <p className="text-xl text-white/70">Carregando...</p>
              </div>
            ) : clicks.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-6">📭</div>
                <p className="text-2xl text-white/70 font-medium mb-3">Nenhum clique encontrado</p>
                <p className="text-lg text-white/50">Os cliques em botões aparecerão aqui</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-primary-600/20 to-primary-700/20 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-5 text-center">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={handleSelectAll}
                            className="w-6 h-6 rounded border-2 border-white/20 bg-dark-700 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Data/Hora
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Telefone
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Botão Clicado
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Campanha
                        </th>
                        <th className="px-6 py-5 text-left text-base font-black text-white uppercase tracking-wider">
                          Conta
                        </th>
                        <th className="px-6 py-5 text-center text-base font-black text-white uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {clicks.map((click) => (
                        <tr
                          key={click.id}
                          className={`hover:bg-white/5 transition-colors ${selectedIds.includes(click.id) ? 'bg-primary-500/10' : ''}`}
                        >
                          <td className="px-6 py-5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(click.id)}
                              onChange={() => handleSelectOne(click.id)}
                              className="w-6 h-6 rounded border-2 border-white/20 bg-dark-700 text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-base text-white font-medium">
                            {formatDate(click.clicked_at)}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-base text-white font-mono font-bold">
                            {click.phone_number}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-base text-white font-medium">
                            {click.contact_name}
                          </td>
                          <td className="px-6 py-5 text-base">
                            <span className="bg-primary-500/20 text-primary-300 px-4 py-2 rounded-xl font-bold border-2 border-primary-500/30 inline-block">
                              {click.button_text}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-base text-white/80 font-medium">
                            {click.campaign_name || '-'}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-base text-white/70 font-medium">
                            {click.account_name}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <button
                              onClick={() => handleDeleteOne(click.id)}
                              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border-2 border-red-500/40 rounded-xl transition-all duration-200 font-bold"
                              title="Excluir"
                            >
                              <FaTrash className="text-lg" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-8 py-6 border-t-2 border-white/10">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="px-8 py-4 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:text-white/30 text-white text-lg font-bold rounded-xl transition-all border-2 border-white/20 disabled:border-white/10"
                    >
                      ← Anterior
                    </button>

                    <span className="text-white text-xl font-bold">
                      Página {page} de {totalPages}
                    </span>

                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="px-8 py-4 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:text-white/30 text-white text-lg font-bold rounded-xl transition-all border-2 border-white/20 disabled:border-white/10"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
      `}</style>
    </>
  );
}
