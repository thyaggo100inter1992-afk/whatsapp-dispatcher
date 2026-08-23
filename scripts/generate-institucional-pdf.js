const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const lines = [
  'NETTSISTEMAS - Exemplo de e-mail marketing',
  '',
  'De: NETTSISTEMAS <contato@nettsistemas.com>',
  'Assunto: Novidades - comunicacao com seus clientes',
  'Tipo: Marketing (exemplo)',
  '',
  'Ola,',
  '',
  'Esta e uma amostra de e-mail marketing do servico prestado pela NETTSISTEMAS',
  '(CNPJ 65.528.559/0001-34).',
  '',
  'Prestamos e-mail marketing e WhatsApp com operacao e controle nossos:',
  'campanhas, listas, opt-in e cancelamento de inscricao ficam sob nossa gestao.',
  'Atendemos varejo, servicos locais, clinicas, educacao e outros segmentos,',
  'sempre com comunicacao legitima e rastreavel.',
  '',
  'Site: https://sistemasnettsistemas.com.br/institucional',
  'Opt-in: https://sistemasnettsistemas.com.br/institucional/cadastro',
  '',
  '--- RODAPE ---',
  'Se voce nao deseja mais receber estes e-mails, cancele sua inscricao:',
  'https://api.sistemasnettsistemas.com.br/api/public/email-unsubscribe?t=exemplo-cancelamento',
  '',
  'Politica de Privacidade:',
  'https://sistemasnettsistemas.com.br/institucional/privacidade',
  '',
  'Endereco fisico:',
  'Rua BM27, S/N - Quadra 28, Lote 23, Casa 02,',
  'Residencial Brisas da Mata, Goiania/GO, CEP 74475-364, Brasil',
  '',
  'Contato empresa: contato@nettsistemas.com / +55 (62) 99844-9494',
  'Administrador: Thiago Godinho Oliveira / +55 (62) 99178-5664',
];

const contentLines = [];
let y = 800;
for (const line of lines) {
  contentLines.push('BT /F1 11 Tf 50 ' + y + ' Td (' + esc(line) + ') Tj ET');
  y -= 15;
}
const stream = contentLines.join('\n');
const objs = [];
objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
objs.push(
  '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n'
);
objs.push('4 0 obj<< /Length ' + Buffer.byteLength(stream) + ' >>stream\n' + stream + '\nendstream\nendobj\n');
objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

let pdf = '%PDF-1.4\n';
const offsets = [0];
for (const o of objs) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += o;
}
const xrefStart = Buffer.byteLength(pdf);
pdf += 'xref\n0 ' + (objs.length + 1) + '\n';
pdf += '0000000000 65535 f \n';
for (let i = 1; i < offsets.length; i++) {
  pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
}
pdf += 'trailer<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';

const outDir = path.join(__dirname, '../frontend/public/institucional');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'amostra-email-marketing.pdf');
fs.writeFileSync(out, pdf);
console.log('PDF OK', out, fs.statSync(out).size);
