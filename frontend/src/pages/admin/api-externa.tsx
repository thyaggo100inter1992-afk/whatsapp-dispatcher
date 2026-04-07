import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { FaPlug, FaCopy, FaCheck, FaCheckCircle, FaTimesCircle, FaInfoCircle, FaLock, FaBan, FaTrash } from 'react-icons/fa';

// ── Componente de bloco de código copiável ─────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto border border-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
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

function MethodBadge({ method }: { method: string }) {
  const cores: Record<string, string> = { POST: 'bg-blue-600', GET: 'bg-green-600' };
  return (
    <span className={`${cores[method] || 'bg-gray-600'} text-white text-xs font-bold px-3 py-1 rounded-full`}>
      {method}
    </span>
  );
}

function Campo({ nome, tipo, obrigatorio, descricao }: { nome: string; tipo: string; obrigatorio: boolean; descricao: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2 py-2 border-b border-gray-700/50 last:border-0">
      <code className="bg-gray-800 text-purple-300 px-2 py-0.5 rounded text-sm font-mono">{nome}</code>
      <span className="text-gray-500 text-xs mt-1">{tipo}</span>
      {obrigatorio
        ? <span className="text-red-400 text-xs mt-1">obrigatório</span>
        : <span className="text-gray-500 text-xs mt-1">opcional</span>}
      <span className="text-gray-300 text-sm flex-1">{descricao}</span>
    </div>
  );
}

// ── Conteúdo: Lista de Restrição ───────────────────────────────────────────
function TabListaRestricao() {
  const baseUrl = 'http://72.60.141.244:3001';

  return (
    <div className="space-y-6">

      {/* Visão Geral */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <FaInfoCircle className="text-blue-400" /> Visão Geral
        </h3>
        <p className="text-gray-300 mb-4">
          Permite cadastrar e consultar telefones nas listas de restrição. 
          A autenticação é feita com <strong className="text-white">email e senha</strong> do usuário —
          o tenant é identificado automaticamente, sem risco de cruzar dados com outros tenants.
        </p>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">URL Base</p>
          <code className="text-green-400 font-mono text-sm">{baseUrl}</code>
        </div>
      </div>

      {/* Listas disponíveis */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <FaLock className="text-yellow-400" /> Listas Disponíveis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { codigo: 'nao_me_perturbe', nome: 'Não Me Perturbe' },
            { codigo: 'bloqueado',       nome: 'Bloqueado' },
            { codigo: 'sem_interesse',   nome: 'Sem Interesse' },
            { codigo: 'sem_whatsapp',    nome: 'Sem WhatsApp' },
          ].map(l => (
            <div key={l.codigo} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <code className="text-purple-300 text-sm block">{l.codigo}</code>
              <span className="text-gray-400 text-xs">{l.nome}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ENDPOINT 1 — CADASTRAR */}
      <div className="bg-gray-800/50 border border-purple-700/50 rounded-xl overflow-hidden">
        <div className="bg-purple-900/40 px-6 py-4 flex items-center gap-3 border-b border-purple-700/50">
          <MethodBadge method="POST" />
          <code className="text-white font-mono text-sm">/api/public/restriction-list/add</code>
          <span className="text-gray-400 text-sm ml-auto">Cadastrar telefone</span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-gray-300">
            Adiciona um telefone em uma das listas. O sistema cadastra automaticamente as{' '}
            <strong className="text-white">duas versões</strong> do número (com e sem o 9º dígito).
          </p>

          <div>
            <h4 className="text-white font-semibold mb-3">Campos</h4>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <Campo nome="email"    tipo="string" obrigatorio={true}  descricao="Email de login do usuário" />
              <Campo nome="senha"    tipo="string" obrigatorio={true}  descricao="Senha do usuário" />
              <Campo nome="telefone" tipo="string" obrigatorio={true}  descricao="Número com DDI e DDD. Ex: 5511999999999" />
              <Campo nome="lista"    tipo="string" obrigatorio={true}  descricao="nao_me_perturbe | bloqueado | sem_interesse | sem_whatsapp" />
              <Campo nome="nome"     tipo="string" obrigatorio={false} descricao="Nome do contato (padrão: usa o telefone)" />
              <Campo nome="cpf"      tipo="string" obrigatorio={false} descricao="CPF do contato (salvo na observação)" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3">Requisição Mínima</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/add
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999",
  "lista": "nao_me_perturbe"
}`} />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Requisição Completa</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/add
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999",
  "lista": "bloqueado",
  "nome": "João Silva",
  "cpf": "123.456.789-00"
}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaCheckCircle className="text-green-400" /> Sucesso (201)
              </h4>
              <CodeBlock code={`{
  "sucesso": true,
  "mensagem": "Telefone adicionado com sucesso na lista \\"Bloqueado\\"",
  "registros_criados": 2,
  "lista": "Bloqueado",
  "telefone": "5511999999999"
}`} />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaTimesCircle className="text-red-400" /> Erros Possíveis
              </h4>
              <CodeBlock code={`// 401 - Credenciais inválidas
{ "sucesso": false, "mensagem": "Email ou senha inválidos" }

// 400 - Campo obrigatório ausente
{ "sucesso": false, "mensagem": "O campo lista é obrigatório..." }

// 409 - Telefone já cadastrado nesta lista
{ "sucesso": false, "mensagem": "O telefone já está cadastrado..." }`} />
            </div>
          </div>
        </div>
      </div>

      {/* ENDPOINT 2 — CONSULTAR */}
      <div className="bg-gray-800/50 border border-blue-700/50 rounded-xl overflow-hidden">
        <div className="bg-blue-900/40 px-6 py-4 flex items-center gap-3 border-b border-blue-700/50">
          <MethodBadge method="POST" />
          <code className="text-white font-mono text-sm">/api/public/restriction-list/consultar</code>
          <span className="text-gray-400 text-sm ml-auto">Consultar telefone</span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-gray-300">
            Verifica se um ou mais telefones estão em alguma lista de restrição.
            Aceita um número único ou um <strong className="text-white">array com vários números</strong> de uma vez.
          </p>

          <div>
            <h4 className="text-white font-semibold mb-3">Campos</h4>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <Campo nome="email"    tipo="string"        obrigatorio={true} descricao="Email de login do usuário" />
              <Campo nome="senha"    tipo="string"        obrigatorio={true} descricao="Senha do usuário" />
              <Campo nome="telefone" tipo="string | array" obrigatorio={true} descricao='Número único ou array de números. Ex: "5511999999999" ou ["5511...", "5521..."]' />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3">Consultar 1 telefone</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/consultar
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999"
}`} />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Consultar vários</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/consultar
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": [
    "5511999999999",
    "5521888888888"
  ]
}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaTimesCircle className="text-red-400" /> Telefone Restrito
              </h4>
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
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaCheckCircle className="text-green-400" /> Telefone Livre
              </h4>
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

      {/* ENDPOINT 3 — REMOVER */}
      <div className="bg-gray-800/50 border border-red-700/50 rounded-xl overflow-hidden">
        <div className="bg-red-900/40 px-6 py-4 flex items-center gap-3 border-b border-red-700/50">
          <MethodBadge method="POST" />
          <code className="text-white font-mono text-sm">/api/public/restriction-list/remover</code>
          <span className="text-gray-400 text-sm ml-auto">Remover telefone da lista</span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-gray-300">
            Remove um telefone de uma lista específica ou de{' '}
            <strong className="text-white">todas as listas</strong> de uma vez.
            O sistema remove automaticamente as duas versões do número (com e sem o 9º dígito).
          </p>

          <div>
            <h4 className="text-white font-semibold mb-3">Campos</h4>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <Campo nome="email"    tipo="string" obrigatorio={true}  descricao="Email de login do usuário" />
              <Campo nome="senha"    tipo="string" obrigatorio={true}  descricao="Senha do usuário" />
              <Campo nome="telefone" tipo="string" obrigatorio={true}  descricao="Número do telefone a ser removido" />
              <Campo nome="lista"    tipo="string" obrigatorio={false} descricao="Lista específica: nao_me_perturbe | bloqueado | sem_interesse | sem_whatsapp. Se omitido, remove de TODAS as listas" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3">Remover de uma lista específica</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/remover
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999",
  "lista": "bloqueado"
}`} />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Remover de TODAS as listas</h4>
              <CodeBlock code={`POST ${baseUrl}/api/public/restriction-list/remover
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "senha": "sua_senha",
  "telefone": "5511999999999"
}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaCheckCircle className="text-green-400" /> Sucesso
              </h4>
              <CodeBlock code={`{
  "sucesso": true,
  "mensagem": "Telefone removido com sucesso",
  "registros_removidos": 2,
  "listas_removidas": ["Bloqueado"],
  "telefone": "5511999999999"
}`} />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <FaTimesCircle className="text-red-400" /> Erros
              </h4>
              <CodeBlock code={`// 404 - Telefone não encontrado
{ "sucesso": false, "mensagem": "Telefone não encontrado na lista \\"Bloqueado\\"" }

// 401 - Credenciais inválidas
{ "sucesso": false, "mensagem": "Email ou senha inválidos" }

// 400 - Lista inválida
{ "sucesso": false, "mensagem": "Lista inválida: \\"xxx\\"..." }`} />
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-5">
        <h4 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
          <FaInfoCircle /> Informações Importantes
        </h4>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>• O sistema cadastra automaticamente <strong className="text-white">2 versões</strong> do número (com e sem o 9º dígito).</li>
          <li>• Cada usuário só acessa as listas do <strong className="text-white">seu próprio tenant</strong>.</li>
          <li>• A porta <strong className="text-white">3001</strong> é acessível diretamente sem necessidade de nginx.</li>
          <li>• Telefones com data de expiração vencida não aparecem nas consultas.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Definição das abas internas ────────────────────────────────────────────
