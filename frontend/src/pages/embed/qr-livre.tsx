import Head from 'next/head';
import EmbedAuthGate from '@/components/EmbedAuthGate';
import EnviarMensagemUnificado from '@/pages/uaz/enviar-mensagem-unificado';

export default function EmbedQrLivre() {
  return (
    <EmbedAuthGate>
      <Head>
        <title>Envio Único | Integração QR Livre</title>
      </Head>
      <EnviarMensagemUnificado />
    </EmbedAuthGate>
  );
}
