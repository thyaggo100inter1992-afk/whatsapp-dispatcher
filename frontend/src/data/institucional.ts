/** Dados públicos da NETTSISTEMAS — site institucional (SendGrid / compliance) */
export const INSTITUCIONAL = {
  razaoSocial: 'NETTSISTEMAS',
  nomeFantasia: 'NETTSISTEMAS',
  produto: 'Disparador NettSistemas',
  cnpj: '65.528.559/0001-34',
  enderecoLinha1: 'Rua BM27, S/N — Quadra 28, Lote 23, Casa 02',
  bairro: 'Residencial Brisas da Mata',
  cidade: 'Goiânia',
  uf: 'GO',
  cep: '74475-364',
  telefone: '62998449494',
  telefoneFmt: '+55 (62) 99844-9494',
  email: 'contato@nettsistemas.com',
  dominio: 'sistemasnettsistemas.com.br',
  siteBase: 'https://sistemasnettsistemas.com.br',
  responsavel: 'Thiago Godinho Oliveira',
  cargo: 'Administrador',
  linkedin: 'https://www.linkedin.com/in/thiago-godinho-oliveira-2a757227b/',
} as const;

export function enderecoCompleto() {
  const c = INSTITUCIONAL;
  return `${c.enderecoLinha1}, ${c.bairro}, ${c.cidade}/${c.uf}, CEP ${c.cep}, Brasil`;
}

export const PATHS = {
  home: '/institucional',
  privacidade: '/institucional/privacidade',
  cadastro: '/institucional/cadastro',
  amostra: '/institucional/amostra-email',
  pdf: '/institucional/amostra-email-marketing.pdf',
} as const;
