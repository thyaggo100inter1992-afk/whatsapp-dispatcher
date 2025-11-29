import { Router } from 'express';
import { templateAnalyzerController } from '../controllers/template-analyzer.controller';

const router = Router();

console.log('🔧 Configurando rotas do Template Analyzer...');

/**
 * @route GET /api/template-analyzer/health
 * @desc Health check para verificar se a rota está funcionando
 */
router.get('/health', (req, res) => {
  console.log('✅ Health check do Template Analyzer');
  res.json({
    success: true,
    message: 'Template Analyzer funcionando!',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route GET /api/template-analyzer/:accountId/analyze
 * @desc Analisar templates existentes com imagens para descobrir o formato correto
 */
router.get('/:accountId/analyze', (req, res) => {
  console.log(`📥 Requisição recebida: GET /api/template-analyzer/${req.params.accountId}/analyze`);
  return templateAnalyzerController.analyzeExistingTemplates(req, res);
});

/**
 * @route POST /api/template-analyzer/:accountId/test-formats
 * @desc Testar diferentes formatos de criação de template com imagem
 * @body { testImageUrl: string }
 */
router.post('/:accountId/test-formats', (req, res) => {
  console.log(`📥 Requisição recebida: POST /api/template-analyzer/${req.params.accountId}/test-formats`);
  return templateAnalyzerController.testFormats(req, res);
});

console.log('✅ Rotas do Template Analyzer configuradas:');
console.log('   - GET  /:accountId/analyze');
console.log('   - POST /:accountId/test-formats');

export default router;

