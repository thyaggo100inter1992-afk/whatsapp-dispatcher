import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaList, FaArrowLeft, FaPlus, FaTrash, FaUpload, FaUsers, FaSpinner, FaCheckCircle, FaClipboard, FaFileExcel, FaTimesCircle, FaTimes } from 'react-icons/fa';
import * as XLSX from 'xlsx';
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
    try { const r = await api.get('/email-marketing/lists'); setLists(r.data.data || []); }
    catch { } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newList.name) { notification.warning('Campo obrigatório', 'Informe o nome da lista.'); return; }
    setCreating(true);
    try {
      await api.post('/email-marketing/lists', newList);
      notification.success('Lista criada!', '');
      setShowCreate(false); setNewList({ name: '', description: '' }); loadLists();
    } catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir Lista', message: `Excluir "${name}" e todos os seus contatos?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/email-marketing/lists/${id}`); notification.success('Lista excluída', ''); loadLists(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };

  const handleImport = async (listId: number, file: File) => {
    setImporting(listId);
    try {
      let uploadFile = file;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        if (!rows.length) throw new Error('Planilha vazia');
        // Normaliza cabeçalho e gera CSV com ; (Excel BR)
        const csvText = rows.map(r =>
          [r[0], r[1], r[2], r[3]].map(c => String(c ?? '').replace(/"/g, '""')).map(c => `"${c}"`).join(';')
        ).join('\n');
        uploadFile = new File([csvText], 'contatos.csv', { type: 'text/csv' });
      }
      const formData = new FormData();
      formData.append('file', uploadFile);
      const r = await api.post(`/email-marketing/lists/${listId}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      notification.success('Importação concluída!', `${r.data.imported} contatos importados de ${r.data.total}.`);
      loadLists();
    } catch (e: any) { notification.error('Erro na importação', e.response?.data?.message || e.message); }
    finally { setImporting(null); }
  };

  const handlePasteImport = async () => {
    if (!pasteListId || !pasteText.trim()) { notification.warning('Atenção', 'Cole ao menos um e-mail.'); return; }
    const lines = pasteText.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { notification.warning('Atenção', 'Nenhum e-mail encontrado.'); return; }
    const csvLines = ['email;nome;cpf;telefone'];
    for (const line of lines) {
      if (/^email\b/i.test(line) && !line.includes('@')) continue;
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      const emailIdx = parts.findIndex(p => p.includes('@'));
      if (emailIdx < 0) continue;
      const email = parts[emailIdx];
      const others = parts.filter((_, i) => i !== emailIdx);
      const name = others[0] || '';
      const cpf = others[1] || '';
      const phone = others[2] || '';
      csvLines.push([email, name, cpf, phone].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }
    if (csvLines.length <= 1) { notification.warning('Nenhum e-mail válido', 'Verifique se os endereços contêm "@".'); return; }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const file = new File([blob], 'contatos.csv', { type: 'text/csv' });
    setPasteImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await api.post(`/email-marketing/lists/${pasteListId}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      notification.success('Importação concluída!', `${r.data.imported} contatos importados de ${r.data.total}.`);
      setShowPaste(false); setPasteText(''); loadLists();
    } catch (e: any) { notification.error('Erro na importação', e.response?.data?.message || e.message); }
    finally { setPasteImporting(false); }
  };

  const downloadExcelTemplate = () => {
    const rows = [
      ['email', 'nome', 'cpf', 'telefone'],
      ['joao.silva@email.com', 'João Silva', '123.456.789-00', '(11) 98888-7777'],
      ['maria.santos@email.com', 'Maria Santos', '', ''],
      ['pedro.oliveira@gmail.com', 'Pedro Oliveira', '98765432100', '11999998888'],
      ['ana.costa@hotmail.com', 'Ana Costa', '', '11988887777'],
      ['carlos.mendes@empresa.com.br', 'Carlos Mendes', '11144477735', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    XLSX.writeFile(wb, 'modelo-lista-contatos.xlsx');
    notification.success('Download iniciado!', 'Abra no Excel: cada campo já vem em uma coluna.');
  };

  const openPasteModal = (id: number, name: string) => { setPasteListId(id); setPasteListName(name); setPasteText(''); setShowPaste(true); };

  const validEmailCount = pasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes('@')).length;

  const inputCls = 'w-full px-6 py-4 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-green-500 focus:ring-4 focus:ring-green-500/30 transition-all';
  const labelCls = 'block text-base font-bold mb-3 text-white/90';

  return (
    <>
      <Head><title>Listas de Contatos | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => {
        const file = e.target.files?.[0];
        if (file && selectedListId) handleImport(selectedListId, file);
        e.target.value = '';
      }} />

      {/* Modal Criar */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-green-500/40 rounded-2xl p-8 max-w-md w-full space-y-5 shadow-2xl shadow-green-500/20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <span className="bg-gradient-to-br from-green-500 to-green-600 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">+</span>
                Nova Lista de Contatos
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><FaTimes className="text-xl" /></button>
            </div>
            <div>
              <label className={labelCls}>Nome *</label>
              <input type="text" value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })}
                placeholder="Ex: Leads Novembro 2026" onKeyDown={e => e.key === 'Enter' && handleCreate()} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input type="text" value={newList.description} onChange={e => setNewList({ ...newList, description: e.target.value })}
                placeholder="Descrição opcional" className={inputCls} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-green-500/30 transition-all">
                {creating ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} Criar Lista
              </button>
              <button onClick={() => setShowCreate(false)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Colar Contatos */}
      {showPaste && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border-2 border-purple-500/40 rounded-2xl p-8 max-w-lg w-full space-y-5 shadow-2xl shadow-purple-500/20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <span className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-xl shadow-lg"><FaClipboard className="text-white text-xl" /></span>
                Colar Contatos
              </h2>
              <button onClick={() => setShowPaste(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><FaTimesCircle className="text-xl" /></button>
            </div>
            <p className="text-gray-400">Lista: <span className="text-white font-bold">{pasteListName}</span></p>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-300 space-y-2">
              <p><strong>Como colar:</strong> Um contato por linha no formato <code className="bg-black/30 px-1 rounded">email,nome,cpf,telefone</code>. CPF e telefone são opcionais.</p>
              <code className="block font-mono text-xs bg-black/30 rounded-lg p-3">
                joao@email.com,João Silva,123.456.789-00,(11) 98888-7777<br />
                maria@email.com,Maria Santos<br />
                pedro@email.com
              </code>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelCls}>Cole os e-mails aqui</label>
                {pasteText && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${validEmailCount > 0 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                    {validEmailCount} e-mail{validEmailCount !== 1 ? 's' : ''} válido{validEmailCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="joao@email.com,João Silva,123.456.789-00,(11) 98888-7777&#10;maria@email.com,Maria&#10;pedro@email.com"
                rows={10}
                className="w-full px-5 py-4 text-sm bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 font-mono resize-y transition-all" />
            </div>
            <div className="flex gap-3">
              <button onClick={handlePasteImport} disabled={pasteImporting || validEmailCount === 0}
                className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-500/30 transition-all">
                {pasteImporting ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                {pasteImporting ? 'Importando...' : `Importar ${validEmailCount > 0 ? validEmailCount + ' contatos' : ''}`}
              </button>
              <button onClick={() => setShowPaste(false)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-green-600/30 via-green-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl shadow-green-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                  <FaArrowLeft className="text-xl" />
                </button>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-lg shadow-green-500/50">
                  <FaList className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Listas de Contatos</h1>
                  <p className="text-xl text-white/80 font-medium">
                    {lists.length} lista{lists.length !== 1 ? 's' : ''} •{' '}
                    {lists.reduce((s, l) => s + l.total_contacts, 0).toLocaleString('pt-BR')} contatos no total
                  </p>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={downloadExcelTemplate}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white border-2 border-white/20 hover:border-white/30 rounded-2xl font-bold text-base transition-all flex items-center gap-3">
                  <FaFileExcel className="text-green-400 text-xl" /> Baixar Modelo Excel
                </button>
                <button onClick={() => setShowCreate(true)}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-2xl font-black text-lg transition-all flex items-center gap-3 shadow-xl shadow-green-500/30 hover:scale-105">
                  <FaPlus /> Nova Lista
                </button>
              </div>
            </div>
          </div>

          {/* Info CSV */}
          <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-5 text-sm text-blue-300">
            <strong>📋 Modelo Excel:</strong> Baixe o modelo — as colunas já vêm separadas (<code className="bg-white/10 px-1 rounded">email</code> | <code className="bg-white/10 px-1 rounded">nome</code> | <code className="bg-white/10 px-1 rounded">cpf</code> | <code className="bg-white/10 px-1 rounded">telefone</code>). CPF e telefone são opcionais. Aceita <strong>.xlsx</strong> ou <strong>.csv</strong>.
          </div>

          {/* LISTA */}
          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-5xl text-green-400 animate-spin" /></div>
          ) : lists.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/20 rounded-2xl p-16 text-center">
              <div className="bg-green-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaList className="text-5xl text-green-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Nenhuma lista criada</h3>
              <p className="text-gray-400 mb-6">Crie listas para organizar seus contatos por segmento</p>
              <button onClick={() => setShowCreate(true)} className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-black text-lg inline-flex items-center gap-3 shadow-xl">
                <FaPlus /> Criar Primeira Lista
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {lists.map(l => (
                <div key={l.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-green-500/20 hover:border-green-500/40 rounded-2xl p-6 shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-green-500/20 rounded-xl">
                        <FaUsers className="text-2xl text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white">{l.name}</h3>
                        {l.description && <p className="text-gray-400 text-sm mt-0.5">{l.description}</p>}
                        <p className="text-gray-500 text-sm mt-1">
                          <span className="text-green-300 font-bold">{l.total_contacts.toLocaleString('pt-BR')}</span> contatos
                          {' '}• Criada em {new Date(l.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openPasteModal(l.id, l.name)}
                        className="px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                        <FaClipboard /> Colar
                      </button>
                      <button onClick={() => { setSelectedListId(l.id); fileRef.current?.click(); }} disabled={importing === l.id}
                        className="px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-all">
                        {importing === l.id ? <FaSpinner className="animate-spin" /> : <FaUpload />} Importar Excel/CSV
                      </button>
                      <button onClick={() => handleDelete(l.id, l.name)}
                        className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                        <FaTrash /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
