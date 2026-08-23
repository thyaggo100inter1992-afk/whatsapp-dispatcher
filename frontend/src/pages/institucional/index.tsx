import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

export default function InstitucionalHomePage() {
  return (
    <InstitucionalLayout
      title="Comunicação inteligente para empresas"
      description="NETTSISTEMAS — plataforma B2B de e-mail marketing e WhatsApp para empresas de todos os segmentos."
    >
      <section className="inst-hero inst-wrap">
        <p className="inst-kicker">Tecnologia · Comunicação · Resultados</p>
        <h1>
          Comunicação que conecta
          <span className="inst-hero-accent"> sua empresa aos clientes</span>
        </h1>
        <p className="lead">
          A {INSTITUCIONAL.nomeFantasia} desenvolve a plataforma{' '}
          <strong className="inst-strong">{INSTITUCIONAL.produto}</strong>, uma solução SaaS para empresas enviarem
          campanhas de e-mail marketing e mensagens com organização, rastreio e respeito ao consentimento do destinatário.
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
          <h2>O que fazemos</h2>
          <p>Plataforma completa para empresas que precisam se comunicar com clientes e leads de forma profissional.</p>
        </div>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Plataforma B2B</h3>
            <p>
              Oferecemos o {INSTITUCIONAL.produto} para outras empresas: disparo e gestão de campanhas de e-mail e canais
              de mensagem em um só lugar.
            </p>
          </article>
          <article className="inst-card">
            <h3>Entrega confiável</h3>
            <p>
              Utilizamos infraestrutura profissional de envio de e-mail. Cada empresa-cliente fala com a própria audiência,
              com consentimento e opção de cancelamento.
            </p>
          </article>
          <article className="inst-card">
            <h3>Para vários segmentos</h3>
            <p>
              Atendemos serviços locais, varejo, clínicas, educação, prestadores, e-commerce e outros negócios que precisam
              de comunicação clara e legítima.
            </p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Tipos de comunicação</h2>
          <p>A plataforma cobre tanto campanhas quanto avisos operacionais.</p>
        </div>
        <div className="inst-grid inst-grid-2">
          <article className="inst-card inst-card-accent">
            <h3>E-mail marketing</h3>
            <p>Campanhas, novidades e ofertas enviadas pelas empresas-clientes às bases com inscrição voluntária.</p>
          </article>
          <article className="inst-card inst-card-accent">
            <h3>E-mail transacional</h3>
            <p>Confirmações, senhas, recibos e notificações do sistema — quando o fluxo do negócio exige.</p>
          </article>
        </div>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-section-head">
          <h2>Transparência e boas práticas</h2>
          <p>Políticas claras, inscrição consciente e respeito ao direito de cancelar.</p>
        </div>
        <div className="inst-grid">
          <article className="inst-card">
            <h3>Inscrição</h3>
            <p>Cadastro público com consentimento explícito para receber comunicações da {INSTITUCIONAL.nomeFantasia}.</p>
            <Link href={PATHS.cadastro} className="inst-card-link">
              Ir para o formulário →
            </Link>
          </article>
          <article className="inst-card">
            <h3>Cancelar inscrição</h3>
            <p>
              Todo e-mail de marketing traz link para cancelar o recebimento. Assim o destinatário controla o que recebe.
            </p>
            <Link href={PATHS.amostra} className="inst-card-link">
              Ver no exemplo →
            </Link>
          </article>
          <article className="inst-card">
            <h3>Privacidade</h3>
            <p>
              Política publicada e endereço comercial no rodapé das comunicações. Tratamos dados com responsabilidade.
            </p>
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
                <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
                  Perfil no LinkedIn
                </a>
              </p>
            </div>
            <div className="inst-who-meta">
              <p>
                <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>
              </p>
              <p>
                <a href={`https://wa.me/55${INSTITUCIONAL.telefone}`}>{INSTITUCIONAL.telefoneFmt}</a>
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
