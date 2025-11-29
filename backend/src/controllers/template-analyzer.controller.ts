import { Request, Response } from 'express';
import { templateAnalyzerService } from '../services/template-analyzer.service';
import { tenantQuery } from '../database/tenant-query';

export class TemplateAnalyzerController {
  /**
   * Analisar templates existentes para descobrir o formato correto
   */
  async analyzeExistingTemplates(req: Request, res: Response) {
    try {
      const { accountId } = req.params;

      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'ID da conta não fornecido',
        });
      }

      // Buscar dados da conta
      const accountResult = await tenantQuery(
        req,
        'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada',
        });
      }

      const account = accountResult.rows[0];

      console.log(`🔍 Analisando templates existentes da conta: ${account.name}`);

      const result = await templateAnalyzerService.analyzeExistingTemplates(
        account.access_token,
        account.business_account_id
      );

      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao analisar templates:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Testar diferentes formatos de criação de template
   */
  async testFormats(req: Request, res: Response) {
    try {
      const { accountId } = req.params;
      const { testImageUrl } = req.body;

      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'ID da conta não fornecido',
        });
      }

      if (!testImageUrl) {
        return res.status(400).json({
          success: false,
          error: 'URL da imagem de teste não fornecida',
        });
      }

      // Buscar dados da conta
      const accountResult = await tenantQuery(
        req,
        'SELECT id, name, access_token, business_account_id FROM whatsapp_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta não encontrada',
        });
      }

      const account = accountResult.rows[0];

      console.log(
        `🧪 Testando formatos de template com imagem para conta: ${account.name}`
      );
      console.log(`🔗 URL de teste: ${testImageUrl}`);

      const result = await templateAnalyzerService.testDifferentFormats(
        account.access_token,
        account.business_account_id,
        testImageUrl
      );

      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao testar formatos:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const templateAnalyzerController = new TemplateAnalyzerController();




