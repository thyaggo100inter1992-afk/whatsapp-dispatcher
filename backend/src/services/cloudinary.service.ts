import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

class CloudinaryService {
  private isConfigured: boolean = false;

  /**
   * Configurar Cloudinary com credenciais
   */
  configure(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    });
    this.isConfigured = true;
    console.log('✅ Cloudinary configurado com sucesso!');
  }

  /**
   * Verificar se Cloudinary está configurado
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Fazer upload de arquivo para Cloudinary
   */
  async uploadFile(filePath: string, folder: string = 'whatsapp-templates'): Promise<{
    success: boolean;
    url?: string;
    publicId?: string;
    error?: string;
  }> {
    try {
      if (!this.isConfigured) {
        throw new Error('Cloudinary não está configurado');
      }

      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      console.log(`📤 Fazendo upload para Cloudinary: ${filePath}`);

      // Upload para Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: 'auto', // Detecta automaticamente (image, video, raw)
        use_filename: true,
        unique_filename: true,
      });

      console.log(`✅ Upload concluído! URL: ${result.secure_url}`);

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload para Cloudinary:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Deletar arquivo do Cloudinary
   */
  async deleteFile(publicId: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        throw new Error('Cloudinary não está configurado');
      }

      await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Arquivo deletado do Cloudinary: ${publicId}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao deletar do Cloudinary:', error);
      return false;
    }
  }

  /**
   * Obter informações sobre um arquivo no Cloudinary
   */
  async getFileInfo(publicId: string): Promise<any> {
    try {
      if (!this.isConfigured) {
        throw new Error('Cloudinary não está configurado');
      }

      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error: any) {
      console.error('❌ Erro ao obter informações do Cloudinary:', error);
      return null;
    }
  }
}

export const cloudinaryService = new CloudinaryService();




