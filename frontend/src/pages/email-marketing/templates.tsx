import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaFileAlt, FaArrowLeft, FaPlus, FaEdit, FaTrash, FaSpinner, FaCheckCircle, FaTimes, FaEye, FaCopy } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';
import { useConfirm } from '@/hooks/useConfirm';

const EmailBodyEditor = dynamic(() => import('@/components/EmailBodyEditor'), { ssr: false });

interface Template {
  id: number;
  name: string;
  subject: string;
  subjects?: string[] | string | null;
  body_html: string;
  body_text: string;
  created_at: string;
}

function parseSubjects(t: Partial<Template> | null | undefined): string[] {
  if (!t) return [''];
  const raw = t.subjects;
  if (Array.isArray(raw) && raw.length) return raw.map(s => String(s || ''));
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map((s: any) => String(s || ''));
    } catch { /* ignore */ }
  }
  if (t.subject) return [String(t.subject)];
  return [''];
}

function subjectsLabel(t: Template): string {
  const list = parseSubjects(t).map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return 'Sem assunto';
  if (list.length === 1) return list[0];
  return `${list[0]} (+${list.length - 1})`;
}

export default function Templates() {
  const router = useRouter();
  const notification = useNotification();
  const { confirm, ConfirmDialog } = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formSubjects, setFormSubjects] = useState<string[]>(['']);
  const [formBodyHtml, setFormBodyHtml] = useState('');
  const [preview, setPreview] = useState<Template | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const r = await api.get('/email-marketing/templates');
      setTemplates(r.data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormSubjects(['']);
    setFormBodyHtml('');
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setFormName(t.name || '');
    setFormSubjects(parseSubjects(t));
    setFormBodyHtml(t.body_html || '');
    setShowModal(true);
  };

  const updateSubject = (i: number, value: string) => {
    setFormSubjects(prev => prev.map((s, idx) => (idx === i ? value : s)));
  };
  const addSubject = () => setFormSubjects(prev => [...prev, '']);
  const removeSubject = (i: number) => {
    setFormSubjects(prev => (prev.length <= 1 ? [''] : prev.filter((_, idx) => idx !== i)));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      notification.warning('Campo obrigatório', 'Informe o nome do template.');
      return;
    }
    const subjects = formSubjects.map(s => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        subject: subjects[0] || '',
        subjects,
        body_html: formBodyHtml,
        body_text: '',
      };
      if (editingId) {
        await api.put(`/email-marketing/templates/${editingId}`, payload);
        notification.success('Template atualizado!', '');
      } else {
        await api.post('/email-marketing/templates', payload);
        notification.success('Template criado!', '');
      }
      setShowModal(false);
      loadTemplates();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: 'Excluir Template',
      message: `Excluir "${name}"?\n\nSe alguma campanha estiver usando este modelo, ela será apenas desvinculada (o conteúdo da campanha permanece).`,
      confirmText: 'Sim, Excluir',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/email-marketing/templates/${id}`);
      notification.success('Excluído', '');
      loadTemplates();
    } catch (e: any) {
      notification.error('Erro', e.response?.data?.message || e.message);
    }
  };

  const handleClone = async (t: Template) => {
    const subjects = parseSubjects(t).map(s => s.trim()).filter(Boolean);
    try {
      const r = await api.post('/email-marketing/templates', {
        name: `${t.name} (cópia)`,
        subject: subjects[0] || t.subject || '',
        subjects,
        body_html: t.body_html || '',
        body_text: t.body_text || '',
      });
      notification.success('Template clonado!', 'Abra a cópia para ajustar o que precisar.');
      await loadTemplates();
      const created = r.data?.data;
      if (created?.id) openEdit(created);
    } catch (e: any) {
      notification.error('Erro ao clonar', e.response?.data?.message || e.message);
    }
  };

  const inputCls = 'w-full px-4 py-3 text-base bg-dark-700/80 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 transition-all';
  const labelCls = 'block text-sm font-bold mb-2 text-white/90';

  return (
    <>
      <Head><title>Templates | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <ConfirmDialog />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 border-2 border-purple-500/40 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl shadow-purple-500/20 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="bg-gradient-to-br from-purple-500 to-purple-600 text-white font-black w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-lg">
                  {editingId ? '✏️' : '+'}
                </span>
                {editingId ? 'Editar' : 'Criar'} Template
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              <div>
                <label className={labelCls}>Nome do Template *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Boas-vindas"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Assuntos <span className="text-white/40 font-normal">(opcional)</span></label>
                <p className="text-xs text-white/50 mb-3">
                  Pode deixar vazio ou cadastrar vários — na campanha o sistema varia o assunto a cada envio.
                </p>
                <div className="space-y-3">
                  {formSubjects.map((s, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-bold mb-1 text-white/60">Assunto {i + 1}</label>
                        <input
                          type="text"
                          value={s}
                          onChange={e => updateSubject(i, e.target.value)}
                          placeholder={`Assunto ${i + 1}`}
                          className={inputCls}
                        />
                      </div>
                      {formSubjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubject(i)}
                          className="mb-0.5 p-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSubject}
                    className="w-full py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-2 border-dashed border-purple-500/40 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <FaPlus /> Adicionar assunto
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Corpo do E-mail</label>
                <EmailBodyEditor
                  value={formBodyHtml}
                  onChange={html => setFormBodyHtml(html)}
                  accent="purple"
                  minHeight={200}
                  placeholder="Digite ou cole o conteúdo do template..."
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-white/10 flex-shrink-0 bg-dark-800">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-black text-base flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-purple-500/30 transition-all"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                {editingId ? 'Salvar Alterações' : 'Criar Template'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div>
                <p className="text-sm text-gray-500 font-bold">{preview.name}</p>
                <p className="font-bold text-gray-800">{subjectsLabel(preview)}</p>
                {parseSubjects(preview).filter(Boolean).length > 1 && (
                  <ul className="mt-1 text-xs text-gray-500 list-disc list-inside">
                    {parseSubjects(preview).filter(Boolean).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-all">
                <FaTimes className="text-xl" />
              </button>
            </div>
            <div className="p-6" dangerouslySetInnerHTML={{ __html: preview.body_html || '<p class="text-gray-400">Sem conteúdo HTML</p>' }} />
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
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
                  <p className="text-xl text-white/80 font-medium">
                    {templates.length} template{templates.length !== 1 ? 's' : ''} criado{templates.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={openCreate}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl font-black text-lg transition-all flex items-center gap-3 shadow-xl shadow-purple-500/30 hover:scale-105"
              >
                <FaPlus /> Novo Template
              </button>
            </div>
          </div>

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
                      <p className="text-gray-400 text-sm truncate mt-0.5">{subjectsLabel(t)}</p>
                      <p className="text-gray-600 text-xs mt-1">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {t.body_html && (
                    <div className="bg-black/20 rounded-xl p-3 mb-4 max-h-16 overflow-hidden">
                      <p className="text-gray-500 text-xs font-mono truncate">
                        {t.body_html.replace(/<[^>]+>/g, ' ').trim().substring(0, 80)}...
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPreview(t)} className="flex-1 min-w-[5.5rem] py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FaEye /> Preview
                    </button>
                    <button onClick={() => openEdit(t)} className="flex-1 min-w-[5.5rem] py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FaEdit /> Editar
                    </button>
                    <button
                      onClick={() => handleClone(t)}
                      title="Clonar template"
                      className="flex-1 min-w-[5.5rem] py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <FaCopy /> Clonar
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
