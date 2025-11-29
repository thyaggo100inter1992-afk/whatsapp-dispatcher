import { Request, Response } from 'express';
import { cleanupService } from '../services/cleanup.service';

export class StorageController {
  /**
   * Retorna estatísticas de armazenamento
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await cleanupService.getStorageStats();
      
      res.json({
        success: true,
        data: {
          ...stats,
          maxAgeInDays: 15,
          message: 'Arquivos são removidos automaticamente após 15 dias',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Executa limpeza manual de arquivos antigos
   */
  async cleanupNow(req: Request, res: Response) {
    try {
      const result = await cleanupService.cleanOldMediaFiles();
      
      res.json({
        success: true,
        data: result,
        message: `Limpeza concluída. ${result.deleted} arquivo(s) removido(s).`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const storageController = new StorageController();


