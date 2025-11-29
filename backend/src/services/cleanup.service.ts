import fs from 'fs';
import path from 'path';

export class CleanupService {
  private uploadsDir = path.join(__dirname, '../../uploads/media');
  private maxAgeInDays = 15;

  /**
   * Remove arquivos de mídia com mais de X dias
   */
  async cleanOldMediaFiles(): Promise<{ deleted: number; errors: number; files: string[] }> {
    console.log('🧹 Iniciando limpeza de arquivos antigos...');
    console.log(`📁 Diretório: ${this.uploadsDir}`);
    console.log(`⏰ Removendo arquivos com mais de ${this.maxAgeInDays} dias`);

    const results = {
      deleted: 0,
      errors: 0,
      files: [] as string[],
    };

    try {
      // Verificar se o diretório existe
      if (!fs.existsSync(this.uploadsDir)) {
        console.log('📂 Diretório de uploads não existe ainda');
        return results;
      }

      // Ler todos os arquivos do diretório
      const files = fs.readdirSync(this.uploadsDir);
      
      if (files.length === 0) {
        console.log('📭 Nenhum arquivo para limpar');
        return results;
      }

      console.log(`📊 Encontrados ${files.length} arquivos para verificar`);

      const now = Date.now();
      const maxAge = this.maxAgeInDays * 24 * 60 * 60 * 1000; // Converter dias para milissegundos

      for (const file of files) {
        try {
          const filePath = path.join(this.uploadsDir, file);
          const stats = fs.statSync(filePath);

          // Calcular idade do arquivo
          const fileAge = now - stats.mtimeMs;

          if (fileAge > maxAge) {
            // Arquivo mais antigo que o limite, deletar
            fs.unlinkSync(filePath);
            
            const ageInDays = Math.floor(fileAge / (24 * 60 * 60 * 1000));
            console.log(`🗑️  Removido: ${file} (${ageInDays} dias)`);
            
            results.deleted++;
            results.files.push(file);
          }
        } catch (error: any) {
          console.error(`❌ Erro ao processar arquivo ${file}:`, error.message);
          results.errors++;
        }
      }

      console.log('');
      console.log('✅ Limpeza concluída!');
      console.log(`   📊 Total verificado: ${files.length}`);
      console.log(`   🗑️  Arquivos removidos: ${results.deleted}`);
      console.log(`   ❌ Erros: ${results.errors}`);
      console.log('');

    } catch (error: any) {
      console.error('❌ Erro na limpeza de arquivos:', error);
      results.errors++;
    }

    return results;
  }

  /**
   * Retorna estatísticas dos arquivos
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    oldestFileAge: number;
    newestFileAge: number;
  }> {
    const stats = {
      totalFiles: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      oldestFileAge: 0,
      newestFileAge: 0,
    };

    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return stats;
      }

      const files = fs.readdirSync(this.uploadsDir);
      stats.totalFiles = files.length;

      const now = Date.now();
      let oldestTime = now;
      let newestTime = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const fileStats = fs.statSync(filePath);
        
        stats.totalSizeBytes += fileStats.size;

        if (fileStats.mtimeMs < oldestTime) {
          oldestTime = fileStats.mtimeMs;
        }
        if (fileStats.mtimeMs > newestTime) {
          newestTime = fileStats.mtimeMs;
        }
      }

      stats.totalSizeMB = Math.round((stats.totalSizeBytes / (1024 * 1024)) * 100) / 100;
      stats.oldestFileAge = Math.floor((now - oldestTime) / (24 * 60 * 60 * 1000));
      stats.newestFileAge = Math.floor((now - newestTime) / (24 * 60 * 60 * 1000));

    } catch (error: any) {
      console.error('❌ Erro ao obter estatísticas:', error);
    }

    return stats;
  }
}

export const cleanupService = new CleanupService();


