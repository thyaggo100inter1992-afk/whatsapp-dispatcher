import Head from 'next/head';
import Link from 'next/link';
import { ReactNode } from 'react';
import SystemLogo from '@/components/SystemLogo';
import { INSTITUCIONAL, PATHS, enderecoCompleto } from '@/data/institucional';

const nav = [
  { href: PATHS.home, label: 'Início' },
  { href: PATHS.cadastro, label: 'Newsletter' },
  { href: PATHS.amostra, label: 'Exemplos' },
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
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="inst-root">
        <div className="inst-glow inst-glow-a" aria-hidden />
        <div className="inst-glow inst-glow-b" aria-hidden />

        <header className="inst-header">
          <div className="inst-wrap inst-header-inner">
            <Link href={PATHS.home} className="inst-brand">
              <span className="inst-logo-slot">
                <SystemLogo size="small" showFallback={false} className="inst-system-logo" />
              </span>
              <span>
                <strong>{INSTITUCIONAL.nomeFantasia}</strong>
                <small>E-mail marketing e WhatsApp</small>
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
              <div className="inst-footer-logo">
                <SystemLogo size="small" showFallback={false} />
              </div>
              <p className="inst-footer-brand">{INSTITUCIONAL.razaoSocial}</p>
              <p>CNPJ {INSTITUCIONAL.cnpj}</p>
              <p className="inst-break">{enderecoCompleto()}</p>
            </div>
            <div>
              <p>
                <a href={`mailto:${INSTITUCIONAL.email}`}>{INSTITUCIONAL.email}</a>
              </p>
              <p>
                Empresa:{' '}
                <a href={`https://wa.me/55${INSTITUCIONAL.telefone}`}>{INSTITUCIONAL.telefoneFmt}</a>
              </p>
              <p>
                {INSTITUCIONAL.responsavel} · {INSTITUCIONAL.cargo}
              </p>
              <p>
                Admin:{' '}
                <a href={`https://wa.me/55${INSTITUCIONAL.telefoneAdmin}`}>{INSTITUCIONAL.telefoneAdminFmt}</a>
              </p>
              <p>
                <a href={INSTITUCIONAL.linkedin} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </p>
            </div>
            <div className="inst-footer-links">
              <Link href={PATHS.privacidade}>Política de Privacidade</Link>
              <Link href={PATHS.cadastro}>Newsletter</Link>
              <Link href={PATHS.amostra}>Exemplos de e-mail</Link>
              <a href={PATHS.pdf} download>
                Baixar exemplo (PDF)
              </a>
            </div>
          </div>
          <p className="inst-copy">
            © {new Date().getFullYear()} {INSTITUCIONAL.razaoSocial}. Todos os direitos reservados.
          </p>
        </footer>
      </div>
      <style jsx global>{`
        .inst-root {
          --bg: #050b14;
          --bg2: #0a1628;
          --card: rgba(255, 255, 255, 0.045);
          --line: rgba(148, 163, 184, 0.18);
          --text: #f1f5f9;
          --muted: #94a3b8;
          --accent: #2dd4bf;
          --accent2: #38bdf8;
          --strong: #f8fafc;
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          overflow-x: hidden;
          background: linear-gradient(165deg, var(--bg) 0%, var(--bg2) 45%, #07101c 100%);
          color: var(--text);
          font-family: Outfit, system-ui, sans-serif;
        }
        .inst-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: -1;
        }
        .inst-glow-a {
          width: 420px;
          height: 420px;
          top: -120px;
          left: -80px;
          background: rgba(45, 212, 191, 0.16);
        }
        .inst-glow-b {
          width: 380px;
          height: 380px;
          top: 80px;
          right: -100px;
          background: rgba(56, 189, 248, 0.12);
        }
        .inst-wrap {
          width: min(1080px, calc(100% - 2rem));
          margin: 0 auto;
        }
        .inst-header {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(16px);
          background: rgba(5, 11, 20, 0.78);
          border-bottom: 1px solid var(--line);
        }
        .inst-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 0;
          flex-wrap: wrap;
        }
        .inst-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: inherit;
          min-width: 0;
        }
        .inst-logo-slot {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2.6rem;
          min-height: 2.6rem;
        }
        .inst-logo-slot img,
        .inst-system-logo img {
          height: 2.6rem !important;
          width: auto !important;
          max-width: 7.5rem;
          object-fit: contain;
        }
        .inst-footer-logo {
          margin-bottom: 0.65rem;
        }
        .inst-footer-logo img {
          height: 2.8rem !important;
          width: auto !important;
          max-width: 9rem;
          object-fit: contain;
        }
        .inst-brand strong {
          display: block;
          font-size: 1.02rem;
          letter-spacing: 0.04em;
        }
        .inst-brand small {
          display: block;
          color: var(--muted);
          font-size: 0.72rem;
        }
        .inst-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem 0.85rem;
        }
        .inst-nav a {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.35rem 0.2rem;
        }
        .inst-nav a:hover {
          color: var(--accent);
        }
        .inst-hero {
          padding: 3.75rem 0 2.25rem;
        }
        .inst-kicker {
          color: var(--accent);
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-size: 0.72rem;
          margin: 0 0 0.9rem;
        }
        .inst-hero h1 {
          font-family: Fraunces, Georgia, serif;
          font-size: clamp(2.1rem, 4.4vw, 3.35rem);
          line-height: 1.12;
          margin: 0 0 1.1rem;
          max-width: 14ch;
          font-weight: 700;
        }
        .inst-hero-accent {
          display: inline;
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .inst-hero p.lead {
          font-size: 1.08rem;
          color: var(--muted);
          max-width: 54ch;
          line-height: 1.65;
          margin: 0 0 1.6rem;
        }
        .inst-strong {
          color: var(--strong);
          font-weight: 700;
        }
        .inst-cta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
        }
        .inst-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.78rem 1.2rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.92rem;
          text-decoration: none;
          border: 1px solid transparent;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .inst-btn:hover {
          transform: translateY(-1px);
        }
        .inst-btn-primary {
          background: linear-gradient(135deg, #14b8a6, #0ea5e9);
          color: #041018;
          box-shadow: 0 10px 28px rgba(14, 165, 233, 0.28);
        }
        .inst-btn-ghost {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text);
          border-color: var(--line);
        }
        .inst-section {
          padding: 1.1rem 0 2.6rem;
        }
        .inst-section-head {
          margin-bottom: 1.15rem;
          max-width: 56ch;
        }
        .inst-section-head h2 {
          font-size: 1.45rem;
          margin: 0 0 0.4rem;
          font-weight: 750;
        }
        .inst-section-head p {
          margin: 0;
          color: var(--muted);
          line-height: 1.55;
        }
        .inst-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
        }
        .inst-grid-2 {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
        }
        .inst-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 1.15rem;
          padding: 1.25rem 1.3rem;
          min-width: 0;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
        }
        .inst-card-accent {
          background: linear-gradient(160deg, rgba(45, 212, 191, 0.08), rgba(255, 255, 255, 0.03));
        }
        .inst-card-wide {
          padding: 1.4rem 1.45rem;
        }
        .inst-card h3 {
          margin: 0 0 0.55rem;
          font-size: 1.02rem;
          color: var(--strong);
        }
        .inst-card p {
          margin: 0;
          font-size: 0.94rem;
          color: var(--muted);
          line-height: 1.6;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .inst-card-link {
          display: inline-block;
          margin-top: 0.85rem;
          color: var(--accent2);
          font-weight: 700;
          font-size: 0.9rem;
          text-decoration: none;
        }
        .inst-card-link:hover {
          color: var(--accent);
        }
        .inst-list {
          margin: 0;
          padding-left: 1.15rem;
        }
        .inst-list li {
          margin: 0.4rem 0;
          color: var(--muted);
          line-height: 1.6;
        }
        .inst-who {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
        }
        .inst-who-name {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--strong);
        }
        .inst-who-role {
          margin: 0.2rem 0 0.55rem;
          color: var(--accent);
          font-weight: 600;
          font-size: 0.92rem;
        }
        .inst-who-meta {
          color: var(--muted);
          font-size: 0.92rem;
          line-height: 1.55;
        }
        .inst-who-meta p {
          margin: 0.25rem 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .inst-who-meta a {
          color: var(--accent2);
        }
        .inst-break {
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .inst-footer {
          margin-top: 1.5rem;
          border-top: 1px solid var(--line);
          padding: 2.1rem 0 1.25rem;
          background: rgba(0, 0, 0, 0.28);
        }
        .inst-footer-grid {
          display: grid;
          gap: 1.35rem;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
          font-size: 0.88rem;
          color: var(--muted);
        }
        .inst-footer-grid > div {
          min-width: 0;
        }
        .inst-footer-brand {
          color: var(--text);
          font-weight: 800;
          margin: 0 0 0.4rem;
        }
        .inst-footer a {
          color: var(--accent2);
          text-decoration: none;
        }
        .inst-footer a:hover {
          text-decoration: underline;
        }
        .inst-footer-links {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .inst-copy {
          width: min(1080px, calc(100% - 2rem));
          margin: 1.5rem auto 0;
          font-size: 0.78rem;
          color: #64748b;
        }
        .inst-form {
          display: grid;
          gap: 0.9rem;
          max-width: 100%;
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
          border-radius: 0.75rem;
          border: 1px solid var(--line);
          background: rgba(0, 0, 0, 0.35);
          color: var(--text);
          padding: 0.75rem 0.9rem;
          font: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        .inst-check {
          display: flex;
          gap: 0.65rem;
          align-items: flex-start;
          font-weight: 500;
          color: var(--muted);
          font-size: 0.88rem;
          line-height: 1.45;
        }
        .inst-check input {
          margin-top: 0.2rem;
          flex-shrink: 0;
        }
        .inst-alert {
          padding: 0.85rem 1rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(45, 212, 191, 0.35);
          background: rgba(45, 212, 191, 0.1);
          color: #99f6e4;
          font-size: 0.92rem;
        }
        .inst-alert-err {
          border-color: rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.12);
          color: #fecaca;
        }
        .inst-email-frame {
          background: #f8fafc;
          color: #0f172a;
          border-radius: 1.1rem;
          overflow: hidden;
          border: 1px solid #cbd5e1;
          max-width: 100%;
        }
        .inst-email-meta {
          background: #e2e8f0;
          padding: 0.85rem 1.1rem;
          font-size: 0.82rem;
          color: #334155;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .inst-email-body {
          padding: 1.3rem 1.35rem 0.5rem;
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
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .inst-email-footer a {
          color: #dc2626;
          font-weight: 700;
        }
      `}</style>
    </>
  );
}
