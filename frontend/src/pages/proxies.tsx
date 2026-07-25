import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { FaGlobe, FaPlus, FaEdit, FaTrash, FaFlask, FaCheckCircle, FaTimesCircle, FaClock, FaSave, FaTimes, FaArrowLeft, FaUsers, FaExchangeAlt, FaPhone, FaCheckSquare, FaSquare, FaSearch, FaListUl } from 'react-icons/fa';
import api from '@/services/api';

interface ProxyPoolItem {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

interface BulkProxyRow {
  key: string;
  name: string;
  type: 'socks5' | 'http';
  host: string;
  port: string;
  username: string;
  password: string;
  raw: string;
  valid: boolean;
  error?: string;
}

interface Account {
  id: number;
  name: string;
  phone_number: string;
  status: string;
  is_active: boolean;
}

interface Proxy {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  location?: string;
  description?: string;
  status: string;
  last_check?: string;
  last_ip?: string;
  is_active: boolean;
  accounts_count?: number;
  created_at: string;
  rotation_interval?: number; // Em minutos
  proxy_pool?: ProxyPoolItem[]; // Para proxies rotativos
  current_proxy_index?: number; // Qual proxy do pool está ativo
}

/**
 * Parseia string completa de proxy nos formatos comuns dos provedores:
 * - host:port
 * - host:port:user:pass
 * - user:pass@host:port
 * - socks5://user:pass@host:port
 * - user:pass:host:port
 */
function parseProxyString(raw: string): {
  type?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
} | null {
  if (!raw || typeof raw !== 'string') return null;
  // Remove espaços, labels do provedor (HTTP Proxy / SOCKS5 Proxy) e lixo
  let value = raw
    .replace(/https?\s*proxy\s*:?/gi, '')
    .replace(/socks5?\s*proxy\s*:?/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!value) return null;

  let type: string | undefined;

  // Detectar tipo pela porta padrão IPBR se vier na string
  // 10000 = SOCKS5, 10001 = HTTP (formato do painel IPBR)
  const schemeMatch = value.match(/^(socks5h?|https?):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    type = scheme.startsWith('socks') ? 'socks5' : scheme;
    value = value.replace(/^[a-z0-9]+:\/\//i, '');
  }

  // user:pass@host:port
  if (value.includes('@')) {
    const atIdx = value.lastIndexOf('@');
    const creds = value.slice(0, atIdx);
    const hostPort = value.slice(atIdx + 1);
    const colonCred = creds.indexOf(':');
    if (colonCred === -1) return null;
    const username = creds.slice(0, colonCred);
    const password = creds.slice(colonCred + 1);
    const lastColon = hostPort.lastIndexOf(':');
    if (lastColon === -1) return null;
    const host = sanitizeHost(hostPort.slice(0, lastColon));
    const port = hostPort.slice(lastColon + 1).trim();
    if (!host || !/^\d+$/.test(port)) return null;
    if (!type) type = port === '10001' ? 'http' : port === '10000' ? 'socks5' : undefined;
    return { type, host, port, username, password };
  }

  const parts = value.split(':').filter((p) => p.length > 0);

  // host:port
  if (parts.length === 2) {
    const host = sanitizeHost(parts[0]);
    const port = parts[1].trim();
    if (!host || !/^\d+$/.test(port)) return null;
    if (!type) type = port === '10001' ? 'http' : port === '10000' ? 'socks5' : undefined;
    return { type, host, port };
  }

  // Formato IPBR e maioria dos provedores: host:port:user:pass
  if (parts.length >= 4) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();
    const p3 = parts.slice(3).join(':').trim();

    // host:port:user:pass
    if (/^\d+$/.test(p1) && !/^\d+$/.test(p0)) {
      if (!type) type = p1 === '10001' ? 'http' : p1 === '10000' ? 'socks5' : undefined;
      return { type, host: sanitizeHost(p0), port: p1, username: p2, password: p3 };
    }

    // user:pass:host:port
    if (/^\d+$/.test(p3) && !/^\d+$/.test(p0)) {
      if (!type) type = p3 === '10001' ? 'http' : p3 === '10000' ? 'socks5' : undefined;
      return { type, username: p0, password: p1, host: sanitizeHost(p2), port: p3 };
    }
  }

  return null;
}

function sanitizeHost(host: string): string {
  return (host || '')
    .trim()
    .replace(/^:+|:+$/g, '')
    .replace(/\.ipbr\.prox$/i, '.ipbr.pro')
    .replace(/\.ipbr\.pr$/i, '.ipbr.pro');
}

function applyParsedProxy(
  parsed: NonNullable<ReturnType<typeof parseProxyString>>,
  prev: { name: string; type: string; host: string; port: string; username: string; password: string; location: string; description: string; is_active: boolean; rotation_interval: number; proxy_pool: ProxyPoolItem[] }
) {
  return {
    ...prev,
    host: sanitizeHost(parsed.host || ''),
    port: parsed.port || '',
    username: parsed.username || prev.username,
    password: parsed.password || prev.password,
    type: parsed.type || prev.type,
  };
}

export default function ProxiesPage() {
  const router = useRouter();
  const { toasts, removeToast, success, error, info, warning } = useToast();
  const toast = { success, error, info, warning }; // Para manter compatibilidade
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // States para seleção de contas no modal de criar/editar
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAllAccounts, setLoadingAllAccounts] = useState(false);
  const [selectedAccountsForProxy, setSelectedAccountsForProxy] = useState<number[]>([]);
  const [accountSearch, setAccountSearch] = useState('');

