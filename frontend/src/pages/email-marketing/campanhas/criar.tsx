import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaBullhorn, FaArrowLeft, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface Domain { id: number; domain: string; status: string; }
interface EmailList { id: number; name: string; total_contacts: number; }
interface Template { id: number; name: string; subject: string; body_html: string; }

export default function CriarCampanha() {
  const router = useRouter();
  const notification = useNotification();
  const [saving, setSaving] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({
    name: '', subject: '', from_name: '', from_email: '', reply_to: '',
    domain_id: '', list_id: '', template_id: '', body_html: '', delay_seconds: 2,
  });

  useEffect(() => {
    Promise.all([
      api.get('/email-marketing/domains'),
      api.get('/email-marketing/lists'),
      api.get('/email-marketing/templates'),
    ]).then(([d, l, t]) => {
      setDomains((d.data.data || []).filter((x: Domain) => x.status === 'active'));
      setLists(l.data.data || []);
      setTemplates(t.data.data || []);
    }).catch(() => {});
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setForm({ ...form, template_id: templateId });
    if (templateId) {
      const tpl = templates.find(t => t.id === parseInt(templateId));
      if (tpl) setForm(f => ({ ...f, template_id: templateId, subject: tpl.subject || f.subject, body_html: tpl.body_html || f.body_html }));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.from_name || !form.from_email) {
      notification.warning('Campos obrigatórios', 'Preencha nome, assunto, nome e e-mail do remetente.');
      return;
    }
    if (!form.list_id) {
      notification.warning('Lista obrigatória', 'Selecione uma lista de contatos para a campanha.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        domain_id: form.domain_id || null,
        list_id: form.list_id || null,
        template_id: form.template_id || null,
      };
      await api.post('/email-marketing/campaigns', payload);
      notification.success('Campanha criada!', 'Acesse a lista de campanhas para iniciar o envio.');
      router.push('/email-marketing/campanhas');
    } catch (error: any) {
      notification.error('Erro ao criar campanha', error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>Criar Campanha | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/email-marketing/campanhas')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <FaArrowLeft />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3"><FaBullhorn className="text-orange-400" /> Nova Campanha</h1>
              <p className="text-gray-400">Configure e crie sua campanha de e-mail</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-8 border border-white/10 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Nome da Campanha *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Promoção Black Friday 2026"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Domínio de Envio</label>
              <select value={form.domain_id} onChange={e => setForm({ ...form, domain_id: e.target.value })}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none">
                <option value="">Selecione um domínio ativo</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
              </select>
              {domains.length === 0 && (
                <p className="text-yellow-400 text-xs mt-1">⚠️ Nenhum domínio ativo. <span className="underline cursor-pointer" onClick={() => router.push('/email-marketing/dominios')}>Configurar domínio</span></p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome do Remetente *</label>
                <input type="text" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })}
                  placeholder="Minha Empresa"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">E-mail Remetente *</label>
                <input type="email" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })}
                  placeholder="noreply@seudominio.com"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Responder Para (Reply-To)</label>
              <input type="email" value={form.reply_to} onChange={e => setForm({ ...form, reply_to: e.target.value })}
                placeholder="respostas@seudominio.com"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Lista de Contatos *</label>
              <select value={form.list_id} onChange={e => setForm({ ...form, list_id: e.target.value })}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none">
                <option value="">Selecione uma lista</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.total_contacts} contatos)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Template (opcional)</label>
              <select value={form.template_id} onChange={e => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none">
                <option value="">Usar HTML personalizado abaixo</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Assunto do E-mail *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Assunto da campanha"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Corpo do E-mail (HTML)</label>
              <textarea value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Conteúdo da sua campanha...</p>"
                rows={8}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none font-mono text-sm resize-y" />
              <p className="text-xs text-gray-500 mt-1">Use <code className="bg-white/10 px-1 rounded">{`{{nome}}`}</code> e <code className="bg-white/10 px-1 rounded">{`{{email}}`}</code> para personalização por destinatário.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Intervalo entre envios (segundos)</label>
              <input type="number" min={1} max={60} value={form.delay_seconds} onChange={e => setForm({ ...form, delay_seconds: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-orange-500 focus:outline-none" />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 1-3 segundos para evitar bloqueios.</p>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50">
              {saving ? <><FaSpinner className="animate-spin" /> Criando...</> : <><FaCheckCircle /> Criar Campanha</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
