import Head from 'next/head';
import EmbedAuthGate from '@/components/EmbedAuthGate';
import EnviarMensagemImediataV2 from '@/pages/mensagem/enviar-v2';

export default function EmbedOficial() {
  return (
    <EmbedAuthGate>
      <Head>
        <title>Envio Rápido | Integração</title>
      </Head>
      <EnviarMensagemImediataV2 />
    </EmbedAuthGate>
  );
}
