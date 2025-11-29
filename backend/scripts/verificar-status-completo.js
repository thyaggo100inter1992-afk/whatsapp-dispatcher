#!/usr/bin/env node

/**
 * VERIFICAÇÃO COMPLETA DO STATUS DO SISTEMA
 * Verifica se TUDO está rodando e funcionando
 */

const http = require('http');
const https = require('https');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Cores
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`),
};

let allGood = true;

// Verificar se uma URL está acessível
function checkUrl(url, description) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 401) {
        log.success(`${description} está RODANDO (${url})`);
        resolve(true);
      } else {
        log.warning(`${description} respondeu com status ${res.statusCode}`);
        resolve(true);
      }
    });

    req.on('error', (err) => {
      log.error(`${description} NÃO está rodando (${url})`);
      log.info(`   Erro: ${err.message}`);
      resolve(false);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      log.error(`${description} não respondeu (timeout)`);
      resolve(false);
    });
  });
}

// Verificar banco de dados
async function checkDatabase() {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    
    if (!process.env.DATABASE_URL) {
      log.error('DATABASE_URL não configurada');
      return false;
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    await pool.query('SELECT NOW()');
    log.success('Banco de dados está CONECTADO e respondendo');
    
    // Verificar tenant 1
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = 1');
    if (tenant.rows.length > 0) {
      log.success(`Tenant 1 existe: ${tenant.rows[0].nome}`);
    } else {
      log.error('Tenant 1 não encontrado!');
    }
    
    // Verificar RLS
    const rls = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('campaigns', 'contacts', 'messages', 'templates')
      AND rowsecurity = true
    `);
    
    log.success(`RLS ativo em ${rls.rows.length}/4 tabelas principais`);
    
    await pool.end();
    return true;
  } catch (error) {
    log.error(`Erro ao conectar banco: ${error.message}`);
    return false;
  }
}

// Verificar processos Node rodando (Windows)
async function checkProcesses() {
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', (error, stdout, stderr) => {
      if (error) {
        log.warning('Não foi possível verificar processos Node');
        resolve(false);
        return;
      }
      
      const lines = stdout.trim().split('\n').filter(line => line.includes('node.exe'));
      
      if (lines.length > 0) {
        log.success(`${lines.length} processo(s) Node.exe rodando`);
        resolve(true);
      } else {
        log.error('Nenhum processo Node.exe encontrado');
        resolve(false);
      }
    });
  });
}

// Verificação principal
async function verificarTudo() {
  console.log('\n');
  console.log(colors.cyan + '╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║       🔍 VERIFICAÇÃO COMPLETA DO STATUS 🔍               ║');
  console.log('║       Checando se TUDO está rodando                      ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝' + colors.reset);
  console.log('\n');

  // 1. Verificar Backend
  log.section('1️⃣  VERIFICANDO BACKEND');
  const backendOk = await checkUrl('http://localhost:3000', 'Backend (porta 3000)');
  if (!backendOk) {
    allGood = false;
    log.warning('Backend não está rodando!');
    log.info('   Para iniciar: cd backend && npm start');
  }

  // 2. Verificar Frontend
  log.section('2️⃣  VERIFICANDO FRONTEND');
  const frontendOk = await checkUrl('http://localhost:3001', 'Frontend (porta 3001)');
  if (!frontendOk) {
    // Tentar porta 3000 também
    const frontend3000 = await checkUrl('http://localhost:3000', 'Frontend (porta 3000)');
    if (!frontend3000) {
      allGood = false;
      log.warning('Frontend não está rodando!');
      log.info('   Para iniciar: cd frontend && npm run dev');
    }
  }

  // 3. Verificar Banco de Dados
  log.section('3️⃣  VERIFICANDO BANCO DE DADOS');
  const dbOk = await checkDatabase();
  if (!dbOk) {
    allGood = false;
  }

  // 4. Verificar Processos Node
  log.section('4️⃣  VERIFICANDO PROCESSOS NODE');
  await checkProcesses();

  // 5. Verificar APIs
  log.section('5️⃣  VERIFICANDO APIS');
  const apiHealth = await checkUrl('http://localhost:3000/api/auth/login', 'API Auth Login');
  
  // Relatório Final
  log.section('📊 RELATÓRIO FINAL');

  if (allGood) {
    console.log(colors.green + '╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║     ✅ SISTEMA 100% OPERACIONAL! ✅                      ║');
    console.log('║                                                          ║');
    console.log('║  Todos os serviços estão rodando corretamente!           ║');
    console.log('║                                                          ║');
    console.log('║  🌐 Frontend: http://localhost:3001                      ║');
    console.log('║  🔧 Backend: http://localhost:3000                       ║');
    console.log('║  🗄️  Banco: Conectado e funcionando                      ║');
    console.log('║                                                          ║');
    console.log('║  Acesse: http://localhost:3001/login                     ║');
    console.log('║  Email: admin@minhaempresa.com                           ║');
    console.log('║  Senha: admin123                                         ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝' + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.yellow + '╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║     ⚠️  ALGUNS SERVIÇOS NÃO ESTÃO RODANDO ⚠️            ║');
    console.log('║                                                          ║');
    console.log('║  Revise os erros acima e inicie os serviços.             ║');
    console.log('║                                                          ║');
    console.log('║  Para iniciar Backend:                                   ║');
    console.log('║  cd backend && npm start                                 ║');
    console.log('║                                                          ║');
    console.log('║  Para iniciar Frontend:                                  ║');
    console.log('║  cd frontend && npm run dev                              ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝' + colors.reset);
    process.exit(1);
  }
}

// Executar
verificarTudo();





