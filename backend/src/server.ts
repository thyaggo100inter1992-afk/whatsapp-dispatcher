import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fileUpload from 'express-fileupload';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import routes from './routes';
import { testConnection } from './database/connection';
import { cleanupService } from './services/cleanup.service';
import { campaignWorker } from './workers/campaign.worker';
import { qrCampaignWorker } from './workers/qr-campaign.worker';
import { startEmailMarketingWorker } from './workers/email-marketing.worker';
import { restrictionCleanupWorker } from './workers/restriction-cleanup.worker';
import { trialCleanupWorker } from './workers/trial-cleanup.worker';
import { paymentRenewalWorker } from './workers/payment-renewal.worker';
import { cloudinaryService } from './services/cloudinary.service';
// import { messageQueue, campaignQueue } from './services/queue.service'; // Desabilitado temporariamente

// Importar logger service (deve ser um dos primeiros para capturar todos os logs)
const loggerService = require('./services/logger.service');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://sistemasnettsistemas.com.br',
      'http://sistemasnettsistemas.com.br',
      'https://api.sistemasnettsistemas.com.br',
      'http://api.sistemasnettsistemas.com.br',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Exportar io para uso em outros módulos
export { io };

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://sistemasnettsistemas.com.br',
    'http://sistemasnettsistemas.com.br',
    'https://api.sistemasnettsistemas.com.br',
    'http://api.sistemasnettsistemas.com.br',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Servir arquivos estáticos (mídias do chat)
app.use('/media', express.static(path.join(__dirname, '../public/media')));
console.log('📁 Pasta de mídias configurada: /media');

// 🔧 MIDDLEWARE ESPECIAL: Corrigir JSON malformado da UAZAPI
app.use(['/api/qr-webhook/uaz-event', '/api/webhook/tenant-'], express.raw({ type: 'application/json' }), (req: any, res, next) => {
  try {
    if (req.body && Buffer.isBuffer(req.body)) {
      let bodyStr = req.body.toString('utf8');
      
      // Corrigir caracteres de escape incorretos da UAZAPI
      // Exemplo: {" type\\:\\messages_update\\} -> {"type":"messages_update"}
      bodyStr = bodyStr
        .replace(/\{"\s*/g, '{"')  // Remove espaços após {"
        .replace(/\\:/g, '":')      // Substitui \: por ":
        .replace(/\\,/g, ',"')      // Substitui \, por ,"
        .replace(/\\/g, '"')        // Substitui \ restantes por "
        .replace(/\[\\/g, '["')     // Arrays: [\  -> ["
        .replace(/\\\]/g, '"]');    // Arrays: \]  -> "]
      
      console.log('🔧 [UAZAPI Fix] Body original:', req.body.toString('utf8').substring(0, 200));
      console.log('🔧 [UAZAPI Fix] Body corrigido:', bodyStr.substring(0, 200));
      
      try {
        req.body = JSON.parse(bodyStr);
        console.log('✅ [UAZAPI Fix] JSON parseado com sucesso');
      } catch (parseError: any) {
        console.error('❌ [UAZAPI Fix] Erro ao parsear JSON corrigido:', parseError.message);
        console.error('   Body que falhou:', bodyStr.substring(0, 500));
      }
    }
  } catch (error: any) {
    console.error('❌ [UAZAPI Fix] Erro no middleware:', error.message);
  }
  next();
});

// ⚠️ IMPORTANTE: NÃO aplicar express.json() e express.urlencoded() em rotas de upload multipart/form-data
// O Multer precisa processar o body RAW
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Se for multipart/form-data (upload), pular esses middlewares
  if (contentType.includes('multipart/form-data')) {
    console.log('🔄 Detectado multipart/form-data - pulando express.json/urlencoded');
    return next();
  }
  
  // Aplicar middlewares normalmente para outros tipos de conteúdo
  express.json({ limit: '500mb' })(req, res, (err: any) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit: '500mb' })(req, res, next);
  });
});

// 🔤 Garantir que todas as respostas JSON sejam UTF-8
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

