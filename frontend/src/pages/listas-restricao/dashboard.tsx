import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface WhatsAppAccount {
  id: number;
  name: string;
}

interface DashboardStats {
  list_type: string;
  whatsapp_account_id: number;
  total_entries: number;
  added_last_24h: number;
  added_last_7d: number;
  added_last_30d: number;
  expiring_soon: number;
  by_method: {
    manual: number;
    webhook_button: number;
    webhook_keyword: number;
    import: number;
  };
  timeline: Array<{
    date: string;
    added: number;
  }>;
}

interface Overview {
  accounts: Array<{
    account_id: number;
    account_name: string;
    lists: {
      do_not_disturb: { total: number; added_today: number };
      blocked: { total: number; added_today: number; expiring_soon: number };
      not_interested: { total: number; added_today: number; expiring_soon: number };
    };
  }>;
  global_totals: {
    do_not_disturb: number;
    blocked: number;
    not_interested: number;
  };
}

export default function RestrictionDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedListType, setSelectedListType] = useState<string>('blocked');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAccount && selectedListType) {
      loadStats();
    }
  }, [selectedAccount, selectedListType]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar overview
      const overviewResponse = await axios.get(`${API_URL}/restriction-lists/stats/overview`);
      setOverview(overviewResponse.data);

      // Carregar contas
      const accountsResponse = await axios.get(`${API_URL}/whatsapp-accounts/active`);
      const accountsData = Array.isArray(accountsResponse.data) ? accountsResponse.data : [];
      setAccounts(accountsData);

      // Selecionar primeira conta por padrão
      if (accountsData.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsData[0].id.toString());
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setAccounts([]); // Garantir que accounts sempre seja um array
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/restriction-lists/stats/dashboard?list_type=${selectedListType}&whatsapp_account_id=${selectedAccount}`
      );
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard - Listas de Restrição</h1>
            <p className="text-gray-600 mt-2">Estatísticas e análises das listas</p>
          </div>
          <a
            href="/listas-restricao"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            ← Voltar para Listas
          </a>
        </div>

        {/* Totais Globais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-100 text-sm font-medium">Não Me Perturbe</p>
                <p className="text-4xl font-bold mt-2">{overview?.global_totals.do_not_disturb || 0}</p>
                <p className="text-red-100 text-xs mt-2">Permanente</p>
              </div>
              <div className="bg-red-400 bg-opacity-30 rounded-full p-3">
                <span className="text-3xl">🔕</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-sm font-medium">Bloqueado</p>
                <p className="text-4xl font-bold mt-2">{overview?.global_totals.blocked || 0}</p>
                <p className="text-orange-100 text-xs mt-2">365 dias</p>
              </div>
              <div className="bg-orange-400 bg-opacity-30 rounded-full p-3">
                <span className="text-3xl">🚫</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Sem Interesse</p>
                <p className="text-4xl font-bold mt-2">{overview?.global_totals.not_interested || 0}</p>
                <p className="text-yellow-100 text-xs mt-2">7 dias</p>
              </div>
              <div className="bg-yellow-400 bg-opacity-30 rounded-full p-3">
                <span className="text-3xl">👎</span>
              </div>
            </div>
          </div>
        </div>

        {/* Por Conta */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Detalhes por Conta</h2>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Conta WhatsApp
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Não Me Perturbe
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Bloqueado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Sem Interesse
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overview?.accounts.map((account) => {
                    const total =
                      account.lists.do_not_disturb.total +
                      account.lists.blocked.total +
                      account.lists.not_interested.total;
                    
                    return (
                      <tr key={account.account_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {account.account_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-lg font-semibold text-red-600">
                            {account.lists.do_not_disturb.total}
                          </div>
                          {account.lists.do_not_disturb.added_today > 0 && (
                            <div className="text-xs text-gray-500">
                              +{account.lists.do_not_disturb.added_today} hoje
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-lg font-semibold text-orange-600">
                            {account.lists.blocked.total}
                          </div>
                          <div className="text-xs text-gray-500">
                            {account.lists.blocked.added_today > 0 && `+${account.lists.blocked.added_today} hoje`}
                            {account.lists.blocked.expiring_soon > 0 && (
                              <span className="text-red-600 font-semibold ml-2">
                                {account.lists.blocked.expiring_soon} expirando
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-lg font-semibold text-yellow-600">
                            {account.lists.not_interested.total}
                          </div>
                          <div className="text-xs text-gray-500">
                            {account.lists.not_interested.added_today > 0 && `+${account.lists.not_interested.added_today} hoje`}
                            {account.lists.not_interested.expiring_soon > 0 && (
                              <span className="text-red-600 font-semibold ml-2">
                                {account.lists.not_interested.expiring_soon} expirando
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-lg font-bold text-gray-900">{total}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Análise Detalhada */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Análise Detalhada</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conta WhatsApp
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lista
                </label>
                <select
                  value={selectedListType}
                  onChange={(e) => setSelectedListType(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="do_not_disturb">Não Me Perturbe</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="not_interested">Sem Interesse</option>
                </select>
              </div>
            </div>

            {stats && (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-blue-600 text-xs font-medium mb-1">Total</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total_entries}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-green-600 text-xs font-medium mb-1">Últimas 24h</p>
                    <p className="text-2xl font-bold text-green-900">+{stats.added_last_24h}</p>
                  </div>

                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                    <p className="text-indigo-600 text-xs font-medium mb-1">Últimos 7 dias</p>
                    <p className="text-2xl font-bold text-indigo-900">+{stats.added_last_7d}</p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-purple-600 text-xs font-medium mb-1">Últimos 30 dias</p>
                    <p className="text-2xl font-bold text-purple-900">+{stats.added_last_30d}</p>
                  </div>

                  {stats.expiring_soon > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-red-600 text-xs font-medium mb-1">Expirando</p>
                      <p className="text-2xl font-bold text-red-900">{stats.expiring_soon}</p>
                      <p className="text-red-600 text-xs mt-1">próximos 7 dias</p>
                    </div>
                  )}
                </div>

                {/* Métodos de Adição */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Métodos de Adição</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-3xl mb-2">✋</div>
                      <p className="text-2xl font-bold text-gray-900">{stats.by_method.manual}</p>
                      <p className="text-sm text-gray-600">Manual</p>
                      <div className="mt-2 bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 rounded-full h-2"
                          style={{
                            width: `${(stats.by_method.manual / stats.total_entries) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl mb-2">🔘</div>
                      <p className="text-2xl font-bold text-gray-900">{stats.by_method.webhook_button}</p>
                      <p className="text-sm text-gray-600">Botão</p>
                      <div className="mt-2 bg-purple-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 rounded-full h-2"
                          style={{
                            width: `${(stats.by_method.webhook_button / stats.total_entries) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl mb-2">💬</div>
                      <p className="text-2xl font-bold text-gray-900">{stats.by_method.webhook_keyword}</p>
                      <p className="text-sm text-gray-600">Palavra-chave</p>
                      <div className="mt-2 bg-green-200 rounded-full h-2">
                        <div
                          className="bg-green-600 rounded-full h-2"
                          style={{
                            width: `${(stats.by_method.webhook_keyword / stats.total_entries) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl mb-2">📥</div>
                      <p className="text-2xl font-bold text-gray-900">{stats.by_method.import}</p>
                      <p className="text-sm text-gray-600">Importação</p>
                      <div className="mt-2 bg-gray-300 rounded-full h-2">
                        <div
                          className="bg-gray-600 rounded-full h-2"
                          style={{
                            width: `${(stats.by_method.import / stats.total_entries) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline (simples) */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Evolução (Últimos 30 dias)</h3>
                  <div className="space-y-2">
                    {stats.timeline.slice(0, 10).map((day, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="text-sm text-gray-600 w-24">
                          {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                          <div
                            className="bg-blue-500 rounded-full h-6 flex items-center justify-end pr-2"
                            style={{
                              width: `${Math.min((day.added / Math.max(...stats.timeline.map(t => t.added))) * 100, 100)}%`,
                            }}
                          >
                            {day.added > 0 && (
                              <span className="text-white text-xs font-semibold">+{day.added}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Link para Configurações */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white text-center">
          <h3 className="text-xl font-bold mb-2">Configurar Palavras-Chave</h3>
          <p className="mb-4">
            Configure palavras-chave e botões para adicionar contatos automaticamente nas listas
          </p>
          <a
            href="/listas-restricao/configuracoes"
            className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            Ir para Configurações →
          </a>
        </div>
      </div>
    </Layout>
  );
}

