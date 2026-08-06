import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaFileAlt, FaArrowLeft, FaPlus, FaEdit, FaTrash, FaSpinner, FaCheckCircle, FaTimes } from 'react-icons/fa';
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
    try {
      const r = await api.get('/email-marketing/templates');
      setTemplates(r.data.data || []);
    } catch { } finally { setLoading(false); }
  };

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (t: Template) => { setEditingId(t.id); setForm({ name: t.name, subject: t.subject, body_html: t.body_html || '', body_text: t.body_text || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name || !form.subject) { notification.warning('Campos obrigatórios', 'Nome e assunto são obrigatórios.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/email-marketing/templates/${editingId}`, form);
        notification.success('Template atualizado!', '');
      } else {
        await api.post('/email-marketing/templates', form);
        notification.success('Template criado!', '');
      }
      setShowModal(false);
      loadTemplates();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({ title: 'Excluir Template', message: `Excluir o template "${name}"?`, confirmText: 'Sim, Excluir', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/templates/${id}`);
      notification.success('Template excluído', '');
      loadTemplates();
    } catch (error: any) {
      notification.error('Erro', error.response?.data?.message || error.message);
    }
  };

  return (
    <>
      <Head><title>Templates | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {/* Modal Criar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border-2 border-purple-500/40 rounded-2xl p-8 max-w-3xl w-full space-y-4 my-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{editingId ? 'Editar' : 'Criar'} Template</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400"><FaTimes /></button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Nome do Template *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Boas-vindas"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Assunto Padrão *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Assunto do e-mail"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Corpo HTML</label>
              <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Conteúdo do template...</p>"
                rows={12}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-purple-500 focus:outline-none font-mono text-sm resize-y" />
              <p className="text-xs text-gray-500 mt-1">Variáveis disponíveis: <code className="bg-white/10 px-1 rounded">{`{{nome}}`}</code> e <code className="bg-white/10 px-1 rounded">{`{{email}}`}</code></p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />} {editingId ? 'Salvar' : 'Criar'}
              </button>
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-bold text-gray-800">{preview.subject}</span>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-100 rounded"><FaTimes /></button>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: preview.body_html || '<p>Sem conteúdo HTML</p>' }} />
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
                <FaArrowLeft />
              </button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3"><FaFileAlt className="text-purple-400" /> Templates</h1>
                <p className="text-gray-400">{templates.length} template(s)</p>
              </div>
            </div>
            <button onClick={openCreate} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              <FaPlus /> Novo Template
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><FaSpinner className="text-4xl text-purple-400 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
              <FaFileAlt className="text-6xl text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-4">Nenhum template criado ainda</p>
              <button onClick={openCreate} className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold">Criar Primeiro Template</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {templates.map(t => (
                <div key={t.id} className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">{t.name}</h3>
                      <p className="text-gray-400 text-sm">{t.subject}</p>
                      <p className="text-gray-600 text-xs mt-1">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setPreview(t)} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-sm flex items-center gap-1">
                      👁️ Preview
                    </button>
                    <button onClick={() => openEdit(t)} className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg text-sm flex items-center gap-1">
                      <FaEdit /> Editar
                    </button>
                    <button onClick={() => handleDelete(t.id, t.name)} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-sm flex items-center gap-1">
                      <FaTrash /> Excluir
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