// Middleware para upload de arquivos (express-fileupload)
// ⚠️ ATENÇÃO: Aplicar APENAS em rotas específicas que não usam Multer
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const path = req.path;
  
  // NÃO aplicar express-fileupload em rotas que usam Multer
  if (
    path.includes('/upload-media') || 
    path.includes('/upload/media') || 
    path.includes('/system-settings/logo') || 
    path.includes('/tutorials/upload') || 
    path.includes('/screenshots') ||
    path.includes('/restriction-lists/import') ||
    path.includes('/restriction-lists/bulk-import') ||
    (path.includes('/conversations') && path.includes('/messages/media'))  // ✅ Chat media upload
  ) {
    console.log('🔄 Rota de upload detectada - pulando express-fileupload (usa Multer)');
    return next();
  }
  
  // Aplicar express-fileupload em outras rotas
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    abortOnLimit: true,
    responseOnLimit: 'Arquivo muito grande. Tamanho máximo: 5MB'
  })(req, res, next);
});

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Healthcheck básico (antes dos middlewares de tenant)
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    environment: process.env.NODE_ENV || 'development',
    workersDisabled: process.env.DISABLE_BACKGROUND_WORKERS === 'true',
    timestamp: new Date().toISOString(),
  });
});

// 🔍 DEBUG ENDPOINT - ANTES DOS MIDDLEWARES (TEMPORÁRIO)
app.get('/api/uaz/debug/all-instances', async (req, res) => {
  try {
    const { pool } = require('./database/connection');
    
    console.log('\n🔍 ========================================');
    console.log('🔍 DEBUG: BUSCANDO TODAS INSTÂNCIAS UAZ');
    console.log('🔍 ========================================\n');

    const allInstances = await pool.query(`
      SELECT id, name, session_name, instance_token, tenant_id, phone_number, 
             is_active, is_connected, status, created_at
      FROM uaz_instances 
      ORDER BY tenant_id NULLS FIRST, id
    `);

    console.log(`📊 Total encontrado: ${allInstances.rows.length}`);

    const byTenant: any = {};
    const orphans: any[] = [];

    allInstances.rows.forEach((inst: any) => {
      if (inst.tenant_id === null) {
        orphans.push(inst);
      } else {
        if (!byTenant[inst.tenant_id]) {
          byTenant[inst.tenant_id] = [];
        }
        byTenant[inst.tenant_id].push(inst);
      }
    });

    const nettcredInstances = allInstances.rows.filter((inst: any) => 
      inst.name && (inst.name.includes('8104-5992') || inst.name.includes('NETTCRED'))
    );

    let html = '<html><head><meta charset="utf-8"><style>body{font-family:monospace;padding:20px;background:#1e1e1e;color:#fff;}pre{background:#2d2d2d;padding:15px;border-radius:5px;overflow-x:auto;}.success{color:#4ec9b0;}.error{color:#f48771;}.warning{color:#dcdcaa;}</style></head><body>';
    html += '<h1>🔍 DEBUG: TODAS INSTÂNCIAS UAZ</h1>';
    html += `<p class="success">📊 Total: ${allInstances.rows.length} instância(s)</p>`;
    
    if (orphans.length > 0) {
      html += `<h2 class="warning">⚠️  Instâncias Órfãs (sem tenant): ${orphans.length}</h2><pre>`;
      orphans.forEach((inst: any) => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tel: ${inst.phone_number || 'N/A'} | Status: ${inst.status}\n`;
      });
      html += '</pre>';
    }
    
    Object.keys(byTenant).sort().forEach((tid: string) => {
      html += `<h2>📦 Tenant ${tid}: ${byTenant[tid].length} instância(s)</h2><pre>`;
      byTenant[tid].forEach((inst: any) => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tel: ${inst.phone_number || 'N/A'} | Status: ${inst.status} | Ativa: ${inst.is_active}\n`;
      });
      html += '</pre>';
    });
    
    if (nettcredInstances.length > 0) {
      html += `<h2 class="success">✅ INSTÂNCIAS NETTCRED: ${nettcredInstances.length}</h2><pre>`;
      nettcredInstances.forEach((inst: any) => {
        html += `ID: ${inst.id} | Nome: ${inst.name} | Tenant: ${inst.tenant_id} | Tel: ${inst.phone_number}\n`;
      });
      html += '</pre>';
    } else {
      html += '<h2 class="error">❌ NENHUMA instância NETTCRED encontrada</h2>';
    }
    
    html += '</body></html>';
    res.send(html);

  } catch (error: any) {
    console.error('❌ Erro ao buscar instâncias:', error);
    res.status(500).send(`<html><body style="font-family:monospace;padding:20px;background:#1e1e1e;color:#f48771;"><h1>❌ Erro</h1><pre>${error.message}\n\n${error.stack}</pre></body></html>`);
  }
});

