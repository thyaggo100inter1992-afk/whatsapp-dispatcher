import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import api from '@/services/api';
import { ToastContainer, useToast } from '@/components/Toast';

interface DadosRelatorio {
  success: boolean;
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
  resumo_geral: {
    tenants_com_pagamento: number;
    tenants_sem_pagamento: number;
    tenants_ativos: number;
    tenants_inativos: number;
    valor_recebido: number;
    valor_pendente: number;
    quantidade_pagamentos: number;
    quantidade_pendentes: number;
    ticket_medio: number;
  };
  tenants: {
    por_status: Array<{
      status: string;
      quantidade: number;
    }>;
    ativos: number;
    inativos: number;
  };
  consultas_avulsas: {
    quantidade_compras: number;
    valor_total: number;
    total_consultas_compradas: number;
    tenants_que_compraram: number;
    ticket_medio: number;
  };
  consultas_realizadas: {
    total: number;
    avulsas_usadas: number;
    plano_usadas: number;
    tenants_que_consultaram: number;
  };
  breakdown_pagamentos: Array<{
    tipo_cobranca: string;
    quantidade: number;
    valor_total: number;
    tenants_distintos: number;
  }>;
  planos_mais_vendidos: Array<{
    plano_nome: string;
    quantidade_vendas: number;
    receita_total: number;
    tenants_distintos: number;
  }>;
  top_tenants: Array<{
    id: number;
    nome: string;
    email: string;
    quantidade_pagamentos: number;
    valor_total_gasto: number;
  }>;
  formas_pagamento: Array<{
    forma: string;
    quantidade: number;
    valor_total: number;
  }>;
  receita_diaria: Array<{
    data: string;
    quantidade_pagamentos: number;
    valor_total: number;
  }>;
}

