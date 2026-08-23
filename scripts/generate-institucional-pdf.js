const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const lines = [
  'NETTSISTEMAS - Amostra de e-mail marketing',
  '',
  'De: NETTSISTEMAS <contato@nettsistemas.com>',
  'Assunto: Novidades da plataforma - comunicacao com seus clientes',
  'Tipo: Marketing (amostra)',
  '',
  'Ola,',
  '',
  'Esta e uma amostra de e-mail marketing da plataforma Disparador NettSistemas,',
  'operada pela NETTSISTEMAS (CNPJ 65.528.559/0001-34).',
  '',
  'Solucao B2B: empresas clientes enviam campanhas as proprias bases, com opt-in',
  'e cancelamento de inscricao. Segmentos: varejo, servicos locais, clinicas,',
  'educacao e demais negocios.',
  '',
  'Site: https://sistemasnettsistemas.com.br/institucional',
  '',
  '--- RODAPE OBRIGATORIO ---',
  'Cancelar inscricao:',
  'https://api.sistemasnettsistemas.com.br/api/public/email-unsubscribe?t=demo-sample-for-compliance',
  'Politica de Privacidade:',
  'https://sistemasnettsistemas.com.br/institucional/privacidade',
  'Endereco fisico: Rua BM27, S/N - Quadra 28, Lote 23, Casa 02,',
  'Residencial Brisas da Mata, Goiania/GO, CEP 74475-364, Brasil',
  'Contato: contato@nettsistemas.com / +55 (62) 99844-9494',
  'Responsavel: Thiago Godinho Oliveira (Administrador)',
];

const contentLines = [];
let y = 800;
for (const line of lines) {
  contentLines.push('BT /F1 11 Tf 50 ' + y + ' Td (' + esc(line) + ') Tj ET');
  y -= 16;
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
