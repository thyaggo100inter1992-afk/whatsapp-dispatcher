import { FormEvent, useState } from 'react';
import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS } from '@/data/institucional';
import { getApiBaseUrl } from '@/utils/urlHelpers';

export default function InstitucionalCadastroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk(false);
    if (!consent) {
      setErr('É necessário marcar o consentimento para receber comunicações.');
      return;
    }
    if (!email.includes('@')) {
      setErr('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      const base = getApiBaseUrl();
      const r = await fetch(`${base}/api/public/institucional/opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          company: company.trim(),
          consent: true,
          source: 'institucional-cadastro',
          privacy_url: `${INSTITUCIONAL.siteBase}${PATHS.privacidade}`,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        throw new Error(data.message || 'Não foi possível registrar o opt-in.');
      }
      setOk(true);
      setName('');
      setEmail('');
      setCompany('');
      setConsent(false);
    } catch (ex: any) {
      setErr(ex.message || 'Erro ao enviar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <InstitucionalLayout
      title="Cadastro e opt-in"
      description="Página de inscrição com consentimento explícito para comunicações da NETTSISTEMAS / Disparador NettSistemas."
    >
      <section className="inst-hero inst-wrap" style={{ paddingBottom: '1rem' }}>
        <h1 style={{ maxWidth: '14ch' }}>Cadastro / Opt-in</h1>
        <p className="lead">
          Esta página demonstra o fluxo de <strong style={{ color: '#e8eef7' }}>consentimento explícito</strong> para receber
          comunicações. Empresas clientes da plataforma também coletam opt-in em seus próprios canais antes de disparar
          campanhas.
        </p>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-card" style={{ maxWidth: 560 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Quero receber novidades</h2>
          <p style={{ marginBottom: '1rem' }}>
            Ao enviar, você autoriza a {INSTITUCIONAL.razaoSocial} a enviar e-mails sobre o produto{' '}
            {INSTITUCIONAL.produto}. Você pode cancelar a qualquer momento.
          </p>

          {ok && (
            <div className="inst-alert" style={{ marginBottom: '1rem' }}>
              Opt-in registrado com sucesso. Obrigado!
            </div>
          )}
          {err && (
            <div className="inst-alert inst-alert-err" style={{ marginBottom: '1rem' }}>
              {err}
            </div>
          )}

          <form className="inst-form" onSubmit={onSubmit}>
            <label>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
              />
            </label>
            <label>
              Empresa (opcional)
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" />
            </label>
            <label className="inst-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Li e concordo com a{' '}
                <Link href={PATHS.privacidade}>Política de Privacidade</Link> e autorizo o envio de comunicações por
                e-mail. Posso cancelar a inscrição a qualquer momento pelo link nos e-mails.
              </span>
            </label>
            <button type="submit" className="inst-btn inst-btn-primary" disabled={loading} style={{ border: 0, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Enviando…' : 'Confirmar inscrição'}
            </button>
          </form>
        </div>

        <div className="inst-card" style={{ marginTop: '1rem', maxWidth: 560 }}>
          <h3>Prova para provedores (SendGrid)</h3>
          <p>
            URL pública desta página de opt-in:{' '}
            <strong style={{ color: '#e8eef7' }}>
              {INSTITUCIONAL.siteBase}
              {PATHS.cadastro}
            </strong>
          </p>
        </div>
      </section>
    </InstitucionalLayout>
  );
}