  // States para Ver Contas
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [proxyAccounts, setProxyAccounts] = useState<Account[]>([]);
  const [viewingProxy, setViewingProxy] = useState<Proxy | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // States para Transferir Contas
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetProxyId, setTransferTargetProxyId] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [transferring, setTransferring] = useState(false);

  // States para importação em lote
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRawText, setBulkRawText] = useState('');
  const [bulkDefaultType, setBulkDefaultType] = useState<'socks5' | 'http'>('socks5');
  const [bulkNamePrefix, setBulkNamePrefix] = useState('PROXY');
  const [bulkRows, setBulkRows] = useState<BulkProxyRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'socks5',
    host: '',
    port: '',
    username: '',
    password: '',
    location: '',
    description: '',
    is_active: true,
    rotation_interval: 30, // Minutos
    proxy_pool: [] as ProxyPoolItem[]
  });

  // Temporary states for adding proxies to pool
  const [poolHost, setPoolHost] = useState('');
  const [poolPort, setPoolPort] = useState('');
  const [poolUsername, setPoolUsername] = useState('');
  const [poolPassword, setPoolPassword] = useState('');

  useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/proxies');
      if (response.data.success) {
        setProxies(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar proxies:', error);
      toast.error('Erro ao carregar proxies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (proxy?: Proxy) => {
    if (proxy) {
      setEditingProxy(proxy);
      setFormData({
        name: proxy.name,
        type: proxy.type,
        host: proxy.host,
        port: proxy.port.toString(),
        username: proxy.username || '',
        password: proxy.password || '',
        location: proxy.location || '',
        description: proxy.description || '',
        is_active: proxy.is_active,
        rotation_interval: proxy.rotation_interval || 30,
        proxy_pool: proxy.proxy_pool || []
      });
    } else {
      setEditingProxy(null);
      setFormData({
        name: '',
        type: 'socks5',
        host: '',
        port: '',
        username: '',
        password: '',
        location: '',
        description: '',
        is_active: true,
        rotation_interval: 30,
        proxy_pool: []
      });
    }
    // Reset pool form
    setPoolHost('');
    setPoolPort('');
    setPoolUsername('');
    setPoolPassword('');
    setAccountSearch('');
    setSelectedAccountsForProxy([]);

    // Carregar lista de contas
    setLoadingAllAccounts(true);
    setShowModal(true);
    try {
      const [accountsResp, proxyAccountsResp] = await Promise.all([
        api.get('/whatsapp-accounts'),
        proxy ? api.get(`/proxies/${proxy.id}/accounts`) : Promise.resolve({ data: { data: [] } })
      ]);
      if (accountsResp.data.success || Array.isArray(accountsResp.data)) {
        const list: Account[] = accountsResp.data.data || accountsResp.data || [];
        setAllAccounts(list);
      }
      // Pré-selecionar contas que já usam este proxy
      if (proxy && proxyAccountsResp.data.success) {
        setSelectedAccountsForProxy(proxyAccountsResp.data.data.map((a: Account) => a.id));
      }
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
    } finally {
      setLoadingAllAccounts(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProxy(null);
    setAllAccounts([]);
    setSelectedAccountsForProxy([]);
    setAccountSearch('');
  };

  const handleOpenBulkModal = () => {
    setBulkRawText('');
    setBulkDefaultType('socks5');
    setBulkNamePrefix('PROXY');
    setBulkRows([]);
    setShowBulkModal(true);
  };

  const handleCloseBulkModal = () => {
    if (bulkSaving) return;
    setShowBulkModal(false);
    setBulkRawText('');
    setBulkRows([]);
  };

  const buildBulkPreview = () => {
    const lines = bulkRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if (lines.length === 0) {
      toast.error('Cole pelo menos uma linha de proxy');
      return;
    }

    const prefix = (bulkNamePrefix || 'PROXY').trim() || 'PROXY';
    const pad = String(lines.length).length;

    const rows: BulkProxyRow[] = lines.map((line, index) => {
      // Opcional: nome|host:port:user:pass
      let nameFromLine = '';
      let proxyPart = line;
      if (line.includes('|')) {
        const pipeIdx = line.indexOf('|');
        nameFromLine = line.slice(0, pipeIdx).trim();
        proxyPart = line.slice(pipeIdx + 1).trim();
      }

      const parsed = parseProxyString(proxyPart);
      const autoName = `${prefix} ${String(index + 1).padStart(Math.max(pad, 2), '0')}`;

      if (!parsed?.host || !parsed?.port) {
        return {
          key: `bulk-${index}-${Date.now()}`,
          name: nameFromLine || autoName,
          type: bulkDefaultType,
          host: '',
          port: '',
          username: '',
          password: '',
          raw: line,
          valid: false,
          error: 'Formato não reconhecido. Use host:porta:usuario:senha',
        };
      }

      return {
        key: `bulk-${index}-${Date.now()}`,
        name: nameFromLine || autoName,
        type: bulkDefaultType, // tipo escolhido pelo usuário — não detecta automaticamente
        host: sanitizeHost(parsed.host),
        port: parsed.port,
        username: parsed.username || '',
        password: parsed.password || '',
        raw: line,
        valid: true,
      };
    });

    setBulkRows(rows);
    const ok = rows.filter((r) => r.valid).length;
    const bad = rows.length - ok;
    toast.success(`Prévia gerada: ${ok} válida(s)${bad ? `, ${bad} com erro` : ''}. Edite antes de criar.`);
  };

  const updateBulkRow = (key: string, patch: Partial<BulkProxyRow>) => {
    setBulkRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        const hostOk = !!(next.host || '').trim();
        const portOk = /^\d+$/.test(String(next.port || ''));
        const nameOk = !!(next.name || '').trim();
        next.valid = hostOk && portOk && nameOk;
        next.error = !nameOk
          ? 'Nome obrigatório'
          : !hostOk
            ? 'Host obrigatório'
            : !portOk
              ? 'Porta inválida'
              : undefined;
        return next;
      })
    );
  };

  const removeBulkRow = (key: string) => {
    setBulkRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleBulkCreate = async () => {
    const validRows = bulkRows.filter((r) => r.valid && r.name.trim() && r.host.trim() && r.port);
    if (validRows.length === 0) {
      toast.error('Nenhuma linha válida para criar. Gere a prévia e corrija os erros.');
      return;
    }

    const names = validRows.map((r) => r.name.trim());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      toast.error(`Nomes duplicados na lista: ${[...new Set(dupes)].join(', ')}`);
      return;
    }

    setBulkSaving(true);
    try {
      const response = await api.post('/proxies/bulk', {
        proxies: validRows.map((r) => ({
          name: r.name.trim(),
          type: r.type,
          host: r.host.trim(),
          port: parseInt(r.port, 10),
          username: r.username || undefined,
          password: r.password || undefined,
        })),
      });

      if (!response.data.success) {
        toast.error(response.data.error || 'Falha ao criar proxies');
        return;
      }

      const { createdCount, errorCount, errors } = response.data.data;
      if (createdCount > 0) {
        toast.success(`${createdCount} proxy(s) criado(s) com sucesso!`);
      }
      if (errorCount > 0) {
        const sample = (errors || [])
          .slice(0, 3)
          .map((e: any) => `${e.name || `#${e.index + 1}`}: ${e.error}`)
          .join(' | ');
        toast.error(`${errorCount} falha(s): ${sample}`);
      }

      await loadProxies();
      if (errorCount === 0) {
        setShowBulkModal(false);
        setBulkRawText('');
        setBulkRows([]);
      } else {
        const createdNames = new Set(
          (response.data.data.created || []).map((c: any) => String(c.name || '').trim())
        );
        setBulkRows((prev) => prev.filter((r) => !createdNames.has(r.name.trim())));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Erro ao criar proxies em lote');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleAddToPool = () => {
    if (!poolHost || !poolPort) {
      toast.error('Host e porta são obrigatórios');
      return;
    }

    const newProxy: ProxyPoolItem = {
      host: poolHost,
      port: parseInt(poolPort),
      username: poolUsername || undefined,
      password: poolPassword || undefined
    };

    setFormData({
      ...formData,
      proxy_pool: [...formData.proxy_pool, newProxy]
    });

    // Reset pool form
    setPoolHost('');
    setPoolPort('');
    setPoolUsername('');
    setPoolPassword('');
    toast.success('✅ Proxy adicionado ao pool!');
  };

  const handleRemoveFromPool = (index: number) => {
    setFormData({
      ...formData,
      proxy_pool: formData.proxy_pool.filter((_, i) => i !== index)
    });
    toast.info('🗑️ Proxy removido do pool');
  };

  const handleSave = async () => {
    try {
      // Validações
      if (formData.type === 'rotating') {
        if (formData.proxy_pool.length === 0) {
          toast.error('Adicione pelo menos 1 proxy ao pool para rotação');
          return;
        }
      } else {
        if (!formData.host || !formData.port) {
          toast.error('Host e porta são obrigatórios');
          return;
        }
      }

      const payload: any = {
        ...formData,
        port: formData.type === 'rotating' ? 0 : parseInt(formData.port) || 0,
        host: formData.type === 'rotating' ? '' : formData.host,
        rotation_interval: formData.type === 'rotating' ? formData.rotation_interval : null,
        proxy_pool: formData.type === 'rotating' ? formData.proxy_pool : null
      };

      // Em edição, senha em branco = manter a atual (não enviar vazia)
      if (editingProxy && !String(formData.password || '').trim()) {
        delete payload.password;
      }

      let response;
      if (editingProxy) {
        response = await api.put(`/proxies/${editingProxy.id}`, payload);
      } else {
        response = await api.post('/proxies', payload);
      }

      if (response.data.success) {
        const savedProxyId = response.data.data?.id || editingProxy?.id;
        // Atribuir contas selecionadas ao proxy
        if (savedProxyId && selectedAccountsForProxy.length > 0) {
          try {
            await api.post(`/proxies/${savedProxyId}/assign-accounts`, {
              account_ids: selectedAccountsForProxy
            });
          } catch (err) {
            console.error('Erro ao atribuir contas ao proxy:', err);
          }
        }
        toast.success(editingProxy ? '✅ Proxy atualizado!' : '✅ Proxy criado!');
        handleCloseModal();
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao salvar proxy');
      }
    } catch (error) {
      console.error('Erro ao salvar proxy:', error);
      toast.error('Erro ao salvar proxy');
    }
  };

  const handleDelete = async (id: number, name: string, accountsCount: number) => {
    if (accountsCount > 0) {
      toast.error(`Este proxy está sendo usado por ${accountsCount} conta(s). Remova das contas antes de deletar.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar o proxy "${name}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/proxies/${id}`);

      if (response.data.success) {
        toast.success('🗑️ Proxy deletado!');
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao deletar proxy');
      }
    } catch (error) {
      console.error('Erro ao deletar proxy:', error);
      toast.error('Erro ao deletar proxy');
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      // Backend tem hard timeout 15s; cliente um pouco maior
      const response = await api.post(`/proxies/${id}/test`, {}, { timeout: 18000 });

      if (response.data.success) {
        const loc = response.data.location ? ` — ${response.data.location}` : '';
        toast.success(`✅ Proxy OK! IP: ${response.data.ip || 'detectado'}${loc}`);
      } else {
        toast.error('❌ Teste falhou: ' + (response.data.error || 'Proxy não está funcionando'));
      }
    } catch (error: any) {
      console.error('Erro ao testar proxy:', error);
      const msg =
        error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')
          ? 'Tempo esgotado. Confira usuário/senha e se o tipo é SOCKS5 ou HTTP.'
          : (error?.response?.data?.error || error?.message || 'Erro ao testar proxy');
      toast.error('❌ ' + msg);
    } finally {
      setTestingId(null);
      loadProxies();
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const response = await api.post('/proxies/test-all');

      if (response.data.success) {
        toast.success(`✅ Testados: ${response.data.working}/${response.data.tested} funcionando`);
      } else {
        toast.error('Erro ao testar proxies');
      }
      loadProxies();
    } catch (error) {
      console.error('Erro ao testar proxies:', error);
      toast.error('Erro ao testar proxies');
    } finally {
      setTestingAll(false);
    }
  };

  const handleViewAccounts = async (proxy: Proxy) => {
    setViewingProxy(proxy);
    setShowAccountsModal(true);
    setLoadingAccounts(true);
    setProxyAccounts([]);
    try {
      const response = await api.get(`/proxies/${proxy.id}/accounts`);
      if (response.data.success) {
        setProxyAccounts(response.data.data);
      } else {
        toast.error('Erro ao carregar contas');
      }
    } catch (err) {
      console.error('Erro ao carregar contas do proxy:', err);
      toast.error('Erro ao carregar contas');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleOpenTransfer = () => {
    setSelectedAccountIds(proxyAccounts.map(a => a.id));
    setTransferTargetProxyId('');
    setShowTransferModal(true);
  };

  const handleToggleAccount = (id: number) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccountIds.length === proxyAccounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(proxyAccounts.map(a => a.id));
    }
  };

  const handleTransferAccounts = async () => {
    if (!transferTargetProxyId) {
      toast.error('Selecione o proxy de destino');
      return;
    }
    if (selectedAccountIds.length === 0) {
      toast.error('Selecione pelo menos uma conta');
      return;
    }
    setTransferring(true);
    try {
      const response = await api.post('/proxies/transfer-accounts', {
        from_proxy_id: viewingProxy?.id,
        to_proxy_id: parseInt(transferTargetProxyId),
        account_ids: selectedAccountIds
      });
      if (response.data.success) {
        toast.success(`✅ ${response.data.transferred} conta(s) transferida(s) com sucesso!`);
        setShowTransferModal(false);
        setShowAccountsModal(false);
        loadProxies();
      } else {
        toast.error(response.data.error || 'Erro ao transferir contas');
      }
    } catch (err) {
      console.error('Erro ao transferir contas:', err);
      toast.error('Erro ao transferir contas');
    } finally {
      setTransferring(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      working: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 text-green-300 rounded-full text-sm font-bold">
          <FaCheckCircle className="text-base" /> ✓ Funcionando
        </span>
      ),
      failed: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-rose-500/20 border-2 border-red-500/50 text-red-300 rounded-full text-sm font-bold">
          <FaTimesCircle className="text-base" /> ✗ Falhou
        </span>
      ),
      unchecked: (
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 text-yellow-300 rounded-full text-sm font-bold">
          <FaClock className="text-base" /> ⏳ Não testado
        </span>
      )
    };
    return badges[status as keyof typeof badges] || badges.unchecked;
  };

  return (
    <>
      <Head>
        <title>Gerenciar Proxies | Disparador NettSistemas</title>
      </Head>
      
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
        {/* Background Pattern */}
        <div className="fixed inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto p-6">
          {/* Header Moderno */}
          <div className="mb-8 pb-6 border-b-2 border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {/* Botão Voltar */}
                <button
                  onClick={() => router.push('/dashboard-oficial')}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
                  title="Voltar para o Dashboard API Oficial"
                >
                  <FaArrowLeft className="text-2xl text-white" />
                </button>
                
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <FaGlobe className="text-4xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white">
                    Gerenciar Proxies
                  </h1>
                  <p className="text-white/60 text-lg mt-1">
                    Gerencie todos os seus proxies em um só lugar
                  </p>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleTestAll}
                  disabled={testingAll || proxies.length === 0}
                  className="px-6 py-4 bg-gradient-to-r from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border-2 border-blue-500/50 text-blue-200 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-base"
                >
                  {testingAll ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      Testando...
                    </>
                  ) : (
                    <>
                      <FaFlask className="text-lg" /> Testar Todos
                    </>
                  )}
                </button>
                <button
                  onClick={handleOpenBulkModal}
                  className="px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-teal-600/10 hover:from-emerald-500/30 hover:to-teal-600/20 border-2 border-emerald-500/50 text-emerald-200 font-bold rounded-xl transition-all flex items-center gap-2 text-base"
                >
                  <FaListUl className="text-lg" /> Importar Lista
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 flex items-center gap-2 text-base"
                >
                  <FaPlus className="text-lg" /> Adicionar Proxy
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Proxies */}
          {loading ? (
            <div className="bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-xl p-20 text-center">
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-primary-500 mx-auto mb-6"></div>
              <p className="text-white text-xl font-bold">Carregando proxies...</p>
            </div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-20 bg-gradient-to-br from-white/5 to-white/0 border-2 border-dashed border-white/20 rounded-2xl">
              <div className="bg-white/10 p-8 rounded-full inline-block mb-6">
                <FaGlobe className="text-8xl text-white/30" />
              </div>
              <p className="text-white font-bold text-2xl mb-3">Nenhum proxy cadastrado</p>
              <p className="text-white/60 text-base mb-6">Adicione seu primeiro proxy para começar</p>
              <button
                onClick={() => handleOpenModal()}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 inline-flex items-center gap-2 text-base"
              >
                <FaPlus className="text-lg" /> Adicionar Primeiro Proxy
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-6">
            {proxies.map(proxy => (
              <div
                key={proxy.id}
                className="p-8 bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/10 rounded-xl hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/10 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-cyan-500/20 p-2 rounded-lg">
                        <FaGlobe className="text-2xl text-cyan-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">{proxy.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(proxy.status)}
                          {!proxy.is_active && (
                            <span className="px-3 py-1 bg-gray-500/20 border-2 border-gray-500/50 text-gray-300 rounded-full text-xs font-bold">
                              ⏸️ Inativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                        <p className="text-blue-300 text-xs font-bold mb-1 flex items-center gap-1">
                          <span>🔧</span> Tipo
                        </p>
                        <p className="text-white font-mono text-lg font-black">
                          {proxy.type === 'rotating' ? '🔄 ROTATIVO' : proxy.type.toUpperCase()}
                        </p>
                      </div>
                      
                      {proxy.type === 'rotating' ? (
                        <>
                          <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                            <p className="text-purple-300 text-xs font-bold mb-1 flex items-center gap-1">
                              <span>📋</span> Proxies no Pool
                            </p>
                            <p className="text-white text-2xl font-black">{proxy.proxy_pool?.length || 0}</p>
                          </div>
                          <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-lg">
                            <p className="text-indigo-300 text-xs font-bold mb-1 flex items-center gap-1">
                              <span>⏱️</span> Intervalo
                            </p>
                            <p className="text-white text-sm font-bold">{proxy.rotation_interval || 30} min</p>
                          </div>
                          {proxy.proxy_pool && proxy.proxy_pool.length > 0 && (
                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                              <p className="text-green-300 text-xs font-bold mb-1 flex items-center gap-1">
                                <span>✓</span> Proxy Atual
                              </p>
                              <p className="text-white font-mono text-xs font-bold">
                                {proxy.proxy_pool[proxy.current_proxy_index || 0]?.host || 'N/A'}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                          <p className="text-purple-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>🌐</span> Host:Porta
                          </p>
                          <p className="text-white font-mono text-sm font-bold">{proxy.host}:{proxy.port}</p>
                        </div>
                      )}
                      
                      {proxy.location && (
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                          <p className="text-green-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>📍</span> Localização
                          </p>
                          <p className="text-white text-sm font-bold">{proxy.location}</p>
                        </div>
                      )}
                      {proxy.last_ip && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                          <p className="text-yellow-300 text-xs font-bold mb-1 flex items-center gap-1">
                            <span>🔍</span> IP Detectado
                          </p>
                          <p className="text-white font-mono text-sm font-bold">{proxy.last_ip}</p>
                        </div>
                      )}
                      <div className="bg-pink-500/10 border border-pink-500/30 p-4 rounded-lg">
                        <p className="text-pink-300 text-xs font-bold mb-1 flex items-center gap-1">
                          <span>📱</span> Contas Usando
                        </p>
                        <p className="text-white text-2xl font-black">{proxy.accounts_count || 0}</p>
                      </div>
                    </div>
                    
                    {/* Aviso de fallback quando proxy falhou mas tem contas usando */}
                    {proxy.status === 'failed' && (proxy.accounts_count || 0) > 0 && (
                      <div className="mt-4 flex items-start gap-3 p-4 bg-gradient-to-r from-orange-500/15 to-amber-500/10 border-2 border-orange-500/50 rounded-xl">
                        <span className="text-orange-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
                        <div>
                          <p className="text-orange-300 font-bold text-sm">
                            Proxy com falha — Modo Fallback Ativo
                          </p>
                          <p className="text-orange-200/70 text-xs mt-1">
                            As <strong>{proxy.accounts_count}</strong> conta(s) associadas estão operando <strong>sem proxy</strong> automaticamente até que o proxy seja corrigido. Nenhuma conta foi bloqueada.
                          </p>
                        </div>
                      </div>
                    )}

                    {proxy.description && (
                      <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-white/70 text-sm">{proxy.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => handleTest(proxy.id)}
                      disabled={testingId === proxy.id}
                      className="p-4 bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 text-blue-300 rounded-xl transition-all disabled:opacity-50 hover:scale-110"
                      title="Testar Proxy"
                    >
                      {testingId === proxy.id ? (
                        <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FaFlask className="text-xl" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewAccounts(proxy)}
                      className="p-4 bg-cyan-500/20 hover:bg-cyan-500/30 border-2 border-cyan-500/50 text-cyan-300 rounded-xl transition-all hover:scale-110"
                      title="Ver Contas"
                    >
                      <FaUsers className="text-xl" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(proxy)}
                      className="p-4 bg-yellow-500/20 hover:bg-yellow-500/30 border-2 border-yellow-500/50 text-yellow-300 rounded-xl transition-all hover:scale-110"
                      title="Editar"
                    >
                      <FaEdit className="text-xl" />
                    </button>
                    <button
                      onClick={() => handleDelete(proxy.id, proxy.name, proxy.accounts_count || 0)}
                      className="p-4 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-300 rounded-xl transition-all hover:scale-110"
                      title="Deletar"
                    >
                      <FaTrash className="text-xl" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Modal: Ver Contas do Proxy */}
      {showAccountsModal && viewingProxy && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-500/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-white/10">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl">
                  <FaUsers className="text-2xl text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Contas usando este Proxy</h2>
                  <p className="text-cyan-300 text-sm mt-1 font-bold">{viewingProxy.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountsModal(false)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all border-2 border-white/20"
              >
                <FaTimes className="text-white text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingAccounts ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-cyan-500 mb-4"></div>
                  <p className="text-white/60 text-base">Carregando contas...</p>
                </div>
              ) : proxyAccounts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-white/10 p-6 rounded-full inline-block mb-4">
                    <FaUsers className="text-5xl text-white/30" />
                  </div>
                  <p className="text-white font-bold text-lg mb-2">Nenhuma conta usando este proxy</p>
                  <p className="text-white/50 text-sm">Associe contas a este proxy nas configurações de cada conta</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/70 text-sm font-bold">
                      Total: <span className="text-cyan-300 text-base">{proxyAccounts.length}</span> conta(s)
                    </span>
                  </div>
                  <div className="space-y-3">
                    {proxyAccounts.map(account => (
                      <div
                        key={account.id}
                        className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/30 transition-all"
                      >
                        <div className="bg-cyan-500/20 p-2 rounded-lg flex-shrink-0">
                          <FaPhone className="text-cyan-300 text-base" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{account.name || 'Sem nome'}</p>
                          <p className="text-white/60 text-xs font-mono mt-0.5">{account.phone_number || '—'}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {account.is_active ? (
                            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold rounded-full">
                              Ativa
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-500/20 border border-gray-500/40 text-gray-300 text-xs font-bold rounded-full">
                              Inativa
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6 pt-4 border-t-2 border-white/10">
              <button
                onClick={() => setShowAccountsModal(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border-2 border-white/20 flex items-center justify-center gap-2"
              >
                <FaTimes /> Fechar
              </button>
              {proxyAccounts.length > 0 && (
                <button
                  onClick={handleOpenTransfer}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  <FaExchangeAlt /> Transferir Contas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir Contas em Massa */}
      {showTransferModal && viewingProxy && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-orange-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-orange-500/20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-white/10">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-3 rounded-xl">
                <FaExchangeAlt className="text-2xl text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Transferir Contas em Massa</h2>
                <p className="text-orange-300 text-sm mt-1 font-bold">De: {viewingProxy.name}</p>
              </div>
            </div>

            {/* Proxy destino */}
            <div className="mb-5">
              <label className="block text-white font-bold text-sm mb-2 flex items-center gap-2">
                <FaGlobe className="text-orange-300" /> Proxy de Destino *
              </label>
              <select
                value={transferTargetProxyId}
                onChange={(e) => setTransferTargetProxyId(e.target.value)}
                className="w-full px-5 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-orange-500/30 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all cursor-pointer"
              >
                <option value="">-- Selecione o proxy de destino --</option>
                {proxies
                  .filter(p => p.id !== viewingProxy.id)
                  .map(p => (
                    <option key={p.id} value={p.id} className="bg-dark-700">
                      {p.name} {p.status === 'working' ? '✓' : p.status === 'failed' ? '✗' : '?'} — {p.accounts_count || 0} contas
                    </option>
                  ))}
              </select>
            </div>

            {/* Seleção de contas */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <label className="text-white font-bold text-sm flex items-center gap-2">
                  <FaUsers className="text-orange-300" /> Contas a transferir
                </label>
                <button
                  onClick={handleSelectAllAccounts}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold rounded-lg transition-all"
                >
                  {selectedAccountIds.length === proxyAccounts.length ? (
                    <><FaCheckSquare /> Desmarcar todas</>
                  ) : (
                    <><FaSquare /> Selecionar todas</>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                {proxyAccounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => handleToggleAccount(account.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedAccountIds.includes(account.id)
                        ? 'bg-orange-500/15 border-orange-500/50'
                        : 'bg-white/5 border-white/10 hover:border-orange-500/30'
                    }`}
                  >
                    <div className={`flex-shrink-0 text-lg ${selectedAccountIds.includes(account.id) ? 'text-orange-400' : 'text-white/30'}`}>
                      {selectedAccountIds.includes(account.id) ? <FaCheckSquare /> : <FaSquare />}
                    </div>
                    <div className="bg-cyan-500/20 p-1.5 rounded-lg flex-shrink-0">
                      <FaPhone className="text-cyan-300 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{account.name || 'Sem nome'}</p>
                      <p className="text-white/50 text-xs font-mono">{account.phone_number || '—'}</p>
                    </div>
                    {account.is_active ? (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full">Ativa</span>
                    ) : (
                      <span className="flex-shrink-0 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-bold rounded-full">Inativa</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary + Buttons */}
            <div className="mt-5 pt-4 border-t-2 border-white/10">
              <p className="text-white/60 text-sm mb-4">
                <span className="text-orange-300 font-black text-base">{selectedAccountIds.length}</span> conta(s) selecionada(s) para transferência
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border-2 border-white/20 flex items-center justify-center gap-2"
                >
                  <FaTimes /> Cancelar
                </button>
                <button
                  onClick={handleTransferAccounts}
                  disabled={transferring || !transferTargetProxyId || selectedAccountIds.length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Transferindo...</>
                  ) : (
                    <><FaExchangeAlt /> Confirmar Transferência</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar Lista */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-emerald-500/30 rounded-2xl p-6 md:p-8 max-w-6xl w-full max-h-[92vh] overflow-y-auto shadow-2xl shadow-emerald-500/20">
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-white/10">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl">
                  <FaListUl className="text-3xl text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white">Importar Lista de Proxies</h2>
                  <p className="text-white/60 text-sm mt-1">
                    Cole uma proxy por linha, gere a prévia, edite e crie todas de uma vez
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseBulkModal}
                disabled={bulkSaving}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                  <label className="block text-white font-bold text-sm mb-2">Tipo do lote *</label>
                  <select
                    value={bulkDefaultType}
                    onChange={(e) => setBulkDefaultType(e.target.value as 'socks5' | 'http')}
                    className="w-full px-4 py-3 bg-dark-700 text-white rounded-xl border-2 border-emerald-500/30 focus:border-emerald-400"
                  >
                    <option value="socks5">SOCKS5</option>
                    <option value="http">HTTP</option>
                  </select>
                  <p className="text-white/40 text-xs mt-2">Aplicado a todas as linhas ao gerar a prévia (editável depois)</p>
                </div>
                <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4 md:col-span-2">
                  <label className="block text-white font-bold text-sm mb-2">Prefixo do nome</label>
                  <input
                    type="text"
                    value={bulkNamePrefix}
                    onChange={(e) => setBulkNamePrefix(e.target.value)}
                    placeholder="Ex: IPBR ou PROXY - CONTA"
                    className="w-full px-4 py-3 bg-dark-700 text-white rounded-xl border-2 border-emerald-500/30 focus:border-emerald-400"
                  />
                  <p className="text-white/40 text-xs mt-2">
                    Gera nomes como <span className="text-white/70 font-mono">{bulkNamePrefix || 'PROXY'} 01</span>, depois você edita cada um na prévia
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-sm mb-2">Lista (1 proxy por linha)</label>
                <textarea
                  value={bulkRawText}
                  onChange={(e) => setBulkRawText(e.target.value)}
                  rows={8}
                  placeholder={`proxy22-br-hz.ipbr.pro:10000:usuario1:senha1\nproxy22-br-hz.ipbr.pro:10000:usuario2:senha2\n\nOpcional com nome na linha:\nCONTA 07|proxy22-br-hz.ipbr.pro:10000:user:pass`}
                  className="w-full px-4 py-3 bg-dark-700 text-white font-mono text-sm rounded-xl border-2 border-emerald-500/30 focus:border-emerald-400 placeholder-white/30"
                />
                <div className="flex flex-wrap gap-3 mt-3">
                  <button
                    type="button"
                    onClick={buildBulkPreview}
                    className="px-5 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border-2 border-emerald-500/50 text-emerald-200 font-bold rounded-xl"
                  >
                    Gerar prévia editável
                  </button>
                  {bulkRows.length > 0 && (
                    <span className="self-center text-white/60 text-sm">
                      {bulkRows.filter((r) => r.valid).length}/{bulkRows.length} válidas
                    </span>
                  )}
                </div>
              </div>

              {bulkRows.length > 0 && (
                <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4 overflow-x-auto">
                  <label className="block text-white font-bold text-sm mb-3">
                    Prévia editável — ajuste nome, tipo, host, porta e credenciais antes de criar
                  </label>
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="text-left text-white/60 border-b border-white/10">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Nome</th>
                        <th className="py-2 pr-2">Tipo</th>
                        <th className="py-2 pr-2">Host</th>
                        <th className="py-2 pr-2">Porta</th>
                        <th className="py-2 pr-2">Usuário</th>
                        <th className="py-2 pr-2">Senha</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, idx) => (
                        <tr key={row.key} className="border-b border-white/5 align-top">
                          <td className="py-2 pr-2 text-white/40">{idx + 1}</td>
                          <td className="py-2 pr-2">
                            <input
                              value={row.name}
                              onChange={(e) => updateBulkRow(row.key, { name: e.target.value })}
                              className="w-36 px-2 py-1.5 bg-dark-700 text-white rounded-lg border border-white/20"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <select
                              value={row.type}
                              onChange={(e) =>
                                updateBulkRow(row.key, { type: e.target.value as 'socks5' | 'http' })
                              }
                              className="px-2 py-1.5 bg-dark-700 text-white rounded-lg border border-white/20"
                            >
                              <option value="socks5">SOCKS5</option>
                              <option value="http">HTTP</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={row.host}
                              onChange={(e) => updateBulkRow(row.key, { host: sanitizeHost(e.target.value) })}
                              className="w-48 px-2 py-1.5 bg-dark-700 text-white font-mono rounded-lg border border-white/20"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={row.port}
                              onChange={(e) => updateBulkRow(row.key, { port: e.target.value })}
                              className="w-20 px-2 py-1.5 bg-dark-700 text-white font-mono rounded-lg border border-white/20"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={row.username}
                              onChange={(e) => updateBulkRow(row.key, { username: e.target.value })}
                              className="w-28 px-2 py-1.5 bg-dark-700 text-white font-mono rounded-lg border border-white/20"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={row.password}
                              onChange={(e) => updateBulkRow(row.key, { password: e.target.value })}
                              className="w-28 px-2 py-1.5 bg-dark-700 text-white font-mono rounded-lg border border-white/20"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            {row.valid ? (
                              <span className="text-emerald-300 text-xs font-bold">OK</span>
                            ) : (
                              <span className="text-red-300 text-xs" title={row.error}>
                                Erro
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeBulkRow(row.key)}
                              className="p-2 text-red-300 hover:bg-red-500/20 rounded-lg"
                              title="Remover linha"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCloseBulkModal}
                  disabled={bulkSaving}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={bulkSaving || bulkRows.filter((r) => r.valid).length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <FaSave /> Criar {bulkRows.filter((r) => r.valid).length} proxy(s)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-primary-500/30 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-primary-500/20">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b-2 border-white/10">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl">
                <FaGlobe className="text-3xl text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white">
                  {editingProxy ? '✏️ Editar Proxy' : '➕ Novo Proxy'}
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  {editingProxy ? 'Atualize as informações do proxy' : 'Adicione um novo proxy ao sistema'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Nome */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">📝</span> Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Proxy Brasil SP 01"
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                />
              </div>

              {/* Tipo */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">🔧</span> Tipo de Proxy *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all cursor-pointer"
                >
                  <option value="socks5" className="bg-dark-700">📍 Socks5 Fixo (Recomendado)</option>
                  <option value="http" className="bg-dark-700">📍 HTTP/HTTPS Fixo</option>
                  <option value="rotating" className="bg-dark-700">🔄 Rotativo (Múltiplos Proxies)</option>
                </select>
                {formData.type === 'rotating' && (
                  <p className="mt-3 text-yellow-300 text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    ⚠️ <strong>Modo Rotativo:</strong> O sistema irá alternar automaticamente entre os proxies do pool no intervalo definido.
                  </p>
                )}
              </div>

              {/* PROXY FIXO: Host e Porta */}
              {formData.type !== 'rotating' && (
                <>
                  {/* Colar string completa do provedor (formato IPBR) */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border-2 border-emerald-500/40 rounded-xl p-4">
                    <label className="block text-white font-bold text-base mb-2 flex items-center gap-2">
                      <span className="text-xl">📋</span> Colar string do provedor
                    </label>
                    <p className="text-emerald-200/80 text-xs mb-3">
                      Cole a linha completa do painel IPBR. Exemplos:
                      <br />
                      <span className="font-mono text-emerald-300">SOCKS5: proxy22-br-hz.ipbr.pro:10000:usuario:senha</span>
                      <br />
                      <span className="font-mono text-emerald-300">HTTP: proxy22-br-hz.ipbr.pro:10001:usuario:senha</span>
                    </p>
                    <input
                      type="text"
                      placeholder="Cole aqui: host:porta:usuario:senha"
                      className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-emerald-500/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 transition-all placeholder-white/40"
                      onChange={(e) => {
                        const value = e.target.value;
                        const parsed = parseProxyString(value);
                        if (parsed?.host && parsed?.port) {
                          setFormData((prev) => applyParsedProxy(parsed, prev));
                          toast.success(`Proxy reconhecido! ${parsed.host}:${parsed.port} (${parsed.type || formData.type})`);
                          e.target.value = '';
                        }
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        const parsed = parseProxyString(pasted);
                        if (parsed?.host && parsed?.port) {
                          e.preventDefault();
                          setFormData((prev) => applyParsedProxy(parsed, prev));
                          toast.success(`Proxy reconhecido! ${parsed.host}:${parsed.port} (${parsed.type || 'auto'})`);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>

                  <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">🌐</span> Servidor
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-white/70 text-sm mb-2">Host / IP / Domínio *</label>
                        <input
                          type="text"
                          value={formData.host}
                          onChange={(e) => {
                            const value = e.target.value;
                            const parsed = parseProxyString(value);
                            if (parsed?.host && parsed?.port && (value.includes('@') || value.split(':').filter(Boolean).length >= 3)) {
                              setFormData((prev) => applyParsedProxy(parsed, prev));
                              toast.success('Formato de proxy reconhecido e campos preenchidos!');
                              return;
                            }
                            setFormData({ ...formData, host: sanitizeHost(value) });
                          }}
                          placeholder="Ex: proxy22-br-hz.ipbr.pro"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Porta *</label>
                        <input
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          placeholder={formData.type === 'http' ? '10001' : '10000'}
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                    </div>
                    <p className="text-white/40 text-xs mt-2">
                      IPBR: SOCKS5 usa porta <strong className="text-white/70">10000</strong> · HTTP usa porta <strong className="text-white/70">10001</strong>
                    </p>
                  </div>

                  {/* Usuário e Senha */}
                  <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">🔐</span> Autenticação
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Usuário</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="usuario"
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Senha</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={editingProxy ? 'Deixe em branco para manter a senha atual' : '••••••••'}
                          className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                        />
                        {editingProxy && (
                          <p className="text-white/40 text-xs mt-2">
                            Por segurança a senha não é exibida. Só preencha se quiser trocar.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* PROXY ROTATIVO: Pool de Proxies */}
              {formData.type === 'rotating' && (
                <>
                  {/* Intervalo de Rotação */}
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-xl p-6">
                    <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                      <span className="text-xl">⏱️</span> Intervalo de Rotação
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={formData.rotation_interval}
                        onChange={(e) => setFormData({ ...formData, rotation_interval: parseInt(e.target.value) || 30 })}
                        className="w-32 px-6 py-4 bg-dark-700 text-white text-base font-bold text-center rounded-xl border-2 border-purple-500/30 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all"
                      />
                      <span className="text-white text-base font-bold">minutos</span>
                    </div>
                    <p className="text-white/60 text-sm mt-3">
                      O sistema irá trocar de proxy automaticamente a cada {formData.rotation_interval} minutos.
                    </p>
                  </div>

                  {/* Adicionar Proxy ao Pool */}
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-xl p-6">
                    <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">🔄</span> Adicionar Proxy ao Pool
                    </label>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-white/70 text-sm mb-2">Host / IP *</label>
                          <input
                            type="text"
                            value={poolHost}
                            onChange={(e) => setPoolHost(e.target.value)}
                            placeholder="Ex: 191.5.153.178"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Porta *</label>
                          <input
                            type="number"
                            value={poolPort}
                            onChange={(e) => setPoolPort(e.target.value)}
                            placeholder="1080"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Usuário (opcional)</label>
                          <input
                            type="text"
                            value={poolUsername}
                            onChange={(e) => setPoolUsername(e.target.value)}
                            placeholder="usuario"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base font-mono rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                        <div>
                          <label className="block text-white/70 text-sm mb-2">Senha (opcional)</label>
                          <input
                            type="password"
                            value={poolPassword}
                            onChange={(e) => setPoolPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddToPool}
                        className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transform hover:scale-105 flex items-center justify-center gap-2 text-base"
                      >
                        <FaPlus className="text-lg" /> Adicionar ao Pool
                      </button>
                    </div>
                  </div>

                  {/* Lista de Proxies no Pool */}
                  {formData.proxy_pool.length > 0 && (
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-6">
                      <label className="block text-white font-bold text-lg mb-4 flex items-center gap-2">
                        <span className="text-2xl">📋</span> Proxies no Pool ({formData.proxy_pool.length})
                      </label>
                      
                      <div className="space-y-3">
                        {formData.proxy_pool.map((proxy, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-dark-700/50 border border-green-500/20 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="bg-green-500/20 px-3 py-1 rounded-lg">
                                <span className="text-green-300 font-black text-sm">#{index + 1}</span>
                              </div>
                              <div>
                                <p className="text-white font-mono font-bold text-base">
                                  {proxy.host}:{proxy.port}
                                </p>
                                {proxy.username && (
                                  <p className="text-white/60 text-sm">
                                    🔐 Auth: {proxy.username}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromPool(index)}
                              className="p-3 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/50 text-red-300 rounded-xl transition-all hover:scale-110"
                              title="Remover"
                            >
                              <FaTrash className="text-lg" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Localização */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">📍</span> Localização (opcional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Brasil - São Paulo"
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40"
                />
              </div>

              {/* Descrição */}
              <div className="bg-white/5 border-2 border-white/10 rounded-xl p-4">
                <label className="block text-white font-bold text-base mb-3 flex items-center gap-2">
                  <span className="text-xl">💬</span> Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notas sobre este proxy..."
                  rows={3}
                  className="w-full px-6 py-4 bg-dark-700 text-white text-base rounded-xl border-2 border-cyan-500/30 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 transition-all placeholder-white/40 resize-none"
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 rounded-xl">
                <div>
                  <p className="text-white font-bold text-lg flex items-center gap-2">
                    <span className="text-2xl">⚡</span> Proxy Ativo
                  </p>
                  <p className="text-white/60 text-sm mt-1">Disponível para uso em contas do WhatsApp</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative w-16 h-8 rounded-full transition-all shadow-lg ${
                    formData.is_active ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-500/30' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${
                      formData.is_active ? 'translate-x-8' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Seção: Atribuir Contas */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-xl p-5">
                <label className="block text-white font-bold text-base mb-1 flex items-center gap-2">
                  <FaUsers className="text-cyan-300" /> Atribuir Contas a este Proxy
                  {selectedAccountsForProxy.length > 0 && (
                    <span className="ml-auto px-3 py-0.5 bg-cyan-500/30 text-cyan-300 text-xs font-black rounded-full">
                      {selectedAccountsForProxy.length} selecionada(s)
                    </span>
                  )}
                </label>
                <p className="text-white/50 text-xs mb-4">Selecione as contas que usarão este proxy. As já selecionadas são as que já estão usando.</p>

                {loadingAllAccounts ? (
                  <div className="flex items-center gap-3 py-4 justify-center">
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-white/60 text-sm">Carregando contas...</span>
                  </div>
                ) : allAccounts.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4">Nenhuma conta cadastrada</p>
                ) : (
                  <>
                    {/* Busca + Selecionar todas */}
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-dark-700 border border-cyan-500/30 rounded-xl">
                        <FaSearch className="text-white/40 text-sm flex-shrink-0" />
                        <input
                          type="text"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Buscar conta..."
                          className="bg-transparent text-white text-sm w-full outline-none placeholder-white/30"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = allAccounts.filter(a =>
                            !accountSearch ||
                            a.name?.toLowerCase().includes(accountSearch.toLowerCase()) ||
                            a.phone_number?.includes(accountSearch)
                          );
                          const filteredIds = filtered.map(a => a.id);
                          const allSelected = filteredIds.every(id => selectedAccountsForProxy.includes(id));
                          if (allSelected) {
                            setSelectedAccountsForProxy(prev => prev.filter(id => !filteredIds.includes(id)));
                          } else {
                            setSelectedAccountsForProxy(prev => [...new Set([...prev, ...filteredIds])]);
                          }
                        }}
                        className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold rounded-xl transition-all whitespace-nowrap"
                      >
                        {(() => {
                          const filtered = allAccounts.filter(a =>
                            !accountSearch ||
                            a.name?.toLowerCase().includes(accountSearch.toLowerCase()) ||
                            a.phone_number?.includes(accountSearch)
                          );
                          return filtered.every(a => selectedAccountsForProxy.includes(a.id)) ? 'Desmarcar' : 'Todas';
                        })()}
                      </button>
                    </div>

                    {/* Lista de contas */}
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {allAccounts
                        .filter(a =>
                          !accountSearch ||
                          a.name?.toLowerCase().includes(accountSearch.toLowerCase()) ||
                          a.phone_number?.includes(accountSearch)
                        )
                        .map(account => {
                          const isSelected = selectedAccountsForProxy.includes(account.id);
                          return (
                            <div
                              key={account.id}
                              onClick={() =>
                                setSelectedAccountsForProxy(prev =>
                                  isSelected ? prev.filter(x => x !== account.id) : [...prev, account.id]
                                )
                              }
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-cyan-500/15 border-cyan-500/50'
                                  : 'bg-white/5 border-white/10 hover:border-cyan-500/30'
                              }`}
                            >
                              <span className={`flex-shrink-0 text-base ${isSelected ? 'text-cyan-400' : 'text-white/30'}`}>
                                {isSelected ? <FaCheckSquare /> : <FaSquare />}
                              </span>
                              <div className="bg-cyan-500/20 p-1.5 rounded-lg flex-shrink-0">
                                <FaPhone className="text-cyan-300 text-xs" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm truncate">{account.name || 'Sem nome'}</p>
                                <p className="text-white/50 text-xs font-mono">{account.phone_number || '—'}</p>
                              </div>
                              {account.is_active ? (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full">Ativa</span>
                              ) : (
                                <span className="flex-shrink-0 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-bold rounded-full">Inativa</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            </div>{/* fecha space-y-6 */}

            {/* Botões */}
            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-white/10">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-base font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FaTimes className="text-lg" /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.host || !formData.port}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-base font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                <FaSave className="text-lg" /> {editingProxy ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

