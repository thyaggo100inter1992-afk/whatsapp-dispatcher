import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

export default function InstitucionalHomePage() {
  return (
    <InstitucionalLayout
      title="E-mail marketing e WhatsApp"
      description="NETTSISTEMAS presta serviços de e-mail marketing e WhatsApp com operação e controle próprios para empresas de vários segmentos."
    >
      <section className="inst-hero inst-wrap">
        <p className="inst-kicker">Serviço · Comunicação · Resultados</p>
        <h1>
          E-mail marketing e WhatsApp
          <span className="inst-hero-accent"> com operação controlada</span>
        </h1>
        <p className="lead">
          A {INSTITUCIONAL.nomeFantasia} presta o serviço de{' '}
          <strong className="inst-strong">e-mail marketing e WhatsApp</strong> para empresas. Nós operamos o envio,
          monitoramos a entrega e mantemos as boas práticas (consentimento, cancelamento e privacidade) — não é um
          “abra a conta e se vire”: o controle do serviço fica conosco.
        </p>
        <div className="inst-cta-row">
          <Link href={PATHS.cadastro} className="inst-btn inst-btn-primary">
            Receber novidades
          </Link>
          <Link href={PATHS.amostra} className="inst-btn inst-btn-ghost">
            Ver exemplo de e-mail
          </Link>
          <Link href={PATHS.privacidade} className="inst-btn inst-btn-ghost">
            Privacidade
          </Link>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>O que vendemos</h2>
          <p>
            Prestação de serviço de comunicação digital: campanhas e avisos por e-mail e WhatsApp, com a{' '}
            {INSTITUCIONAL.nomeFantasia} responsável pela operação.
          </p>
        </div>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Serviço de e-mail marketing</h3>
            <p>
              Planejamos e executamos campanhas de e-mail para a base do cliente, com conteúdo, listas, rastreio e
              cancelamento de inscrição.
            </p>
          </article>
          <article className="inst-card">
            <h3>Serviço de WhatsApp</h3>
            <p>
              Comunicação via WhatsApp integrada ao mesmo padrão de operação: envio organizado, acompanhamento e regras
              de uso legítimo.
            </p>
          </article>
          <article className="inst-card">
            <h3>Controle operacional nosso</h3>
            <p>
              A {INSTITUCIONAL.nomeFantasia} gerencia a ferramenta, a infraestrutura de envio e as políticas. O cliente
              contrata o serviço; nós conduzimos e supervisionamos o processo.
            </p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Para quem é</h2>
          <p>Atendemos empresas de vários segmentos que precisam se comunicar com clientes e leads.</p>
        </div>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Segmentos</h3>
            <p>
              Serviços locais, varejo, clínicas, educação, prestadores, e-commerce e outros negócios — sempre com envio
              sob nossa operação.
            </p>
          </article>
          <article className="inst-card">
            <h3>Entrega profissional</h3>
            <p>
              Usamos infraestrutura séria de envio de e-mail e acompanhamos status (enviado, entregue, abertura, clique)
              para manter qualidade.
            </p>
          </article>
          <article className="inst-card">
            <h3>Ferramenta {INSTITUCIONAL.produto}</h3>
            <p>
              Sistema interno da {INSTITUCIONAL.nomeFantasia} para operar os disparos com organização, histórico e
              conformidade.
            </p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Tipos de e-mail</h2>
          <p>No serviço de e-mail, trabalhamos com marketing e avisos operacionais.</p>
        </div>
        <div className="inst-grid inst-grid-2">
          <article className="inst-card inst-card-accent">
            <h3>E-mail marketing</h3>
            <p>Campanhas, novidades e ofertas para bases com inscrição voluntária, operadas pela nossa equipe/sistema.</p>
          </article>
          <article className="inst-card inst-card-accent">
            <h3>E-mail transacional</h3>
            <p>Confirmações, senhas, recibos e notificações — quando o fluxo do cliente exige.</p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Transparência e boas práticas</h2>
          <p>Consentimento, cancelamento e privacidade fazem parte do serviço.</p>
        </div>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Inscrição</h3>
            <p>Formulário público com consentimento explícito para comunicações da {INSTITUCIONAL.nomeFantasia}.</p>
            <Link href={PATHS.cadastro} className="inst-card-link">
              Ir para o formulário →
            </Link>
          </article>
          <article className="inst-card">
            <h3>Cancelar inscrição</h3>
            <p>Todo e-mail de marketing inclui link para cancelar o recebimento.</p>
            <Link href={PATHS.amostra} className="inst-card-link">
              Ver no exemplo →
            </Link>
          </article>
          <article className="inst-card">
            <h3>Privacidade</h3>
            <p>Política publicada e endereço comercial no rodapé das comunicações.</p>
            <Link href={PATHS.privacidade} className="inst-card-link">
              Ler política →
            </Link>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Quem somos</h2>
        </div>
        <div className="inst-card inst-card-wide">
          <div className="inst-who">
            <div>
              <p className="inst-who-name">{INSTITUCIONAL.responsavel}</p>
              <p className="inst-who-role">{INSTITUCIONAL.cargo}</p>
              <p className="inst-who-meta">
                <Link href={PATHS.equipe}>Ver página pública da administração →</Link>
              </p>
              <p className="inst-who-meta" style={{ marginTop: '0.45rem' }}>
                <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn (quando perfil público)
                </a>
              </p>
            </div>
            <div className="inst-who-meta">
              <p>
                <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>
              </p>
              <p>
                Telefone da empresa:{' '}
                <a href={`https://wa.me/55${INSTITUCIONAL.telefone}`}>{INSTITUCIONAL.telefoneFmt}</a>
              </p>
              <p>
                Telefone do administrador:{' '}
                <a href={`https://wa.me/55${INSTITUCIONAL.telefoneAdmin}`}>{INSTITUCIONAL.telefoneAdminFmt}</a>
              </p>
              <p>CNPJ {INSTITUCIONAL.cnpj}</p>
              <p>{enderecoCompleto()}</p>
            </div>
          </div>
        </div>
      </section>
    </InstitucionalLayout>
  );
}
