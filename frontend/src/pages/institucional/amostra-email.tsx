import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

const UNSUBSCRIBE_DEMO =
  'https://api.sistemasnettsistemas.com.br/api/public/email-unsubscribe?t=demo-sample-for-compliance';

export default function InstitucionalAmostraPage() {
  return (
    <InstitucionalLayout
      title="Amostra de e-mail marketing"
      description="Exemplo de conteúdo de e-mail marketing da NETTSISTEMAS com cancelamento de inscrição, privacidade e endereço físico."
    >
      <section className="inst-hero inst-wrap" style={{ paddingBottom: '1rem' }}>
        <h1 style={{ maxWidth: '16ch' }}>Amostra de e-mail</h1>
        <p className="lead">
          Exemplo do tipo de conteúdo enviado em campanhas de marketing pela plataforma. O rodapé inclui os elementos
          obrigatórios: <strong style={{ color: '#e8eef7' }}>cancelar inscrição</strong>,{' '}
          <strong style={{ color: '#e8eef7' }}>política de privacidade</strong> e{' '}
          <strong style={{ color: '#e8eef7' }}>endereço físico</strong>.
        </p>
        <div className="inst-cta-row">
          <a href={PATHS.pdf} className="inst-btn inst-btn-primary" download>
            Baixar PDF da amostra
          </a>
          <Link href={PATHS.privacidade} className="inst-btn inst-btn-ghost">
            Política de Privacidade
          </Link>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-email-frame">
          <div className="inst-email-meta">
            <div>
              <strong>De:</strong> {INSTITUCIONAL.nomeFantasia} &lt;{INSTITUCIONAL.email}&gt;
            </div>
            <div>
              <strong>Assunto:</strong> Novidades da plataforma — comunicação com seus clientes
            </div>
            <div>
              <strong>Tipo:</strong> Marketing (amostra)
            </div>
          </div>
          <div className="inst-email-body">
            <p>Olá,</p>
            <p>
              Esta é uma <strong>amostra de e-mail marketing</strong> da plataforma {INSTITUCIONAL.produto}, operada pela{' '}
              {INSTITUCIONAL.razaoSocial}.
            </p>
            <p>
              Nossa solução B2B permite que empresas enviem campanhas e avisos aos próprios clientes, com controle de
              listas, opt-in e cancelamento de inscrição.
            </p>
            <p>
              Seja no varejo, serviços locais, clínicas ou outros segmentos, o foco é comunicação legítima e rastreável.
            </p>
            <p>
              <a href={`${INSTITUCIONAL.siteBase}${PATHS.home}`} style={{ color: '#0369a1', fontWeight: 700 }}>
                Conhecer a NETTSISTEMAS
              </a>
            </p>
          </div>
          <div className="inst-email-footer">
            <p style={{ margin: '0 0 8px' }}>
              Se você não deseja mais receber estes e-mails, cancele sua inscrição pelo link abaixo.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <a href={UNSUBSCRIBE_DEMO}>Cancelar inscrição</a>
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <a href={`${INSTITUCIONAL.siteBase}${PATHS.privacidade}`} style={{ color: '#0369a1', fontWeight: 600 }}>
                Política de Privacidade
              </a>
            </p>
            <p style={{ margin: 0, color: '#64748b' }}>
              {INSTITUCIONAL.razaoSocial} · CNPJ {INSTITUCIONAL.cnpj}
              <br />
              {enderecoCompleto()}
              <br />
              {INSTITUCIONAL.email} · {INSTITUCIONAL.telefoneFmt}
            </p>
          </div>
        </div>

        <div className="inst-grid" style={{ marginTop: '1.25rem' }}>
          <article className="inst-card">
            <h3>✓ Unsubscribe</h3>
            <p>Link “Cancelar inscrição” visível no rodapé (e suporte a List-Unsubscribe na API).</p>
          </article>
          <article className="inst-card">
            <h3>✓ Privacidade</h3>
            <p>
              Link para {INSTITUCIONAL.siteBase}
              {PATHS.privacidade}
            </p>
          </article>
          <article className="inst-card">
            <h3>✓ Endereço físico</h3>
            <p>{enderecoCompleto()}</p>
          </article>
        </div>
      </section>
    </InstitucionalLayout>
  );
}