const ABAS = [
  {
    id: 'lista-restricao',
    label: 'Lista de Restrição',
    icon: <FaBan />,
    descricao: 'Cadastrar e consultar telefones nas listas de restrição',
    componente: <TabListaRestricao />,
  },
  // Novas APIs serão adicionadas aqui como novos objetos
];

// ── Página principal ───────────────────────────────────────────────────────
export default function ApiExternaPage() {
  const [abaAtiva, setAbaAtiva] = useState('lista-restricao');
  const abaAtual = ABAS.find(a => a.id === abaAtiva);

  return (
    <AdminLayout
      title="API Externa"
      subtitle="Documentação para integração com sistemas externos"
      icon={<FaPlug className="text-3xl text-white" />}
      currentPage="api-externa"
    >
      <div className="max-w-5xl space-y-6">

        {/* Sub-navegação das APIs */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <FaPlug className="text-purple-400" /> APIs Disponíveis
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Selecione uma API para ver sua documentação completa
            </p>
          </div>

          <div className="flex flex-wrap gap-2 p-4">
            {ABAS.map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  abaAtiva === aba.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                }`}
              >
                {aba.icon}
                {aba.label}
              </button>
            ))}
          </div>

          {/* Descrição da aba selecionada */}
          {abaAtual && (
            <div className="px-6 py-3 bg-purple-900/20 border-t border-gray-700">
              <p className="text-purple-300 text-sm">{abaAtual.descricao}</p>
            </div>
          )}
        </div>

        {/* Conteúdo da aba selecionada */}
        {abaAtual?.componente}

      </div>
    </AdminLayout>
  );
}
