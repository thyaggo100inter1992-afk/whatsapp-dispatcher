import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaCopy, FaKey, FaPlus, FaTrash, FaCheck, FaCode, FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

interface IntegrationKey {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function IntegracaoPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [name, setName] = useState('Sistema de Vendas');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{
    api_key: string;
    embed: { oficial: string; qr: string };
  } | null>(null);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  const loadKeys = async () => {
    try {
      const response = await api.get('/integration/keys');
      setKeys(response.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível carregar as chaves');
    }
  };

  useEffect(() => {
    if (!loading && user && user.role === 'super_admin') {
      loadKeys();
    }
  }, [loading, user]);

  const createKey = async () => {
    setCreating(true);
    setError('');
    try {
      const response = await api.post('/integration/keys', { name });
      setNewKey(response.data.data);
      await loadKeys();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao criar chave');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: number) => {
    if (!confirm('Desativar esta chave? O sistema de vendas vai parar de enviar.')) return;
    await api.delete(`/integration/keys/${id}`);
    await loadKeys();
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const iframeSnippet = (url: string) =>
    `<iframe src="${url}" style="width:100%;height:900px;border:0;" allow="clipboard-write"></iframe>`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Apenas o administrador master pode gerenciar a integração.
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Integração | Disparador NettSistemas</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white flex items-center gap-2"
            >
              <FaArrowLeft /> Voltar
            </button>
          </div>

          <div className="bg-dark-800/70 border border-emerald-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 bg-emerald-500/20 rounded-2xl">
                <FaKey className="text-3xl text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">Integração com o sistema de vendas</h1>
                <p className="text-gray-400">
                  Gere uma chave, cole o iframe no outro sistema e use as mesmas telas de Envio Rápido e Envio Único.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mt-6">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white"
                placeholder="Nome da chave"
              />
              <button
                onClick={createKey}
                disabled={creating}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2"
              >
                <FaPlus /> {creating ? 'Gerando...' : 'Gerar chave'}
              </button>
            </div>
            {error && <p className="text-red-400 mt-3">{error}</p>}
          </div>

          {newKey && (
            <div className="bg-emerald-500/10 border border-emerald-400/40 rounded-3xl p-8 space-y-5">
              <p className="text-emerald-300 font-bold">
                Guarde esta chave agora. Ela não aparece de novo.
              </p>
              <CopyBlock
                label="Chave de API"
                value={newKey.api_key}
                copied={copied}
                onCopy={copy}
              />
              <CopyBlock
                label="Iframe API Oficial (Envio Rápido)"
                value={iframeSnippet(newKey.embed.oficial)}
                copied={copied}
                onCopy={copy}
              />
              <CopyBlock
                label="Iframe QR Connect (Envio Único)"
                value={iframeSnippet(newKey.embed.qr)}
                copied={copied}
                onCopy={copy}
              />
            </div>
          )}

          <div className="bg-dark-800/70 border border-white/10 rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-4">Chaves existentes</h2>
            {keys.length === 0 ? (
              <p className="text-gray-400">Nenhuma chave criada ainda.</p>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between bg-dark-900/80 rounded-xl px-4 py-3 border border-white/5"
                  >
                    <div>
                      <p className="text-white font-semibold">
                        {key.name} <span className="text-gray-500">{key.key_prefix}...</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {key.is_active ? 'Ativa' : 'Desativada'} · último uso:{' '}
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleString('pt-BR')
                          : 'nunca'}
                      </p>
                    </div>
                    {key.is_active && (
                      <button
                        onClick={() => revokeKey(key.id)}
                        className="text-red-400 hover:text-red-300 flex items-center gap-2"
                      >
                        <FaTrash /> Desativar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-dark-800/70 border border-white/10 rounded-3xl p-8 space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FaCode /> API REST
            </h2>
            <p className="text-gray-400 text-sm">
              Um token por cliente. Header: <code className="text-emerald-300">X-Api-Key: nsk_...</code> ou body <code className="text-emerald-300">token</code>.
              Email e senha continuam aceitos nas APIs antigas.
            </p>
            <pre className="bg-black/50 text-emerald-200 text-xs p-4 rounded-xl overflow-auto">
{`Header: X-Api-Key: nsk_...   (ou body: { "token": "nsk_..." })

Envio
POST /api/integration/v1/oficial/send
POST /api/integration/v1/qr/send

Lista de restrição
POST /api/public/restriction-list/consultar
POST /api/public/restriction-list/add
POST /api/public/restriction-list/remover

Verificação de WhatsApp
POST /api/public/whatsapp/verificar

Nova Vida (CPF/CNPJ — mesma resposta do painel)
POST /api/public/novavida/consultar
     { "token": "nsk_...", "documento": "00000000000", "verificarWhatsapp": true }`}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

function CopyBlock({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-300 mb-2">{label}</p>
      <div className="flex gap-2">
        <textarea
          readOnly
          value={value}
          className="flex-1 bg-black/40 text-emerald-200 text-xs rounded-xl p-3 min-h-[72px]"
        />
        <button
          onClick={() => onCopy(value, label)}
          className="px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl"
        >
          {copied === label ? <FaCheck /> : <FaCopy />}
        </button>
      </div>
    </div>
  );
}
