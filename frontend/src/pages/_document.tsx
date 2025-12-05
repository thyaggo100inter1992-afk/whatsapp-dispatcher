import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* Favicon e ícones */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        
        {/* Meta tags */}
        <meta name="description" content="Disparador NettSistemas - Sistema de envio em massa para WhatsApp" />
        <meta name="theme-color" content="#25D366" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}


