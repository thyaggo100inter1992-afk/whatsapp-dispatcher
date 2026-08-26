import Head from 'next/head';
import EmbedAuthGate from '@/components/EmbedAuthGate';
import EnviarTemplateUnico from '@/pages/uaz/enviar-template-unico';

export default function EmbedQr() {
  return (
    <EmbedAuthGate>
      <Head>
        <title>Envio Único | Integração QR</title>
      </Head>
      <EnviarTemplateUnico />
    </EmbedAuthGate>
  );
}
