import Head from 'next/head';
import EmbedAuthGate from '@/components/EmbedAuthGate';
import VerificarNumerosUaz from '@/pages/uaz/verificar-numeros';

export default function EmbedVerificar() {
  return (
    <EmbedAuthGate>
      <Head>
        <title>Verificar Números | Integração</title>
      </Head>
      <VerificarNumerosUaz />
    </EmbedAuthGate>
  );
}
