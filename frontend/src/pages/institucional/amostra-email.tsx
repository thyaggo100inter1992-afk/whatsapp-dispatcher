import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

const UNSUBSCRIBE_DEMO =
  'https://api.sistemasnettsistemas.com.br/api/public/email-unsubscribe?t=exemplo-cancelamento';

export default function InstitucionalAmostraPage() {
  return (
    <InstitucionalLayout
      title="Exemplos de e-mail"
      description="Exemplo de e-mail marketing da NETTSISTEMAS com cancelamento de inscrição, privacidade e endereço."
    >
      <section className="inst-hero inst-wrap" style={{ paddingBottom: '1rem' }}>
        <p className="inst-kicker">Comunicação</p>
        <h1 style={{ maxWidth: '14ch' }}>Exemplo de e-mail</h1>
        <p className="lead">
          Modelo do tipo de mensagem que pode ser enviada em campanhas. No rodapé ficam sempre o link para cancelar, a
          política de privacidade e o endereço comercial.
        </p>
        <div className="inst-cta-row">
          <a href={PATHS.pdf} className="inst-btn inst-btn-primary" download>
            Baixar exemplo em PDF
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
              <strong>Assunto:</strong> Novidades — comunicação com seus clientes
            </div>
            <div>
              <strong>Tipo:</strong> Marketing (exemplo)
            </div>
          </div>
          <div className="inst-email-body">
            <p>Olá,</p>
            <p>
              Esta é uma <strong>amostra de e-mail marketing</strong> do serviço prestado pela {INSTITUCIONAL.razaoSocial}.
            </p>
            <p>
              Prestamos e-mail marketing e WhatsApp com operação e controle nossos: campanhas, listas, opt-in e
              cancelamento de inscrição ficam sob nossa gestão.
            </p>
            <p>
              Atendemos varejo, serviços locais, clínicas e outros segmentos, sempre com comunicação legítima e
              rastreável.
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
              {INSTITUCIONAL.email} · Empresa {INSTITUCIONAL.telefoneFmt}
            </p>
          </div>
        </div>

        <div className="inst-grid" style={{ marginTop: '1.25rem' }}>
          <article className="inst-card">
            <h3>Cancelar inscrição</h3>
            <p>Link visível no rodapé de toda campanha de marketing.</p>
          </article>
          <article className="inst-card">
            <h3>Privacidade</h3>
            <p>Acesso à política completa da empresa.</p>
          </article>
          <article className="inst-card">
            <h3>Endereço comercial</h3>
            <p className="inst-break">{enderecoCompleto()}</p>
          </article>
        </div>
      </section>
    </InstitucionalLayout>
  );
}
