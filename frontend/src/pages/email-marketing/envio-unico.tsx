import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaPaperPlane, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import api from '@/services/api';
import { useNotification } from '@/hooks/useNotification';

interface Domain { id: number; domain: string; status: string; }

export default function EnvioUnico() {
  const router = useRouter();
  const notification = useNotification();
  const [sending, setSending] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [form, setForm] = useState({
    to_email: '', to_name: '', from_name: '', from_email: '',
    reply_to: '', subject: '', body_html: '', domain_id: '',
  });

  useEffect(() => {
    api.get('/email-marketing/domains').then(r => {
      setDomains((r.data.data || []).filter((d: Domain) => d.status === 'active'));
    }).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!form.to_email || !form.from_email || !form.subject || !form.body_html) {
      notification.warning('Campos obrigatórios', 'Preencha destinatário, remetente, assunto e corpo do e-mail.');
      return;
    }
    setSending(true);
    try {
      await api.post('/email-marketing/send-single', { ...form, domain_id: form.domain_id || undefined });
      notification.success('E-mail enviado!', `E-mail enviado com sucesso para ${form.to_email}`);
      setForm({ to_email: '', to_name: '', from_name: '', from_email: '', reply_to: '', subject: '', body_html: '', domain_id: '' });
    } catch (error: any) {
      notification.error('Erro ao enviar', error.response?.data?.message || error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Head><title>Envio Único | E-mail Marketing</title></Head>
      <notification.NotificationContainer />
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/email-marketing')} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <FaArrowLeft />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <FaPaperPlane className="text-blue-400" /> Envio Único
              </h1>
              <p className="text-gray-400">Envie um e-mail para um destinatário específico</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-8 border border-white/10 space-y-5">
            {/* Domínio */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Domínio de Envio</label>
              <select
                value={form.domain_id}
                onChange={e => setForm({ ...form, domain_id: e.target.value })}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Automático</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
              </select>
            </div>

            {/* Remetente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome do Remetente *</label>
                <input
                  type="text" value={form.from_name}
                  onChange={e => setForm({ ...form, from_name: e.target.value })}
                  placeholder="Minha Empresa"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">E-mail Remetente *</label>
                <input
                  type="email" value={form.from_email}
                  onChange={e => setForm({ ...form, from_email: e.target.value })}
                  placeholder="contato@seudominio.com"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Reply-to */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Responder Para (Reply-To)</label>
              <input
                type="email" value={form.reply_to}
                onChange={e => setForm({ ...form, reply_to: e.target.value })}
                placeholder="respostas@seudominio.com"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Destinatário */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">Nome do Destinatário</label>
                <input
                  type="text" value={form.to_name}
                  onChange={e => setForm({ ...form, to_name: e.target.value })}
                  placeholder="João Silva"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">E-mail Destinatário *</label>
                <input
                  type="email" value={form.to_email}
                  onChange={e => setForm({ ...form, to_email: e.target.value })}
                  placeholder="cliente@email.com"
                  className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Assunto */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Assunto *</label>
              <input
                type="text" value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Assunto do e-mail"
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Corpo HTML */}
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2">Corpo do E-mail (HTML) *</label>
              <textarea
                value={form.body_html}
                onChange={e => setForm({ ...form, body_html: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Seu conteúdo aqui...</p>"
                rows={10}
                className="w-full px-4 py-3 bg-black/30 border-2 border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono text-sm resize-y"
              />
              <p className="text-xs text-gray-500 mt-1">Use <code className="bg-white/10 px-1 rounded">{`{{nome}}`}</code> e <code className="bg-white/10 px-1 rounded">{`{{email}}`}</code> para personalização.</p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {sending ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Enviando...</>
              ) : (
                <><FaPaperPlane /> Enviar E-mail</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
