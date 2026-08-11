import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaFileAlt, FaArrowLeft, FaPlus, FaEdit, FaTrash, FaSpinner, FaCheckCircle, FaTimes, FaEye } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

interface Template { id: number; name: string; subject: string; body_html: string; body_text: string; created_at: string; }

const emptyForm = { name: '', subject: '', body_html: '', body_text: '' };

export default function Templates() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [preview, setPreview] = useState<Template | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try { const r = await api.get('/email-marketing/templates'); setTemplates(r.data.data || []); }
    catch { } finally { setLoading(false); }
  };

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (t: Template) => { setEditingId(t.id); setForm({ name: t.name, subject: t.subject, body_html: t.body_html || '', body_text: t.body_text || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name || !form.subject) { notification.warning('Campos obrigatórios', 'Nome e assunto são obrigatórios.'); return; }
    setSaving(true);
    try {
      if (editingId) { await api.put(`/email-marketing/templates/${editingId}`, form); notification.success('Template atualizado!', ''); }
      else { await api.post('/email-marketing/templates', form); notification.success('Template criado!', ''); }
      setShowModal(false); loadTemplates();
    } catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir Template', message: `Excluir "${name}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/email-marketing/templates/${id}`); notification.success('Excluído', ''); loadTemplates(); }
    catch (e: any) { notification.error('Erro', e.response?.data?.message || e.message); }
  };

  const inputCls = 'w-full px-6 py-4 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all';
  const labelCls = 'block text-base font-bold mb-3 text-white/90';

  return (
    <>
      <Head><title>Templates | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-800 border-2 border-purple-500/40 rounded-2xl p-8 max-w-3xl w-full space-y-5 my-4 shadow-2xl shadow-purple-500/20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <span className="bg-gradient-to-br from-purple-500 to-purple-600 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center text-base shadow-lg">{editingId ? '✏️' : '+'}</span>
                {editingId ? 'Editar' : 'Criar'} Template
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><FaTimes className="text-xl" /></button>
            </div>
            <div>
              <label className={labelCls}>Nome do Template *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Boas-vindas" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assunto Padrão *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Assunto do e-mail" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Corpo HTML</label>
              <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Conteúdo do template...</p>"
                rows={14}
                className="w-full px-5 py-4 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all font-mono resize-y" />
              <p className="text-sm text-white/50 mt-2">
                Variáveis: <code className="bg-white/10 px-1 rounded">{'{{nome}}'}</code> e <code className="bg-white/10 px-1 rounded">{'{{email}}'}</code>
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-purple-500/30 transition-all">
                {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} {editingId ? 'Salvar Alterações' : 'Criar Template'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <p className="text-sm text-gray-500 font-bold">{preview.name}</p>
                <p className="font-bold text-gray-800">{preview.subject}</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-all"><FaTimes className="text-xl" /></button>
            </div>
            <div className="p-6" dangerouslySetInnerHTML={{ __html: preview.body_html || '<p class="text-gray-400">Sem conteúdo HTML</p>' }} />
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/30 via-purple-500/20 to-purple-600/30 backdrop-blur-xl border-2 border-purple-500/40 rounded-3xl p-10 shadow-2xl shadow-purple-500/20">
            <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                  <FaArrowLeft className="text-xl" />
                </button>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-lg shadow-purple-500/50">
                  <FaFileAlt className="text-5xl text-white" />
                </div>
                <div>
                  <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Templates</h1>
                  <p className="text-xl text-white/80 font-medium">{templates.length} template{templates.length !== 1 ? 's' : ''} criado{templates.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={openCreate}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl font-black text-lg transition-all flex items-center gap-3 shadow-xl shadow-purple-500/30 hover:scale-105">
                <FaPlus /> Novo Template
              </button>
            </div>
          </div>

          {/* LISTA */}
          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-5xl text-purple-400 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/20 rounded-2xl p-16 text-center">
              <div className="bg-purple-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaFileAlt className="text-5xl text-purple-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Nenhum template criado</h3>
              <p className="text-gray-400 mb-6">Crie modelos reutilizáveis para suas campanhas</p>
              <button onClick={openCreate} className="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl font-black text-lg inline-flex items-center gap-3 shadow-xl">
                <FaPlus /> Criar Primeiro Template
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bg-dark-800/60 backdrop-blur-xl border-2 border-purple-500/20 hover:border-purple-500/40 rounded-2xl p-6 shadow-xl transition-all duration-300">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-purple-500/20 p-3 rounded-xl flex-shrink-0">
                      <FaFileAlt className="text-2xl text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-white truncate">{t.name}</h3>
                      <p className="text-gray-400 text-sm truncate mt-0.5">{t.subject}</p>
                      <p className="text-gray-600 text-xs mt-1">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {t.body_html && (
                    <div className="bg-black/20 rounded-xl p-3 mb-4 max-h-16 overflow-hidden">
                      <p className="text-gray-500 text-xs font-mono truncate">{t.body_html.replace(/<[^>]+>/g, ' ').trim().substring(0, 80)}...</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setPreview(t)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FaEye /> Preview
                    </button>
                    <button onClick={() => openEdit(t)} className="flex-1 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FaEdit /> Editar
                    </button>
                    <button onClick={() => handleDelete(t.id, t.name)} className="py-2.5 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-sm transition-all">
                      <FaTrash />
                    </button>
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
