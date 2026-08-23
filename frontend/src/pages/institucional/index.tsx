import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

export default function InstitucionalHomePage() {
  return (
    <InstitucionalLayout
      title="Empresa e modelo de negócio"
      description="NETTSISTEMAS — plataforma B2B de e-mail marketing e comunicação para outras empresas, com entrega via SendGrid e práticas de opt-in."
    >
      <section className="inst-hero inst-wrap">
        <p style={{ color: '#2dd4bf', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          SITE INSTITUCIONAL · COMPLIANCE / SENDGRID
        </p>
        <h1>{INSTITUCIONAL.nomeFantasia}</h1>
        <p className="lead">
          Somos uma empresa de tecnologia que oferece uma <strong style={{ color: '#e8eef7' }}>plataforma SaaS B2B</strong> de
          comunicação (e-mail marketing e WhatsApp) para <strong style={{ color: '#e8eef7' }}>outras empresas</strong>. Nossos
          clientes usam o sistema para falar com as bases deles — comércio, serviços locais, saúde, educação, prestadores e
          demais segmentos.
        </p>
        <div className="inst-cta-row">
          <Link href={PATHS.cadastro} className="inst-btn inst-btn-primary">
            Página de opt-in (cadastro)
          </Link>
          <Link href={PATHS.amostra} className="inst-btn inst-btn-ghost">
            Ver amostra de e-mail
          </Link>
          <a href={PATHS.pdf} className="inst-btn inst-btn-ghost" download>
            Baixar amostra PDF
          </a>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <h2>Modelo de negócio</h2>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>O que vendemos</h3>
            <p>
              Licença/uso da plataforma <strong style={{ color: '#e8eef7' }}>{INSTITUCIONAL.produto}</strong>: disparo e gestão
              de campanhas de e-mail marketing e canais de mensagem para empresas clientes.
            </p>
          </article>
          <article className="inst-card">
            <h3>Como usamos a SendGrid</h3>
            <p>
              A SendGrid é o <strong style={{ color: '#e8eef7' }}>provedor de entrega (API)</strong>. A NETTSISTEMAS opera a
              plataforma; cada empresa-cliente envia para a própria audiência, com consentimento e opt-out.
            </p>
          </article>
          <article className="inst-card">
            <h3>Segmentos atendidos</h3>
            <p>
              Múltiplos setores: serviços locais, varejo, clínicas, educação, prestadores, e-commerce e outros negócios que
              precisam de comunicação legítima com clientes e leads.
            </p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <h2>Tipos de e-mail</h2>
        <ul className="inst-list">
          <li>
            <strong style={{ color: '#e8eef7' }}>Marketing</strong> — campanhas, novidades e ofertas enviadas pelos clientes da
            plataforma às bases com opt-in.
          </li>
          <li>
            <strong style={{ color: '#e8eef7' }}>Transacional</strong> — avisos operacionais (confirmações, senhas, recibos e
            notificações do sistema), quando aplicável.
          </li>
        </ul>
      </section>

      <section className="inst-section inst-wrap">
        <h2>Conformidade e prova de uso</h2>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Opt-in</h3>
            <p>
              Cadastro público com consentimento explícito:{' '}
              <Link href={PATHS.cadastro}>{INSTITUCIONAL.siteBase}{PATHS.cadastro}</Link>
            </p>
          </article>
          <article className="inst-card">
            <h3>Cancelar inscrição</h3>
            <p>
              Todo e-mail de marketing inclui link de cancelamento (List-Unsubscribe / rodapé). A amostra demonstra o
              elemento obrigatório.
            </p>
          </article>
          <article className="inst-card">
            <h3>Privacidade e endereço</h3>
            <p>
              Política publicada em{' '}
              <Link href={PATHS.privacidade}>{PATHS.privacidade}</Link>. Endereço físico no rodapé dos e-mails:{' '}
              {enderecoCompleto()}.
            </p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <h2>Responsável pela conta</h2>
        <div className="inst-card">
          <p>
            <strong style={{ color: '#e8eef7' }}>{INSTITUCIONAL.responsavel}</strong> — {INSTITUCIONAL.cargo}
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            LinkedIn:{' '}
            <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
              {INSTITUCIONAL.linkedin}
            </a>
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            Contato: {INSTITUCIONAL.email} · {INSTITUCIONAL.telefoneFmt}
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            CNPJ {INSTITUCIONAL.cnpj} · {enderecoCompleto()}
          </p>
        </div>
      </section>
    </InstitucionalLayout>
  );
}
