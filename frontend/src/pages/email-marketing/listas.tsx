import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaList, FaArrowLeft, FaPlus, FaTrash, FaUpload, FaUsers, FaSpinner, FaCheckCircle, FaClipboard, FaFileExcel, FaTimesCircle } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface EmailList { id: number; name: string; description: string; total_contacts: number; created_at: string; }

export default function Listas() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newList, setNewList] = useState({ name: '', description: '' });
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  // Modo colar
  const [showPaste, setShowPaste] = useState(false);
  const [pasteListId, setPasteListId] = useState<number | null>(null);
  const [pasteListName, setPasteListName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteImporting, setPasteImporting] = useState(false);

  useEffect(() => { loadLists(); }, []);

  const loadLists = async () => {
    try {
      const r = await api.get('/email-marketing/lists');
      setLists(r.data.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newList.name) { notification.warning('Campo obrigatório', 'Informe o nome da lista.'); return; }
    setCreating(true);
    try {
      await api.post('/email-marketing/lists', newList);
      notification.success('Lista criada!', '');
      setShowCreate(false);
      setNewList({ name: '', description: '' });
      loadLists();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir Lista', message: `Excluir "${name}" e todos os seus contatos?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/lists/${id}`);
      notification.success('Lista excluída', '');
      loadLists();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  const handleImport = async (listId: number, file: File) => {
    setImporting(listId);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await api.post(`/email-marketing/lists/${listId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notification.success('Importação concluída!', `${r.data.imported} contatos importados de ${r.data.total}.`);
      loadLists();
    } catch (error: any) {
      notification.error('Erro na importação', error.response?.data?.message || error.message);
    } finally { setImporting(null); }
  };

  // Importar via colar texto
  const handlePasteImport = async () => {
    if (!pasteListId || !pasteText.trim()) {
      notification.warning('Atenção', 'Cole ao menos um e-mail na área de texto.');
      return;
    }

    // Parsear linhas: aceita email,nome ou só email, separados por vírgula, ponto-e-vírgula ou nova linha
    const lines = pasteText
      .split(/[\n;]/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      notification.warning('Atenção', 'Nenhum e-mail encontrado no texto colado.');
      return;
    }

    // Montar CSV em memória
    const csvLines = ['email,name'];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      const email = parts[0];
      const name = parts[1] || '';
      if (!email.includes('@')) continue;
      csvLines.push(`${email},${name}`);
    }

    if (csvLines.length <= 1) {
      notification.warning('Nenhum e-mail válido', 'Verifique se os endereços contêm "@".');
      return;
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const file = new File([blob], 'contatos.csv', { type: 'text/csv' });

    setPasteImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await api.post(`/email-marketing/lists/${pasteListId}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      notification.success('Importação concluída!', `${r.data.imported} contatos importados de ${r.data.total}.`);
      setShowPaste(false);
      setPasteText('');
      loadLists();
    } catch (error: any) {
      notification.error('Erro na importação', error.response?.data?.message || error.message);
    } finally { setPasteImporting(false); }
  };

  // Baixar modelo Excel (CSV com BOM para abrir corretamente no Excel)
  const downloadExcelTemplate = () => {
    const bom = '\uFEFF';
    const content = [
      'email,name',
      'joao.silva@email.com,João Silva',
      'maria.santos@email.com,Maria Santos',
      'pedro.oliveira@gmail.com,Pedro Oliveira',
      'ana.costa@hotmail.com,Ana Costa',
      'carlos.mendes@empresa.com.br,Carlos Mendes',
    ].join('\r\n');

    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-lista-contatos.csv';
    a.click();
    URL.revokeObjectURL(url);
    notification.success('Download iniciado!', 'Abra o arquivo no Excel para visualizar o modelo.');
  };

  const openPasteModal = (id: number, name: string) => {
    setPasteListId(id);
    setPasteListName(name);
    setPasteText('');
    setShowPaste(true);
  };

  // Contar e-mails válidos no texto colado
  const validEmailCount = pasteText
    .split(/[\n;]/)
    .map(l => l.trim().split(',')[0].trim())
    .filter(e => e.includes('@')).length;

  return (
    <>
      <Head><title>Listas de Contatos | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => {
        const file = e.target.files?.[0];
        if (file && selectedListId) handleImport(selectedListId, file);
        e.target.value = '';
      }} />

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                <FaArrowLeft />
              </button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3"><FaList className="text-green-400" /> Listas de Contatos</h1>
                <p className="text-gray-400">{lists.length} lista(s)</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              <FaPlus /> Nova Lista
            </button>
          </div>

          {/* Modal Criar */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border-2 border-green-500/40 rounded-2xl p-8 max-w-md w-full space-y-4">
                <h2 className="text-xl font-black text-white">Nova Lista de Contatos</h2>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Nome *</label>
                  <input type="text" value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })}
                    placeholder="Ex: Leads Novembro 2026"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2">Descrição</label>
                  <input type="text" value={newList.description} onChange={e => setNewList({ ...newList, description: e.target.value })}
                    placeholder="Descrição opcional"
                    className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleCreate} disabled={creating}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    {creating ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} Criar
                  </button>
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Colar Contatos */}
          {showPaste && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 border-2 border-purple-500/40 rounded-2xl p-8 max-w-lg w-full space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <FaClipboard className="text-purple-400" /> Colar Contatos
                  </h2>
                  <button onClick={() => setShowPaste(false)} className="text-gray-500 hover:text-white transition-all">
                    <FaTimesCircle className="text-xl" />
                  </button>
                </div>
                <p className="text-gray-400 text-sm">
                  Lista: <span className="text-white font-bold">{pasteListName}</span>
                </p>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300 space-y-1">
                  <p><strong>Como colar:</strong> Um e-mail por linha, ou e-mail,nome por linha.</p>
                  <p className="font-mono text-xs bg-black/30 rounded p-2 mt-1">
                    joao@email.com,João Silva<br />
                    maria@email.com<br />
                    pedro@email.com,Pedro
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-300">Cole os e-mails aqui</label>
                    {pasteText && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${validEmailCount > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {validEmailCount} e-mail{validEmailCount !== 1 ? 's' : ''} válido{validEmailCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder="joao@email.com,João Silva&#10;maria@email.com&#10;pedro@email.com,Pedro"
                    rows={10}
                    className="w-full px-4 py-3 bg-black/40 border-2 border-white/20 rounded-lg text-white text-sm font-mono focus:border-purple-500 focus:outline-none resize-y"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handlePasteImport}
                    disabled={pasteImporting || validEmailCount === 0}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {pasteImporting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                    {pasteImporting ? 'Importando...' : `Importar ${validEmailCount > 0 ? validEmailCount + ' contatos' : ''}`}
                  </button>
                  <button onClick={() => setShowPaste(false)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-4xl text-green-400 animate-spin" /></div>
          ) : lists.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
              <FaList className="text-6xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-4">Nenhuma lista criada ainda</p>
              <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold">Criar Primeira Lista</button>
            </div>
          ) : (
            <div className="space-y-4">
              {lists.map(l => (
                <div key={l.id} className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/20 rounded-xl">
                        <FaUsers className="text-2xl text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white">{l.name}</h3>
                        {l.description && <p className="text-gray-400 text-sm">{l.description}</p>}
                        <p className="text-gray-500 text-xs mt-1">
                          {l.total_contacts.toLocaleString('pt-BR')} contatos • Criada em {new Date(l.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Colar contatos */}
                      <button
                        onClick={() => openPasteModal(l.id, l.name)}
                        className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                      >
                        <FaClipboard /> Colar
                      </button>
                      {/* Importar CSV */}
                      <button
                        onClick={() => { setSelectedListId(l.id); fileRef.current?.click(); }}
                        disabled={importing === l.id}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
                      >
                        {importing === l.id ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                        Importar CSV
                      </button>
                      {/* Excluir */}
                      <button
                        onClick={() => handleDelete(l.id, l.name)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                      >
                        <FaTrash /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rodapé com instruções + botão modelo Excel */}
          <div className="mt-6 space-y-3">
            {/* Botão baixar modelo */}
            <div className="flex justify-end">
              <button
                onClick={downloadExcelTemplate}
                className="px-5 py-2.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
              >
                <FaFileExcel className="text-lg" /> Baixar Modelo Excel
              </button>
            </div>

            {/* Info CSV */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300">
              <strong>📋 Formato do arquivo CSV:</strong> O arquivo deve ter uma coluna chamada <code className="bg-white/10 px-1 rounded">email</code> (obrigatório) e opcionalmente <code className="bg-white/10 px-1 rounded">name</code> (nome do contato). Baixe o modelo acima para usar como referência no Excel.
              <code className="block mt-2 bg-black/30 rounded p-2">email,name<br />joao@email.com,João Silva<br />maria@email.com,Maria</code>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