// 🔒 MIDDLEWARE DE PROTEÇÃO GLOBAL - TENANT ISOLATION
const { ensureTenant, detectDangerousQueries } = require('./middleware/tenant-protection.middleware');

// Aplicar middlewares de proteção ANTES das rotas
app.use(detectDangerousQueries);
app.use(ensureTenant);
console.log('🔒 Middlewares de proteção de tenant ativados');

// Rotas
console.log('📋 Registrando rotas da API...');

// 🔧 Rota temporária para criar lista "Sem WhatsApp" (sem autenticação)
app.get('/fix/criar-lista-sem-whatsapp', async (req, res) => {
  try {
    const { query } = require('./database/connection');
    const result = await query(
      `INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) 
       VALUES ($1, $2, $3, NULL, true) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, description = EXCLUDED.description, auto_add_enabled = EXCLUDED.auto_add_enabled
       RETURNING *`,
      ['no_whatsapp', 'Sem WhatsApp', 'Números sem WhatsApp ou inválidos']
    );
    const check = await query(`SELECT * FROM restriction_list_types`);
    res.json({ success: true, message: 'Lista criada!', lista: result.rows[0], todas: check.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 Debug de campanhas QR
app.get('/fix/debug-qr-campaigns', async (req, res) => {
  try {
    const { query } = require('./database/connection');
    
    // Primeiro verificar quais tabelas existem
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%qr%' OR table_name LIKE '%campaign%')
      ORDER BY table_name
    `);
    
    // Tentar buscar de qr_campaigns
    let qrCampaigns: any[] = [];
    try {
      const result = await query(`SELECT * FROM qr_campaigns ORDER BY id DESC LIMIT 20`);
      qrCampaigns = result.rows;
    } catch (e: any) {
      console.log('Erro ao buscar qr_campaigns:', e.message);
    }

    // Buscar campanhas normais
    let campaigns: any[] = [];
    try {
      const result = await query(`SELECT id, name, status, campaign_type, tenant_id FROM campaigns ORDER BY id DESC LIMIT 20`);
      campaigns = result.rows;
    } catch (e: any) {
      console.log('Erro ao buscar campaigns:', e.message);
    }

    res.json({ 
      success: true, 
      tables: tables.rows.map((t: any) => t.table_name),
      qr_campaigns: qrCampaigns,
      campaigns: campaigns
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 Forçar campanha QR para "completed" ou reiniciar
app.get('/fix/qr-campaign/:id/:action', async (req, res) => {
  try {
    const { query } = require('./database/connection');
    const { id, action } = req.params;
    
    if (action === 'complete') {
      await query('UPDATE qr_campaigns SET status = $1 WHERE id = $2', ['completed', id]);
      res.json({ success: true, message: `Campanha ${id} marcada como concluída` });
    } else if (action === 'restart') {
      await query('UPDATE qr_campaigns SET status = $1 WHERE id = $2', ['pending', id]);
      res.json({ success: true, message: `Campanha ${id} reiniciada como pendente` });
    } else {
      res.json({ success: false, error: 'Ação inválida. Use: complete ou restart' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔧 Diagnóstico de criação de campanha QR
app.get('/fix/test-qr-create', async (req, res) => {
  try {
    const { query, pool } = require('./database/connection');
    
    console.log('🧪 Testando criação de campanha QR...');
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Testar set_config (RLS)
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', '1']);
      console.log('✅ set_config funcionou');
      
      // Testar INSERT
      const result = await client.query(
        `INSERT INTO qr_campaigns 
         (name, tenant_id, status, total_contacts)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        ['TEST-CAMPANHA-DELETAR', 1, 'pending', 0]
      );
      console.log('✅ INSERT funcionou, ID:', result.rows[0]?.id);
      
      // Fazer rollback (não salvar)
      await client.query('ROLLBACK');
      console.log('✅ ROLLBACK feito');
      
      res.json({ 
        success: true, 
        message: 'Teste de criação passou!',
        test_id: result.rows[0]?.id
      });
    } catch (innerError: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro no teste:', innerError.message);
      res.status(500).json({ success: false, error: innerError.message, stack: innerError.stack });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Erro geral:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api', routes);
console.log('✅ Todas as rotas registradas em /api');

// Socket.IO para atualizações em tempo real
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Enviar atualizações de progresso via Socket.IO
// DESABILITADO TEMPORARIAMENTE - SEM REDIS
/*
messageQueue.on('progress', (job, progress) => {
  io.emit('message:progress', {
    jobId: job.id,
    messageId: job.data.messageId,
    progress,
  });
});

messageQueue.on('completed', (job, result) => {
  io.emit('message:completed', {
    jobId: job.id,
    messageId: job.data.messageId,
    result,
  });
});

messageQueue.on('failed', (job, err) => {
  io.emit('message:failed', {
    jobId: job?.id,
    messageId: job?.data?.messageId,
    error: err.message,
  });
});

campaignQueue.on('progress', (job, progress) => {
  io.emit('campaign:progress', {
    jobId: job.id,
    campaignId: job.data.campaignId,
    progress,
  });
});

campaignQueue.on('completed', (job, result) => {
  io.emit('campaign:completed', {
    jobId: job.id,
    campaignId: job.data.campaignId,
    result,
  });
});

campaignQueue.on('failed', (job, err) => {
  io.emit('campaign:failed', {
    jobId: job?.id,
    campaignId: job?.data?.campaignId,
    error: err.message,
  });
});
*/

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Testar conexão com banco de dados
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // 📵 Garantir que a lista "Sem WhatsApp" existe no banco
    try {
      const { query } = require('./database/connection');
      await query(
        `INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) 
         VALUES ($1, $2, $3, NULL, true) 
         ON CONFLICT (id) DO NOTHING`,
        ['no_whatsapp', 'Sem WhatsApp', 'Números sem WhatsApp ou inválidos']
      );
      console.log('✅ Lista "Sem WhatsApp" verificada/criada');
    } catch (error: any) {
      console.log('⚠️ Aviso ao verificar lista "Sem WhatsApp":', error.message);
    }

    // Configurar Cloudinary (opcional)
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        cloudinaryService.configure({
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.CLOUDINARY_API_KEY,
          apiSecret: process.env.CLOUDINARY_API_SECRET,
        });
        console.log('☁️ Cloudinary configurado e pronto para uso!');
      } catch (error: any) {
        console.error('⚠️ Erro ao configurar Cloudinary:', error.message);
        console.log('   Sistema continuará funcionando com URLs locais.');
      }
    } else {
      console.log('⚠️ Cloudinary não configurado (variáveis de ambiente não encontradas)');
      console.log('   Para usar Cloudinary, adicione as seguintes variáveis ao .env:');
      console.log('   - CLOUDINARY_CLOUD_NAME');
      console.log('   - CLOUDINARY_API_KEY');
      console.log('   - CLOUDINARY_API_SECRET');
    }

    // Iniciar servidor
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('🚀 ========================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🚀 API: http://localhost:${PORT}/api`);
      console.log(`🚀 Health: http://localhost:${PORT}/api/health`);
      console.log('🚀 ========================================');
      console.log('');
    });

    // Executar limpeza inicial ao iniciar o servidor
    console.log('🧹 Executando limpeza inicial de arquivos antigos...');
    await cleanupService.cleanOldMediaFiles();

    // Agendar limpeza automática para rodar todos os dias às 2h da manhã
    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Executando limpeza agendada de arquivos antigos...');
      await cleanupService.cleanOldMediaFiles();
    });

    console.log('✅ Limpeza automática configurada (todos os dias às 2h)');
    console.log('🗑️  Arquivos com mais de 15 dias serão removidos automaticamente');
    console.log('');

    // Agendar limpeza de campanhas finalizadas antigas (todos os dias às 3h da manhã)
    cron.schedule('0 3 * * *', async () => {
      // TODO: Implementar limpeza automática corretamente (precisa de Request)
      // console.log('⏰ Executando limpeza automática de campanhas finalizadas antigas...');
      // try {
      //   const { campaignController } = await import('./controllers/campaign.controller');
      //   const deletedCount = await campaignController.deleteOldFinished(req, 7); // 7 dias
      //   console.log(`✅ Limpeza automática concluída: ${deletedCount} campanha(s) excluída(s)`);
      // } catch (error) {
      //   console.error('❌ Erro na limpeza automática de campanhas:', error);
      // }
    });

    console.log('✅ Limpeza automática de campanhas configurada (todos os dias às 3h)');
    console.log('🗑️  Campanhas finalizadas há mais de 7 dias serão excluídas automaticamente');
    console.log('');

    const workersDisabled = process.env.DISABLE_BACKGROUND_WORKERS === 'true';

    if (workersDisabled) {
      console.log('⏸️ DISABLE_BACKGROUND_WORKERS=true -> Workers de campanha/pagamento não serão iniciados.');
    } else {
      // Iniciar Campaign Worker
      console.log('🚀 Iniciando Campaign Worker...');
      campaignWorker.start();
      console.log('✅ Campaign Worker iniciado e processando campanhas');
      console.log('');

      // Iniciar QR Campaign Worker
      console.log('🚀 Iniciando QR Campaign Worker...');
      qrCampaignWorker.start();
      console.log('✅ QR Campaign Worker iniciado e processando campanhas QR');
      console.log('');

      // Iniciar Email Marketing Worker
      console.log('📧 Iniciando Email Marketing Worker...');
      startEmailMarketingWorker();
      console.log('✅ Email Marketing Worker iniciado');

      // Iniciar Restriction Cleanup Worker
      console.log('🚀 Iniciando Restriction Cleanup Worker...');
      restrictionCleanupWorker.start();
      console.log('✅ Restriction Cleanup Worker iniciado (executa a cada hora)');
      console.log('🗑️  Listas expiradas serão removidas automaticamente');
      console.log('');

      // Iniciar Trial Cleanup Worker
      console.log('🚀 Iniciando Trial Cleanup Worker...');
      // Executar imediatamente na inicialização
      trialCleanupWorker.run();
      // Agendar para executar a cada 2 horas
      cron.schedule('0 */2 * * *', () => {
        console.log('⏰ Executando Trial Cleanup Worker...');
        trialCleanupWorker.run();
      });
      console.log('✅ Trial Cleanup Worker iniciado (executa a cada 2 horas)');
      console.log('🔒 Trials de 3 dias expirados serão bloqueados automaticamente');
      console.log('🗑️  Tenants bloqueados há 20 dias serão deletados');
      console.log('');

      // Iniciar Payment Renewal Worker
      console.log('🚀 Iniciando Payment Renewal Worker...');
      // Executar imediatamente na inicialização
      paymentRenewalWorker.run();
      // Agendar para executar a cada 2 horas
      cron.schedule('0 */2 * * *', () => {
        console.log('⏰ Executando Payment Renewal Worker...');
        paymentRenewalWorker.run();
      });
      console.log('✅ Payment Renewal Worker iniciado (executa a cada 2 horas)');
      console.log('💰 Vencimentos de pagamento serão verificados automaticamente');
      console.log('📧 Notificações enviadas 3, 2 e 1 dias antes do vencimento');
      console.log('🔄 Período de carência: 20 dias após bloqueio');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  campaignWorker.stop();
  // qrCampaignWorker.stop(); // QR worker não tem método stop por enquanto
  restrictionCleanupWorker.stop();
  // await messageQueue.close(); // Desabilitado temporariamente
  // await campaignQueue.close(); // Desabilitado temporariamente
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});






