import Link from 'next/link';
import InstitucionalLayout from '@/components/institucional/InstitucionalLayout';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

export default function InstitucionalEquipePage() {
  return (
    <InstitucionalLayout
      title="Equipe e administração"
      description="Página pública da administração da NETTSISTEMAS — Thiago Godinho Oliveira, Administrador."
    >
      <section className="inst-hero inst-wrap" style={{ paddingBottom: '1rem' }}>
        <p className="inst-kicker">Empresa · Administração</p>
        <h1 style={{ maxWidth: '12ch' }}>Equipe</h1>
        <p className="lead">
          Página pública com a identificação do responsável pela operação da {INSTITUCIONAL.razaoSocial}. Esta informação
          faz parte do site oficial da empresa.
        </p>
      </section>

      <section className="inst-section inst-wrap">
        <div className="inst-card inst-card-wide">
          <p className="inst-who-name">{INSTITUCIONAL.responsavel}</p>
          <p className="inst-who-role">{INSTITUCIONAL.cargo} da {INSTITUCIONAL.razaoSocial}</p>
          <div className="inst-who-meta" style={{ marginTop: '1rem' }}>
            <p>
              Cargo: <strong className="inst-strong">{INSTITUCIONAL.cargo}</strong> — responsável pela conta comercial e
              pela operação dos serviços de e-mail marketing e WhatsApp.
            </p>
            <p style={{ marginTop: '0.6rem' }}>
              E-mail: <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>
            </p>
            <p>
              Telefone do administrador:{' '}
              <a href={`https://wa.me/55${INSTITUCIONAL.telefoneAdmin}`}>{INSTITUCIONAL.telefoneAdminFmt}</a>
            </p>
            <p>
              Telefone da empresa:{' '}
              <a href={`https://wa.me/55${INSTITUCIONAL.telefone}`}>{INSTITUCIONAL.telefoneFmt}</a>
            </p>
            <p style={{ marginTop: '0.6rem' }}>CNPJ {INSTITUCIONAL.cnpj}</p>
            <p>{enderecoCompleto()}</p>
            <p style={{ marginTop: '0.85rem' }}>
              Perfil profissional (LinkedIn):{' '}
              <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
                {INSTITUCIONAL.linkedin}
              </a>
            </p>
          </div>
        </div>

        <p style={{ marginTop: '1.25rem' }}>
          <Link href={PATHS.home}>← Voltar ao início</Link>
        </p>
      </section>
    </InstitucionalLayout>
  );
}