export default function RelatoriosFinanceiros() {
  const { notifications, showNotification, removeNotification } = useToast();
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    // Definir período padrão (mês atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    setDataInicio(primeiroDia.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) {
      buscarDados();
    }
  }, [dataInicio, dataFim]);

  const buscarDados = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/relatorios-financeiros/dashboard', {
        params: { data_inicio: dataInicio, data_fim: dataFim }
      });
      setDados(response.data);
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      showNotification('❌ Erro ao carregar relatório', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async () => {
    try {
      setExportando(true);
      const response = await api.get('/admin/relatorios-financeiros/exportar', {
        params: { data_inicio: dataInicio, data_fim: dataFim },
        responseType: 'blob'
      });

      // Criar link para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-financeiro-${dataInicio}-${dataFim}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('✅ Relatório exportado!', 'success');
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      showNotification('❌ Erro ao exportar', 'error');
    } finally {
      setExportando(false);
    }
  };

  const definirPeriodoRapido = (tipo: 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano') => {
    const hoje = new Date();
    let inicio = new Date();

    switch (tipo) {
      case 'hoje':
        inicio = hoje;
        break;
      case 'semana':
        inicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case 'trimestre':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
        break;
      case 'ano':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        break;
    }

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(hoje.toISOString().split('T')[0]);
  };

  if (loading && !dados) {
    return (
      <AdminLayout 
        title="Relatórios Financeiros" 
        subtitle="Dashboard completo de rendimentos e métricas de todos os tenantes"
        currentPage="relatorios-financeiros"
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-white">Carregando relatório financeiro...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Relatórios Financeiros" 
      subtitle="Dashboard completo de rendimentos e métricas de todos os tenantes"
      currentPage="relatorios-financeiros"
    >
      <div className="max-w-7xl mx-auto">

        {/* FILTROS DE PERÍODO */}
        <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-white">🗓️ Filtrar Período</h2>
          
          {/* Botões de Período Rápido */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => definirPeriodoRapido('hoje')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
            >
              Hoje
            </button>
            <button
              onClick={() => definirPeriodoRapido('semana')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
            >
              Última Semana
            </button>
            <button
              onClick={() => definirPeriodoRapido('mes')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
            >
              Este Mês
            </button>
            <button
              onClick={() => definirPeriodoRapido('trimestre')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
            >
              Último Trimestre
            </button>
            <button
              onClick={() => definirPeriodoRapido('ano')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition"
            >
              Este Ano
            </button>
          </div>

          {/* Filtro Customizado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={buscarDados}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
              >
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
              <button
                onClick={exportarCSV}
                disabled={exportando || !dados}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                title="Exportar para CSV"
              >
                📥 {exportando ? 'Exportando...' : 'CSV'}
              </button>
            </div>
          </div>
        </div>

        {dados && (
          <>
            {/* CARDS DE RESUMO GERAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">💰 Valor Recebido</h3>
                  <span className="text-2xl">💵</span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  R$ {dados.resumo_geral.valor_recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm opacity-80">
                  {dados.resumo_geral.quantidade_pagamentos} pagamentos confirmados
                </p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">⏳ Valor Pendente</h3>
                  <span className="text-2xl">⏰</span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  R$ {dados.resumo_geral.valor_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm opacity-80">
                  {dados.resumo_geral.quantidade_pendentes} pagamentos pendentes
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">✅ Tenants Pagaram</h3>
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {dados.resumo_geral.tenants_com_pagamento}
                </p>
                <p className="text-sm opacity-80">
                  Clientes com pagamento no período
                </p>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">❌ Tenants Sem Pagar</h3>
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {dados.resumo_geral.tenants_sem_pagamento}
                </p>
                <p className="text-sm opacity-80">
                  Clientes sem pagamento no período
                </p>
              </div>
            </div>

            {/* SEGUNDA LINHA DE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">💳 Ticket Médio</h3>
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-3xl font-bold">
                  R$ {dados.resumo_geral.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">✅ Tenants Ativos</h3>
                  <span className="text-2xl">🟢</span>
                </div>
                <p className="text-3xl font-bold">
                  {dados.resumo_geral.tenants_ativos}
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium opacity-90">⛔ Tenants Inativos</h3>
                  <span className="text-2xl">🔴</span>
                </div>
                <p className="text-3xl font-bold">
                  {dados.resumo_geral.tenants_inativos}
                </p>
              </div>
            </div>

            {/* SEÇÃO DE TENANTS POR STATUS */}
            <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">👥 Status dos Tenants</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dados.tenants.por_status.map((item) => (
                  <div key={item.status} className="border-2 border-gray-600 bg-gray-700 rounded-lg p-4 hover:shadow-lg transition">
                    <div className="text-sm font-medium text-gray-300 capitalize mb-1">
                      {item.status === 'active' && '🟢 Ativos'}
                      {item.status === 'trial' && '🔵 Trial'}
                      {item.status === 'blocked' && '🔴 Bloqueados'}
                      {item.status === 'cancelled' && '⚫ Cancelados'}
                      {item.status === 'deleted' && '❌ Deletados'}
                      {!['active', 'trial', 'blocked', 'cancelled', 'deleted'].includes(item.status) && item.status}
                    </div>
                    <div className="text-3xl font-bold text-white">{item.quantidade}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO DE CONSULTAS AVULSAS */}
            <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">🛒 Consultas Avulsas (Recargas)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border-2 border-emerald-500 bg-emerald-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Quantidade de Compras</p>
                  <p className="text-3xl font-bold text-emerald-400">{dados.consultas_avulsas.quantidade_compras}</p>
                </div>
                <div className="border-2 border-green-500 bg-green-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Valor Total Recebido</p>
                  <p className="text-3xl font-bold text-green-400">
                    R$ {dados.consultas_avulsas.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="border-2 border-blue-500 bg-blue-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Consultas Compradas</p>
                  <p className="text-3xl font-bold text-blue-400">{dados.consultas_avulsas.total_consultas_compradas}</p>
                </div>
                <div className="border-2 border-purple-500 bg-purple-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Tenants Compraram</p>
                  <p className="text-3xl font-bold text-purple-400">{dados.consultas_avulsas.tenants_que_compraram}</p>
                </div>
              </div>
            </div>

            {/* SEÇÃO DE CONSULTAS REALIZADAS */}
            <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">📋 Consultas Realizadas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border-2 border-indigo-500 bg-indigo-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Total de Consultas</p>
                  <p className="text-3xl font-bold text-indigo-400">{dados.consultas_realizadas.total}</p>
                </div>
                <div className="border-2 border-purple-500 bg-purple-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Consultas Avulsas Usadas</p>
                  <p className="text-3xl font-bold text-purple-400">{dados.consultas_realizadas.avulsas_usadas}</p>
                </div>
                <div className="border-2 border-blue-500 bg-blue-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Consultas do Plano Usadas</p>
                  <p className="text-3xl font-bold text-blue-400">{dados.consultas_realizadas.plano_usadas}</p>
                </div>
                <div className="border-2 border-teal-500 bg-teal-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 mb-1">Tenants Consultaram</p>
                  <p className="text-3xl font-bold text-teal-400">{dados.consultas_realizadas.tenants_que_consultaram}</p>
                </div>
              </div>
            </div>

            {/* BREAKDOWN POR TIPO DE PAGAMENTO */}
            <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">💰 Breakdown por Tipo de Cobrança</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Quantidade</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Tenants</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {dados.breakdown_pagamentos.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-700 transition">
                        <td className="px-4 py-3 capitalize font-medium text-white">
                          {item.tipo_cobranca === 'consultas_avulsas' && '🛒 Consultas Avulsas'}
                          {item.tipo_cobranca === 'upgrade' && '⬆️ Upgrade de Plano'}
                          {item.tipo_cobranca === 'renovacao' && '🔄 Renovação'}
                          {!['consultas_avulsas', 'upgrade', 'renovacao'].includes(item.tipo_cobranca) && `📦 ${item.tipo_cobranca || 'Outros'}`}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{item.quantidade}</td>
                        <td className="px-4 py-3 text-gray-300">{item.tenants_distintos}</td>
                        <td className="px-4 py-3 font-bold text-green-400">
                          R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {dados.breakdown_pagamentos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          Nenhum pagamento encontrado no período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PLANOS MAIS VENDIDOS */}
            {dados.planos_mais_vendidos.length > 0 && (
              <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">🏆 Planos Mais Vendidos</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Plano</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Vendas</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Tenants</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Receita Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {dados.planos_mais_vendidos.map((plano, index) => (
                        <tr key={index} className="hover:bg-gray-700 transition">
                          <td className="px-4 py-3 font-medium text-white">{plano.plano_nome}</td>
                          <td className="px-4 py-3 text-gray-300">{plano.quantidade_vendas}</td>
                          <td className="px-4 py-3 text-gray-300">{plano.tenants_distintos}</td>
                          <td className="px-4 py-3 font-bold text-green-400">
                            R$ {plano.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TOP 10 TENANTS */}
            {dados.top_tenants.length > 0 && (
              <div className="bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">🥇 Top 10 Clientes que Mais Gastaram</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Nome</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Pagamentos</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200">Total Gasto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {dados.top_tenants.map((tenant, index) => (
                        <tr key={tenant.id} className="hover:bg-gray-700 transition">
                          <td className="px-4 py-3 text-white font-bold">
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                            {index > 2 && `${index + 1}º`}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">{tenant.nome}</td>
                          <td className="px-4 py-3 text-gray-300 text-sm">{tenant.email}</td>
                          <td className="px-4 py-3 text-gray-300">{tenant.quantidade_pagamentos}</td>
                          <td className="px-4 py-3 font-bold text-green-400">
                            R$ {tenant.valor_total_gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FORMAS DE PAGAMENTO */}
            {dados.formas_pagamento.length > 0 && (
              <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">💳 Formas de Pagamento</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dados.formas_pagamento.map((forma, index) => (
                    <div key={index} className="border-2 border-gray-600 bg-gray-700 rounded-lg p-4 hover:shadow-lg transition">
                      <div className="text-sm font-medium text-gray-300 mb-1">
                        {forma.forma === 'PIX' && '📱 PIX'}
                        {forma.forma === 'BOLETO' && '🎫 Boleto'}
                        {forma.forma === 'CREDIT_CARD' && '💳 Cartão de Crédito'}
                        {!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(forma.forma) && forma.forma}
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        R$ {forma.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-400">{forma.quantidade} transações</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}

