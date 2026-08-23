import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

export default function InstitucionalPrivacidadePage() {
  return (
    <InstitucionalLayout
      title="Política de Privacidade"
      description="Política de Privacidade da NETTSISTEMAS — tratamento de dados pessoais na plataforma B2B de comunicação."
    >
      <section className="inst-hero inst-wrap" style={{ paddingBottom: '1rem' }}>
        <h1 style={{ maxWidth: '18ch' }}>Política de Privacidade</h1>
        <p className="lead">
          Esta política descreve como a {INSTITUCIONAL.razaoSocial} trata dados pessoais no contexto da plataforma{' '}
          {INSTITUCIONAL.produto} e das comunicações por e-mail.
        </p>
        <p style={{ color: '#9fb0c7', fontSize: '0.9rem' }}>Última atualização: 22 de agosto de 2026</p>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>1. Controladora</h2>
            <p>
              {INSTITUCIONAL.razaoSocial}, CNPJ {INSTITUCIONAL.cnpj}, endereço {enderecoCompleto()}. Contato:{' '}
              <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>2. Dados coletados</h2>
            <ul className="inst-list">
              <li>Dados de cadastro de leads/opt-in: nome, e-mail e consentimento.</li>
              <li>Dados de contas empresariais na plataforma: identificação, contato e uso do serviço.</li>
              <li>Dados técnicos de entrega de e-mail (status de envio, abertura e clique), quando habilitado pelo provedor.</li>
              <li>Comunicações enviadas pelos clientes da plataforma às respectivas bases (o cliente é responsável pela base).</li>
            </ul>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>3. Finalidades</h2>
            <ul className="inst-list">
              <li>Prestar o serviço SaaS de comunicação e e-mail marketing/transacional.</li>
              <li>Enviar comunicações com base em consentimento (opt-in) ou relação contratual.</li>
              <li>Cumprir obrigações legais e de segurança (antispam, abuse, auditoria).</li>
              <li>Melhorar a qualidade do serviço e suporte.</li>
            </ul>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>4. Base legal</h2>
            <p>
              Consentimento do titular; execução de contrato; legítimo interesse compatível com a LGPD; e cumprimento de
              obrigação legal, conforme o caso.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>5. Compartilhamento</h2>
            <p>
              Utilizamos provedores de infraestrutura e entrega de e-mail estritamente para prestar o serviço. Não
              vendemos listas de contatos.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>6. Retenção</h2>
            <p>
              Mantemos os dados pelo tempo necessário às finalidades acima, exigências legais e defesa de direitos. Opt-outs
              e registros de consentimento podem ser conservados para comprovação de conformidade.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>7. Direitos do titular</h2>
            <p>
              Você pode solicitar acesso, correção, exclusão, portabilidade, informação sobre compartilhamentos e revogação
              de consentimento pelo e-mail {INSTITUCIONAL.email}, ou cancelando a inscrição pelos links dos e-mails de
              marketing.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>8. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas ao risco, incluindo controle de acesso e uso de
              provedores reputados de entrega.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem', color: '#e8eef7' }}>9. Contato</h2>
            <p>
              Dúvidas: {INSTITUCIONAL.email} · {INSTITUCIONAL.telefoneFmt}
              <br />
              Responsável: {INSTITUCIONAL.responsavel} ({INSTITUCIONAL.cargo})
            </p>
          </div>
        </div>
        <p style={{ marginTop: '1.25rem' }}>
          <Link href={PATHS.home}>← Voltar ao site institucional</Link>
        </p>
      </section>
    </InstitucionalLayout>
  );
}
