import Head from 'next/head';
import Link from 'next/link';
import { ReactNode } from 'react';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

const nav = [
  { href: PATHS.home, label: 'Início' },
  { href: PATHS.cadastro, label: 'Cadastro / Opt-in' },
  { href: PATHS.amostra, label: 'Amostra de e-mail' },
  { href: PATHS.privacidade, label: 'Privacidade' },
];

export default function InstitucionalLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const fullTitle = `${title} | ${INSTITUCIONAL.nomeFantasia}`;
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={`${INSTITUCIONAL.siteBase}${PATHS.home}`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="inst-root">
        <header className="inst-header">
          <div className="inst-wrap inst-header-inner">
            <Link href={PATHS.home} className="inst-brand">
              <span className="inst-brand-mark" aria-hidden />
              <span>
                <strong>{INSTITUCIONAL.nomeFantasia}</strong>
                <small>Plataforma B2B de comunicação</small>
              </span>
            </Link>
            <nav className="inst-nav" aria-label="Principal">
              {nav.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="inst-footer">
          <div className="inst-wrap inst-footer-grid">
            <div>
              <p className="inst-footer-brand">{INSTITUCIONAL.razaoSocial}</p>
              <p>CNPJ {INSTITUCIONAL.cnpj}</p>
              <p>{enderecoCompleto()}</p>
            </div>
            <div>
              <p>
                <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>
              </p>
              <p>
                <a href={`https://wa.me/55${INSTITUCIONAL.telefone}`}>{INSTITUCIONAL.telefoneFmt}</a>
              </p>
              <p>
                Responsável: {INSTITUCIONAL.responsavel} ({INSTITUCIONAL.cargo})
              </p>
              <p>
                <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn do administrador
                </a>
              </p>
            </div>
            <div className="inst-footer-links">
              <Link href={PATHS.privacidade}>Política de Privacidade</Link>
              <Link href={PATHS.cadastro}>Inscrição / Opt-in</Link>
              <Link href={PATHS.amostra}>Amostra de e-mail</Link>
              <a href={PATHS.pdf} download>
                Baixar amostra (PDF)
              </a>
            </div>
          </div>
          <p className="inst-copy">
            © {new Date().getFullYear()} {INSTITUCIONAL.razaoSocial}. Uso legítimo de e-mail marketing e
            transacional via provedores de entrega (incl. SendGrid).
          </p>
        </footer>
      </div>
      <style jsx global>{`
        .inst-root {
          --bg: #07111f;
          --bg2: #0c1a2e;
          --card: rgba(255, 255, 255, 0.04);
          --line: rgba(148, 163, 184, 0.22);
          --text: #e8eef7;
          --muted: #9fb0c7;
          --accent: #2dd4bf;
          --accent2: #38bdf8;
          min-height: 100vh;
          background:
            radial-gradient(1200px 500px at 10% -10%, rgba(45, 212, 191, 0.18), transparent 55%),
            radial-gradient(900px 400px at 90% 0%, rgba(56, 189, 248, 0.14), transparent 50%),
            linear-gradient(180deg, var(--bg), var(--bg2) 40%, #081018);
          color: var(--text);
          font-family: Manrope, system-ui, sans-serif;
        }
        .inst-wrap {
          width: min(1100px, calc(100% - 2rem));
          margin: 0 auto;
        }
        .inst-header {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(14px);
          background: rgba(7, 17, 31, 0.82);
          border-bottom: 1px solid var(--line);
        }
        .inst-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.9rem 0;
          flex-wrap: wrap;
        }
        .inst-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: inherit;
        }
        .inst-brand-mark {
          width: 2.4rem;
          height: 2.4rem;
          border-radius: 0.85rem;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
        }
        .inst-brand strong {
          display: block;
          font-size: 1.05rem;
          letter-spacing: 0.02em;
        }
        .inst-brand small {
          display: block;
          color: var(--muted);
          font-size: 0.75rem;
        }
        .inst-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.9rem;
        }
        .inst-nav a {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .inst-nav a:hover {
          color: var(--accent);
        }
        .inst-hero {
          padding: 3.5rem 0 2.5rem;
        }
        .inst-hero h1 {
          font-family: 'Source Serif 4', Georgia, serif;
          font-size: clamp(2rem, 4vw, 3.1rem);
          line-height: 1.12;
          margin: 0 0 1rem;
          max-width: 16ch;
        }
        .inst-hero p.lead {
          font-size: 1.1rem;
          color: var(--muted);
          max-width: 52ch;
          line-height: 1.6;
          margin: 0 0 1.5rem;
        }
        .inst-cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .inst-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.15rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.92rem;
          text-decoration: none;
          border: 1px solid transparent;
        }
        .inst-btn-primary {
          background: linear-gradient(135deg, #14b8a6, #0ea5e9);
          color: #041018;
        }
        .inst-btn-ghost {
          background: transparent;
          color: var(--text);
          border-color: var(--line);
        }
        .inst-section {
          padding: 1.25rem 0 2.75rem;
        }
        .inst-section h2 {
          font-size: 1.35rem;
          margin: 0 0 0.85rem;
        }
        .inst-section p,
        .inst-section li {
          color: var(--muted);
          line-height: 1.65;
        }
        .inst-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .inst-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 1rem;
          padding: 1.15rem 1.2rem;
        }
        .inst-card h3 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: var(--text);
        }
        .inst-card p {
          margin: 0;
          font-size: 0.92rem;
        }
        .inst-list {
          margin: 0;
          padding-left: 1.15rem;
        }
        .inst-list li {
          margin: 0.35rem 0;
        }
        .inst-footer {
          margin-top: 2rem;
          border-top: 1px solid var(--line);
          padding: 2rem 0 1.25rem;
          background: rgba(0, 0, 0, 0.25);
        }
        .inst-footer-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          font-size: 0.88rem;
          color: var(--muted);
        }
        .inst-footer-brand {
          color: var(--text);
          font-weight: 800;
          margin: 0 0 0.4rem;
        }
        .inst-footer a {
          color: var(--accent2);
        }
        .inst-footer-links {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .inst-copy {
          width: min(1100px, calc(100% - 2rem));
          margin: 1.5rem auto 0;
          font-size: 0.78rem;
          color: #7c8da3;
        }
        .inst-form {
          display: grid;
          gap: 0.85rem;
          max-width: 480px;
        }
        .inst-form label {
          display: grid;
          gap: 0.35rem;
          font-size: 0.88rem;
          font-weight: 600;
        }
        .inst-form input[type='text'],
        .inst-form input[type='email'],
        .inst-form select {
          border-radius: 0.7rem;
          border: 1px solid var(--line);
          background: rgba(0, 0, 0, 0.35);
          color: var(--text);
          padding: 0.7rem 0.85rem;
          font: inherit;
        }
        .inst-check {
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          font-weight: 500;
          color: var(--muted);
          font-size: 0.88rem;
        }
        .inst-check input {
          margin-top: 0.2rem;
        }
        .inst-alert {
          padding: 0.85rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--line);
          background: rgba(45, 212, 191, 0.1);
          color: #99f6e4;
          font-size: 0.92rem;
        }
        .inst-alert-err {
          background: rgba(248, 113, 113, 0.12);
          color: #fecaca;
        }
        .inst-email-frame {
          background: #f8fafc;
          color: #0f172a;
          border-radius: 1rem;
          overflow: hidden;
          border: 1px solid #cbd5e1;
        }
        .inst-email-meta {
          background: #e2e8f0;
          padding: 0.75rem 1rem;
          font-size: 0.82rem;
          color: #334155;
        }
        .inst-email-body {
          padding: 1.25rem 1.35rem 0.5rem;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.55;
        }
        .inst-email-footer {
          margin-top: 1.5rem;
          padding: 1rem 1.35rem 1.25rem;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          line-height: 1.55;
          color: #64748b;
          text-align: center;
        }
        .inst-email-footer a {
          color: #dc2626;
          font-weight: 700;
        }
      `}</style>
    </>
  );
}
