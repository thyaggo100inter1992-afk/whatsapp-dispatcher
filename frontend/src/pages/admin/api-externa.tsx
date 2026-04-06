import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { FaPlug, FaCopy, FaCheck, FaCheckCircle, FaTimesCircle, FaInfoCircle, FaLock } from 'react-icons/fa';

// ── Componente de bloco de código copiável ─────────────────────────────────
function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto border border-gray-700 font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copiar}
        className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100"
      >
        {copiado ? <><FaCheck className="text-green-400" /> Copiado!</> : <><FaCopy /> Copiar</>}
      </button>
    </div>
  );
}

// ── Badge de método HTTP ───────────────────────────────────────────────────
function MethodBadge({ method }: { method: string }) {
  const cores: Record<string, string> = {
    POST: 'bg-blue-600',
    GET: 'bg-green-600',
    DELETE: 'bg-red-600',
    PATCH: 'bg-yellow-600',
  };
  return (
    <span className={`${cores[method] || 'bg-gray-600'} text-white text-xs font-bold px-3 py-1 rounded-full`}>
      {method}
    </span>
  );
}

// ── Card de campo de requisição ────────────────────────────────────────────
function Campo({ nome, tipo, obrigatorio, descricao }: { nome: string; tipo: string; obrigatorio: boolean; descricao: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-700/50 last:border-0">
      <code className="bg-gray-800 text-purple-300 px-2 py-0.5 rounded text-sm font-mono min-w-fit">{nome}</code>
      <span className="text-gray-500 text-xs mt-1 min-w-fit">{tipo}</span>
      {obrigatorio
        ? <span className="text-red-400 text-xs mt-1 min-w-fit">obrigatório</span>
        : <span className="text-gray-500 text-xs mt-1 min-w-fit">opcional</span>}
      <span className="text-gray-300 text-sm">{descricao}</span>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ApiExternaPage() {
  const baseUrl = 'http://72.60.141.244:3001';

  return (
    <AdminLayout
      title="API Externa"
      subtitle="Documentação para integração com sistemas externos"
      icon={<FaPlug className="text-3xl text-white" />}
      currentPage="api-externa"
    >
      <div className="space-y-8 max-w-5xl">

        {/* ── Visão Geral ─────────────────────────────────────────────── */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <FaInfoCircle className="text-blue-400" /> Visão Geral
          </h2>
          <p className="text-gray-300 mb-4">
            A <strong className="text-white">API Pública de Lista de Restrição</strong> permite que sistemas externos 
            cadastrem e consultem telefones nas listas de restrição sem precisar acessar o painel. 
            A autenticação é feita com o <strong className="text-white">email e senha</strong> de um usuário 
            cadastrado no sistema — o tenant é identificado automaticamente.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">URL Base</p>
            <code className="text-green-400 font-mono text-sm">{baseUrl}</code>
          </div>
        </div>

        {/* ── Autenticação ────────────────────────────────────────────── */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <FaLock className="text-yellow-400" /> Autenticação
          </h2>
          <p className="text-gray-300 mb-4">
            Todas as requisições devem incluir <code className="bg-gray-900 text-purple-300 px-1 rounded">email</code> e{' '}
            <code className="bg-gray-900 text-purple-300 px-1 rounded">senha</code> no corpo JSON. 
            Não é necessário token ou API Key separado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { codigo: 'nao_me_perturbe', nome: 'Não Me Perturbe' },
              { codigo: 'bloqueado', nome: 'Bloqueado' },
              { codigo: 'sem_interesse', nome: 'Sem Interesse' },
              { codigo: 'sem_whatsapp', nome: 'Sem WhatsApp' },
            ].map(lista => (
              <div key={lista.codigo} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                <code className="text-purple-300 text-sm block">{lista.codigo}</code>
                <span className="text-gray-400 text-xs">{lista.nome}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ENDPOINT 1 — CADASTRAR                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-gray-800/50 border border-purple-700/50 rounded-xl overflow-hidden">
          {/* Cabeçalho */}
          <div className="bg-purple-900/40 px-6 py-4 flex items-center gap-3 border-b border-purple-700/50">
            <MethodBadge method="POST" />
            <code className="text-white font-mono text-sm">/api/public/restriction-list/add</code>
            <span className="text-gray-400 text-sm ml-auto">Cadastrar telefone na lista</span>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-gray-300">
              Adiciona um telefone em uma das listas de restrição. O sistema cadastra automaticamente 
              as <strong className="text-white">duas versões</strong> do número (com e sem o 9º dígito).
            </p>

            {/* Campos */}
            <div>
              <h3 className="text-white font-semibold mb-3">Campos da Requisição</h3>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <Campo nome="email"    tipo="string" obrigatorio={true}  descricao="Email de login do usuário no sistema" />
                <Campo nome="senha"    tipo="string" obrigatorio={true}  descricao="Senha do usuário" />
                <Campo nome="telefone" tipo="string" obrigatorio={true}  descricao="Número do telefone. Ex: 5511999999999 (com DDI e DDD)" />
                <Campo nome="lista"    tipo="string" obrigatorio={true}  descricao="Lista de destino: nao_me_perturbe | bloqueado | sem_interesse | sem_whatsapp" />
                <Campo nome="nome"     tipo="string" obrigatorio={false} descricao="Nome do contato (se omitido, usa o número como nome)" />
                <Campo nome="cpf"      tipo="string" obrigatorio={false} descricao="CPF do contato para registrar na observação" />
              </div>
            </div>

            {/* Exemplo de requisição */}
            <div>
              <h3 className="text-white font-semibold mb-3">Exemplo — Requisição Mínima</h3>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/add
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999",
  "lista": "nao_me_perturbe"
}`} language="http" />
            </div>

            <div>
              <h3 className="text-white font-semibold mb-3">Exemplo — Requisição Completa</h3>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/add
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999",
  "lista": "bloqueado",
  "nome": "João Silva",
  "cpf": "123.456.789-00"
}`} language="http" />
            </div>

            {/* Respostas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaCheckCircle className="text-green-400" /> Sucesso (201)
                </h3>
                <CodeBlock code={`{
  "sucesso": true,
  "mensagem": "Telefone adicionado com sucesso na lista \\"Bloqueado\\"",
  "registros_criados": 2,
  "lista": "Bloqueado",
  "telefone": "5511999999999"
}`} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaTimesCircle className="text-red-400" /> Erros
                </h3>
                <CodeBlock code={`// 401 - Credenciais inválidas
{ "sucesso": false, "mensagem": "Email ou senha inválidos" }

// 400 - Campo obrigatório ausente
{ "sucesso": false, "mensagem": "O campo lista é obrigatório..." }

// 409 - Telefone já cadastrado
{ "sucesso": false, "mensagem": "O telefone já está cadastrado..." }`} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ENDPOINT 2 — CONSULTAR                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-gray-800/50 border border-blue-700/50 rounded-xl overflow-hidden">
          {/* Cabeçalho */}
          <div className="bg-blue-900/40 px-6 py-4 flex items-center gap-3 border-b border-blue-700/50">
            <MethodBadge method="POST" />
            <code className="text-white font-mono text-sm">/api/public/restriction-list/consultar</code>
            <span className="text-gray-400 text-sm ml-auto">Consultar telefone na lista</span>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-gray-300">
              Verifica se um ou mais telefones estão em alguma lista de restrição. 
              Pode-se consultar um número único ou um <strong className="text-white">array com vários números</strong> de uma vez.
            </p>

            {/* Campos */}
            <div>
              <h3 className="text-white font-semibold mb-3">Campos da Requisição</h3>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <Campo nome="email"    tipo="string"         obrigatorio={true}  descricao="Email de login do usuário no sistema" />
                <Campo nome="senha"    tipo="string"         obrigatorio={true}  descricao="Senha do usuário" />
                <Campo nome="telefone" tipo="string | array" obrigatorio={true}  descricao='Número único ou lista de números. Ex: "5511999999999" ou ["5511999999999", "5521888888888"]' />
              </div>
            </div>

            {/* Exemplos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-white font-semibold mb-3">Exemplo — Um telefone</h3>
                <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/consultar
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999"
}`} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-3">Exemplo — Vários telefones</h3>
                <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/consultar
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": [
    "5511999999999",
    "5521888888888",
    "5531777777777"
  ]
}`} />
              </div>
            </div>

            {/* Respostas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaCheckCircle className="text-green-400" /> Telefone Restrito
                </h3>
                <CodeBlock code={`{
  "sucesso": true,
  "total_consultados": 1,
  "total_restritos": 1,
  "total_livres": 0,
  "resultados": [
    {
      "telefone": "5511999999999",
      "restrito": true,
      "listas": [
        {
          "codigo": "bloqueado",
          "nome": "Bloqueado",
          "adicionado_em": "2026-04-06T20:00:00.000Z",
          "nome_contato": "João Silva",
          "observacao": "CPF: 123.456.789-00"
        }
      ]
    }
  ]
}`} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaCheckCircle className="text-green-400" /> Telefone Livre
                </h3>
                <CodeBlock code={`{
  "sucesso": true,
  "total_consultados": 1,
  "total_restritos": 0,
  "total_livres": 1,
  "resultados": [
    {
      "telefone": "5511999999999",
      "restrito": false,
      "listas": []
    }
  ]
}`} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Notas finais ─────────────────────────────────────────────── */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-6">
          <h2 className="text-yellow-400 font-bold text-lg mb-3 flex items-center gap-2">
            <FaInfoCircle /> Informações Importantes
          </h2>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>• O sistema cadastra <strong className="text-white">automaticamente 2 versões</strong> do número (com e sem o 9º dígito).</li>
            <li>• A <strong className="text-white">porta 3001</strong> é acessível diretamente sem necessidade de nginx.</li>
            <li>• Cada usuário só acessa as listas do <strong className="text-white">seu próprio tenant</strong> — sem risco de cruzar dados.</li>
            <li>• Telefones expirados (com data de expiração configurada) não aparecem nas consultas.</li>
            <li>• Para usar com HTTPS, configure o nginx como reverse proxy para a porta 3001.</li>
          </ul>
        </div>

      </div>
    </AdminLayout>
  );
}
