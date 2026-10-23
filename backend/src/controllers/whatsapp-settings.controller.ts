import { Request, Response } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { tenantQuery } from '../database/tenant-query';
import { ProxyConfig, applyProxyToRequest, formatProxyInfo, getProxyConfigFromAccount } from '../helpers/proxy.helper';

export class WhatsAppSettingsController {

  /**
   * Wrapper para requisições GET com proxy automático
   */
  private async makeProxyRequest(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    account: any,
    config: AxiosRequestConfig = {},
    data?: any
  ) {
    // Aplicar proxy se configurado
    const proxyConfig = await getProxyConfigFromAccount(account.id, account.tenant_id);
    if (proxyConfig) {
      console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Conta: ${account.name}`);
      config = applyProxyToRequest(config, proxyConfig, account.name);
    }
    
    if (method === 'get') {
      return axios.get(url, config);
    } else if (method === 'post') {
      return axios.post(url, data, config);
    } else if (method === 'put') {
      return axios.put(url, data, config);
    } else {
      return axios.delete(url, config);
    }
  }
  /**
   * GET /api/whatsapp-accounts/:id/profile
   * Buscar perfil do negócio
   */
  async getBusinessProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // ✅ Extrair tenantId do request (injetado pelo middleware de autenticação)
      // @ts-ignore
      const tenantId = req.tenant?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      console.log(`📋 Buscando perfil da conta WhatsApp ID: ${id} - Tenant: ${tenantId}`);

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      // Buscar perfil via WhatsApp API (com proxy se configurado)
      let requestConfig: AxiosRequestConfig = {
        params: {
          fields: 'about,address,description,email,profile_picture_url,websites,vertical,messaging_product'
        },
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      };

      // Aplicar proxy se configurado
      const proxyConfig = await getProxyConfigFromAccount(id, tenantId);
      if (proxyConfig) {
        console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Conta: ${account.name}`);
        requestConfig = applyProxyToRequest(requestConfig, proxyConfig, account.name);
      } else {
        console.log(`📡 Requisição SEM proxy - Conta: ${account.name}`);
      }

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
        requestConfig
      );

      // Atualizar profile_picture_url e display_name no banco de dados
      if (response.data.data && response.data.data.length > 0) {
        const profileData = response.data.data[0];
        const displayName = profileData.verified_name || account.name;
        const profilePictureUrl = profileData.profile_picture_url || null;

        try {
          await tenantQuery(req,
            'UPDATE whatsapp_accounts SET profile_picture_url = $1, display_name = $2, updated_at = NOW() WHERE id = $3',
            [profilePictureUrl, displayName, id]
          );
          console.log('✅ Foto de perfil e display_name salvos no banco de dados');
        } catch (dbError) {
          console.error('❌ Erro ao salvar profile_picture_url no banco:', dbError);
        }
      }

      // Buscar o nome verificado da conta (verified_name)
      let verifiedName = account.name;
      
      try {
        let verifiedNameConfig: AxiosRequestConfig = {
          params: { 
            fields: 'verified_name,display_phone_number' 
          },
          headers: { 'Authorization': `Bearer ${account.access_token}` }
        };

        // Aplicar proxy se configurado
        const proxyConfigVerified = await getProxyConfigFromAccount(id, tenantId);
        if (proxyConfigVerified) {
          console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigVerified)} - Buscar verified_name`);
          verifiedNameConfig = applyProxyToRequest(verifiedNameConfig, proxyConfigVerified, account.name);
        }

        const accountInfo = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          verifiedNameConfig
        );
        
        if (accountInfo.data.verified_name) {
          verifiedName = accountInfo.data.verified_name;
        }
      } catch (err: any) {
        console.log('Não foi possível buscar verified_name da conta');
      }

      const profileData = response.data.data[0] || {};
      profileData.verified_name = verifiedName;
      profileData.display_phone_number = account.phone_number;

      res.json({ success: true, data: profileData });
    } catch (error: any) {
      console.error('Erro ao buscar perfil:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/profile
   * Atualizar perfil do negócio
   */
  async updateBusinessProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const profileData = req.body;

      console.log('📝 Atualizando perfil da conta:', id);
      console.log('📦 Dados recebidos:', JSON.stringify(profileData, null, 2));

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      // Separar display_name do resto do profileData
      const { display_name, verified_name, display_phone_number, ...restProfileData } = profileData;

      // Preparar dados para envio
      const dataToSend: any = {
        messaging_product: 'whatsapp',
        ...restProfileData
      };

      console.log('📤 Enviando para API:', JSON.stringify(dataToSend, null, 2));

      // Atualizar perfil via WhatsApp API (com proxy se configurado)
      const response = await this.makeProxyRequest(
        'post',
        `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
        account,
        {
          headers: {
            'Authorization': `Bearer ${account.access_token}`,
            'Content-Type': 'application/json'
          }
        },
        dataToSend
      );

      console.log('✅ Resposta da API:', JSON.stringify(response.data, null, 2));

      // Se o usuário tentou mudar o display_name, avisar sobre a limitação
      if (display_name && display_name !== verified_name) {
        console.log('⚠️ Usuário tentou alterar display_name:', display_name);
        console.log('   Mas a API do WhatsApp não suporta essa alteração via API');
        
        return res.json({ 
          success: true, 
          data: response.data,
          warning: 'Os outros campos foram atualizados, mas o Nome de Exibição não pode ser alterado via API. Use o WhatsApp Business Manager para alterar o nome.'
        });
      }

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar perfil:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/test-profile-photo-upload
   * TESTE EXPERIMENTAL: Tentar TODAS as abordagens possíveis para upload de foto
   */
  async testProfilePhotoUpload(req: Request, res: Response) {
    try {
      const { id } = req.params;

      console.log('🧪 INICIANDO TESTES EXPERIMENTAIS DE UPLOAD DE FOTO');

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }

      // Analisar a imagem usando sharp
      const sharp = require('sharp');
      const imageMetadata = await sharp(req.file.path).metadata();
      
      console.log('📸 INFORMAÇÕES DA IMAGEM:');
      console.log('   Formato:', imageMetadata.format);
      console.log('   Largura:', imageMetadata.width);
      console.log('   Altura:', imageMetadata.height);
      console.log('   Tamanho arquivo:', req.file.size, 'bytes');
      console.log('   Espaço de cor:', imageMetadata.space);
      console.log('   Tem alpha:', imageMetadata.hasAlpha);

      // Validações específicas
      const validations: any[] = [];

      if (!['jpeg', 'jpg', 'png'].includes(imageMetadata.format)) {
        validations.push({ check: 'Formato', status: '❌ FALHOU', value: imageMetadata.format, expected: 'jpeg/png' });
      } else {
        validations.push({ check: 'Formato', status: '✅ OK', value: imageMetadata.format });
      }

      if (imageMetadata.width !== 640 || imageMetadata.height !== 640) {
        validations.push({ check: 'Dimensões', status: '⚠️ NÃO IDEAL', value: `${imageMetadata.width}x${imageMetadata.height}`, expected: '640x640' });
      } else {
        validations.push({ check: 'Dimensões', status: '✅ OK', value: '640x640' });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        validations.push({ check: 'Tamanho', status: '❌ MUITO GRANDE', value: req.file.size, max: '5MB' });
      } else if (req.file.size < 10 * 1024) {
        validations.push({ check: 'Tamanho', status: '❌ MUITO PEQUENO', value: req.file.size, min: '10KB' });
      } else {
        validations.push({ check: 'Tamanho', status: '✅ OK', value: `${(req.file.size / 1024).toFixed(0)}KB` });
      }

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];
      
      // Verificar permissões da conta
      console.log('🔐 VERIFICANDO PERMISSÕES DA CONTA...');
      try {
        const accountInfo = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          {
            params: { fields: 'id,verified_name,code_verification_status,quality_rating,messaging_limit_tier' },
            headers: { 'Authorization': `Bearer ${account.access_token}` }
          }
        );
        
        console.log('📋 INFO DA CONTA:');
        console.log('   Nome verificado:', accountInfo.data.verified_name);
        console.log('   Status verificação:', accountInfo.data.code_verification_status);
        console.log('   Quality rating:', accountInfo.data.quality_rating);
        console.log('   Tier:', accountInfo.data.messaging_limit_tier);
        
        validations.push({ check: 'Conta verificada', status: '✅ OK', value: accountInfo.data.verified_name });
      } catch (error: any) {
        validations.push({ check: 'Conta verificada', status: '❌ ERRO', error: error.response?.data });
      }

      // SE a imagem não for 640x640, vamos converter
      let testImagePath = req.file.path;
      
      if (imageMetadata.width !== 640 || imageMetadata.height !== 640) {
        console.log('🔄 Convertendo imagem para 640x640...');
        const convertedPath = req.file.path.replace(/\.[^.]+$/, '_640x640.jpg');
        
        await sharp(req.file.path)
          .resize(640, 640, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 90 })
          .toFile(convertedPath);
        
        testImagePath = convertedPath;
        console.log('✅ Imagem convertida!');
        validations.push({ check: 'Conversão para 640x640', status: '✅ FEITO', path: convertedPath });
      }

      const testResults: any[] = [];

      // TESTE 1: Método profile_picture_handle (documentado mas não funciona)
      console.log('\n🧪 TESTE 1: Usando profile_picture_handle');
      try {
        const formData1 = new FormData();
        const fileStream1 = fs.createReadStream(testImagePath);
        formData1.append('messaging_product', 'whatsapp');
        formData1.append('file', fileStream1, {
          filename: `profile.jpg`,
          contentType: 'image/jpeg'
        });

        const uploadResponse1 = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/media`,
          formData1,
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              ...formData1.getHeaders()
            },
            timeout: 15000
          }
        );

        const mediaId = uploadResponse1.data.id;

        const applyResponse1 = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            messaging_product: 'whatsapp',
            profile_picture_handle: mediaId
          },
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testResults.push({
          test: 'TESTE 1: profile_picture_handle',
          status: 'SUCCESS ✅',
          response: applyResponse1.data
        });
      } catch (error: any) {
        testResults.push({
          test: 'TESTE 1: profile_picture_handle',
          status: 'FAILED ❌',
          error: error.response?.data || error.message
        });
      }

      // TESTE 2: Método com API v19.0 (versão mais recente)
      console.log('\n🧪 TESTE 2: Usando API v19.0');
      try {
        const formData2 = new FormData();
        const fileStream2 = fs.createReadStream(req.file.path);
        formData2.append('messaging_product', 'whatsapp');
        formData2.append('file', fileStream2, {
          filename: `profile.${req.file.mimetype.split('/')[1]}`,
          contentType: req.file.mimetype
        });

        const uploadResponse2 = await axios.post(
          `https://graph.facebook.com/v19.0/${account.phone_number_id}/media`,
          formData2,
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              ...formData2.getHeaders()
            }
          }
        );

        const applyResponse2 = await axios.post(
          `https://graph.facebook.com/v19.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            messaging_product: 'whatsapp',
            profile_picture_handle: uploadResponse2.data.id
          },
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testResults.push({
          test: 'TESTE 2: API v19.0',
          status: 'SUCCESS ✅',
          response: applyResponse2.data
        });
      } catch (error: any) {
        testResults.push({
          test: 'TESTE 2: API v19.0',
          status: 'FAILED ❌',
          error: error.response?.data || error.message
        });
      }

      // TESTE 3: Método com profile_picture (sem _handle)
      console.log('\n🧪 TESTE 3: Usando profile_picture (sem handle)');
      try {
        const formData3 = new FormData();
        const fileStream3 = fs.createReadStream(req.file.path);
        formData3.append('messaging_product', 'whatsapp');
        formData3.append('file', fileStream3);

        const uploadResponse3 = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/media`,
          formData3,
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              ...formData3.getHeaders()
            }
          }
        );

        const applyResponse3 = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            messaging_product: 'whatsapp',
            profile_picture: uploadResponse3.data.id
          },
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testResults.push({
          test: 'TESTE 3: profile_picture (sem handle)',
          status: 'SUCCESS ✅',
          response: applyResponse3.data
        });
      } catch (error: any) {
        testResults.push({
          test: 'TESTE 3: profile_picture (sem handle)',
          status: 'FAILED ❌',
          error: error.response?.data || error.message
        });
      }

      // TESTE 4: Upload direto com multipart
      console.log('\n🧪 TESTE 4: Upload direto via multipart');
      try {
        const formData4 = new FormData();
        const fileStream4 = fs.createReadStream(req.file.path);
        formData4.append('messaging_product', 'whatsapp');
        formData4.append('profile_picture', fileStream4, {
          filename: 'profile.jpg',
          contentType: req.file.mimetype
        });

        const directResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          formData4,
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              ...formData4.getHeaders()
            }
          }
        );

        testResults.push({
          test: 'TESTE 4: Upload direto multipart',
          status: 'SUCCESS ✅',
          response: directResponse.data
        });
      } catch (error: any) {
        testResults.push({
          test: 'TESTE 4: Upload direto multipart',
          status: 'FAILED ❌',
          error: error.response?.data || error.message
        });
      }

      // TESTE 5: Com URL de imagem hospedada (simulação)
      console.log('\n🧪 TESTE 5: Usando URL de imagem');
      try {
        const applyResponse5 = await axios.post(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            messaging_product: 'whatsapp',
            profile_picture_url: 'https://via.placeholder.com/640x640.png'
          },
          {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testResults.push({
          test: 'TESTE 5: URL de imagem',
          status: 'SUCCESS ✅',
          response: applyResponse5.data
        });
      } catch (error: any) {
        testResults.push({
          test: 'TESTE 5: URL de imagem',
          status: 'FAILED ❌',
          error: error.response?.data || error.message
        });
      }

      // Limpar arquivos temporários
      fs.unlinkSync(req.file.path);
      if (testImagePath !== req.file.path && fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }

      console.log('\n📊 RESULTADO DOS TESTES:');
      console.log(JSON.stringify(testResults, null, 2));

      const successCount = testResults.filter(t => t.status.includes('SUCCESS')).length;

      res.json({
        success: true,
        image_analysis: {
          original: {
            format: imageMetadata.format,
            dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
            size_kb: Math.round(req.file.size / 1024),
            has_alpha: imageMetadata.hasAlpha
          },
          validations: validations
        },
        summary: {
          total_tests: testResults.length,
          successful: successCount,
          failed: testResults.length - successCount
        },
        results: testResults,
        conclusion: successCount > 0 
          ? '✅ ENCONTRADO MÉTODO QUE FUNCIONA!' 
          : '❌ NENHUM MÉTODO FUNCIONOU - Confirmada limitação da API oficial'
      });
    } catch (error: any) {
      console.error('Erro nos testes:', error);
      
      // Limpar arquivo
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/test-permissions
   * Testar permissões e token da conta
   */
  async testPermissions(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];
      const diagnostics: any = {
        account_name: account.name,
        phone_number: account.phone_number,
        tests: []
      };

      // Teste 1: Verificar se o token é válido
      try {
        const tokenTest = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
          {
            params: { fields: 'id,verified_name,code_verification_status,quality_rating' },
            headers: { 'Authorization': `Bearer ${account.access_token}` }
          }
        );
        diagnostics.tests.push({
          test: 'Token válido',
          status: 'success',
          data: tokenTest.data
        });
      } catch (error: any) {
        diagnostics.tests.push({
          test: 'Token válido',
          status: 'failed',
          error: error.response?.data || error.message
        });
      }

      // Teste 2: Buscar perfil atual
      try {
        const profileTest = await axios.get(
          `https://graph.facebook.com/v18.0/${account.phone_number_id}/whatsapp_business_profile`,
          {
            params: { fields: 'about,profile_picture_url' },
            headers: { 'Authorization': `Bearer ${account.access_token}` }
          }
        );
        diagnostics.tests.push({
          test: 'Buscar perfil',
          status: 'success',
          data: profileTest.data
        });
      } catch (error: any) {
        diagnostics.tests.push({
          test: 'Buscar perfil',
          status: 'failed',
          error: error.response?.data || error.message
        });
      }

      res.json({ success: true, diagnostics });
    } catch (error: any) {
      console.error('Erro no diagnóstico:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/profile-photo
   * Upload de foto de perfil
   */
  async uploadProfilePhoto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // ✅ Extrair tenantId do request (injetado pelo middleware de autenticação)
      // @ts-ignore
      const tenantId = req.tenant?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      console.log('🔍 Recebida requisição de upload de foto para conta:', id);
      console.log('📁 Arquivo recebido:', req.file);

      if (!req.file) {
        console.error('❌ Nenhum arquivo foi recebido no req.file');
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      }

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        console.error('❌ Conta não encontrada:', id);
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];
      console.log('✅ Conta encontrada:', account.name);

      console.log('📤 Preparando upload de foto:', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Validar tipo de arquivo (apenas imagens)
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          error: 'Formato não suportado. Use apenas JPG ou PNG' 
        });
      }

      // Verificar tamanho do arquivo (máx 5MB para fotos de perfil)
      if (req.file.size > 5 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          error: 'Arquivo muito grande. Máximo: 5MB' 
        });
      }

      // Verificar tamanho mínimo (pelo menos 10KB)
      if (req.file.size < 10 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          error: 'Arquivo muito pequeno. A imagem deve ter pelo menos 10KB' 
        });
      }

      // 1. Upload da mídia para WhatsApp
      const formData = new FormData();
      
      // Criar stream do arquivo
      const fileStream = fs.createReadStream(req.file.path);
      
      // Usar nome de arquivo simples sem caracteres especiais
      const cleanFilename = `profile-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
      
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', fileStream, {
        filename: cleanFilename,
        contentType: req.file.mimetype,
        knownLength: req.file.size
      });

      console.log('🌐 Enviando para WhatsApp API...');
      console.log('Phone Number ID:', account.phone_number_id);
      console.log('Clean filename:', cleanFilename);
      console.log('URL:', `https://graph.facebook.com/v18.0/${account.phone_number_id}/media`);

      try {
        let uploadConfig: AxiosRequestConfig = {
          method: 'post',
          url: `https://graph.facebook.com/v18.0/${account.phone_number_id}/media`,
          data: formData,
          headers: {
            'Authorization': `Bearer ${account.access_token}`,
            ...formData.getHeaders()
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 30000 // 30 segundos de timeout
        };

        // Aplicar proxy se configurado
        const proxyConfigUpload = await getProxyConfigFromAccount(id, tenantId);
        if (proxyConfigUpload) {
          console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigUpload)} - Upload foto perfil`);
          uploadConfig = applyProxyToRequest(uploadConfig, proxyConfigUpload, account.name);
        }

        const uploadResponse = await axios(uploadConfig);

        console.log('✅ Upload de mídia bem-sucedido!');
        console.log('Media ID:', uploadResponse.data.id);

        const mediaId = uploadResponse.data.id;

        if (!mediaId) {
          throw new Error('Media ID não retornado pela API do WhatsApp');
        }

        // 2. Tentar aplicar usando diferentes métodos
        console.log('🖼️ Tentando aplicar foto de perfil...');
        
        // LIMITAÇÃO DA API: A WhatsApp Cloud API tem restrições para alterar foto de perfil
        // O endpoint existe mas frequentemente retorna erro 131009/2494102
        // Isto é uma limitação conhecida da API oficial
        
        fs.unlinkSync(req.file.path);
        
        return res.status(400).json({
          success: false,
          error: '⚠️ LIMITAÇÃO DA API DO WHATSAPP\n\n' +
            'A WhatsApp Business Cloud API não permite alterar a foto de perfil via programação.\n' +
            'Este é um erro conhecido (código 131009/2494102) da API oficial.\n\n' +
            '📱 COMO ALTERAR A FOTO DE PERFIL:\n\n' +
            '1️⃣ WhatsApp Business Manager (Recomendado):\n' +
            '   • Acesse: business.facebook.com/wa/manage\n' +
            '   • Selecione sua conta WhatsApp\n' +
            '   • Vá em "Perfil do WhatsApp Business"\n' +
            '   • Faça upload da foto\n\n' +
            '2️⃣ Aplicativo WhatsApp Business (Celular):\n' +
            '   • Abra o app WhatsApp Business\n' +
            '   • Configurações > Perfil da empresa\n' +
            '   • Toque na foto para alterar\n\n' +
            'Esta é uma limitação da Meta/WhatsApp, não do nosso sistema. 😔',
          media_id: mediaId,
          alternative_methods: [
            {
              method: 'WhatsApp Business Manager',
              url: 'https://business.facebook.com/wa/manage/home/',
              priority: 'Recomendado',
              steps: [
                'Acesse o link acima',
                'Faça login com sua conta Meta',
                'Selecione sua conta WhatsApp Business',
                'Vá em "Perfil do WhatsApp Business"',
                'Faça upload da foto'
              ]
            },
            {
              method: 'App WhatsApp Business (Celular)',
              priority: 'Alternativa',
              steps: [
                'Abra o app WhatsApp Business no celular',
                'Vá em Configurações (⋮)',
                'Toque em "Perfil da empresa"',
                'Toque na foto de perfil',
                'Selecione "Galeria" ou "Câmera"',
                'Escolha a nova foto'
              ]
            }
          ]
        });
      } catch (uploadError: any) {
        console.error('❌ ERRO NO UPLOAD PARA WHATSAPP:');
        console.error('Status:', uploadError.response?.status);
        console.error('Status Text:', uploadError.response?.statusText);
        console.error('Erro da API:', JSON.stringify(uploadError.response?.data, null, 2));
        
        // Limpar arquivo em caso de erro
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        throw uploadError;
      }
    } catch (error: any) {
      console.error('❌ ERRO AO FAZER UPLOAD DA FOTO:');
      console.error('Mensagem:', error.message);
      console.error('Response data:', error.response?.data);
      console.error('Status:', error.response?.status);
      console.error('Stack:', error.stack);
      
      // Limpar arquivo temporário em caso de erro
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Mensagens de erro mais específicas
      let errorMessage = error.response?.data?.error?.message || error.message;
      
      // Se for erro de parâmetro inválido, dar mais detalhes
      if (errorMessage.includes('Parameter value is not valid') || errorMessage.includes('parameter')) {
        errorMessage = 'Não foi possível atualizar a foto. Verifique:\n' +
          '• A imagem deve ser JPG ou PNG\n' +
          '• Tamanho: entre 10KB e 5MB\n' +
          '• Dimensões recomendadas: 640x640 pixels\n' +
          '• Sua conta WhatsApp Business deve estar verificada';
      } else if (errorMessage.includes('access token') || errorMessage.includes('token')) {
        errorMessage = 'Token de acesso inválido ou expirado. Reconecte sua conta WhatsApp.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('insufficient')) {
        errorMessage = 'Sua conta não tem permissão para alterar a foto de perfil. Verifique as permissões no Facebook Business.';
      }

      res.status(500).json({ 
        success: false, 
        error: errorMessage
      });
    }
  }

  /**
   * Garante colunas de status do PIN 2FA na conta.
   */
  private async ensureTwoStepPinColumns() {
    const { pool } = require('../database/connection');
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS two_step_pin VARCHAR(6)`).catch(() => undefined);
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS two_step_pin_set_at TIMESTAMPTZ`).catch(() => undefined);
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS two_step_pin_last_action VARCHAR(20)`).catch(() => undefined);
    await pool.query(`ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS cloud_api_registered_at TIMESTAMPTZ`).catch(() => undefined);
  }

  /**
   * POST /api/whatsapp-accounts/:id/two-step-pin
   * Registrar PIN novo, alterar PIN e/ou registrar o número na Cloud API.
   * body: { pin, action?: 'set' | 'change' | 'register', also_register?: boolean }
   * - set/change: POST /{phone_number_id} { pin } (API Meta Two-Step Verification)
   * - register: também POST /{phone_number_id}/register { messaging_product, pin }
   */
  async setTwoStepPin(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pin = String(req.body?.pin || '').trim();
      const actionRaw = String(req.body?.action || 'set').toLowerCase();
      const action = ['set', 'change', 'register'].includes(actionRaw) ? actionRaw : 'set';
      const alsoRegister =
        action === 'register' ||
        req.body?.also_register === true ||
        req.body?.also_register === 'true' ||
        req.body?.register === true;

      // @ts-ignore
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({
          success: false,
          error: 'PIN deve ter exatamente 6 dígitos numéricos',
        });
      }

      await this.ensureTwoStepPinColumns();

      const accountResult = await tenantQuery(
        req,
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];
      if (!account.phone_number_id || !account.access_token) {
        return res.status(400).json({
          success: false,
          error: 'Conta sem Phone Number ID ou token de acesso',
        });
      }

      const headers = {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      };

      const steps: Array<{ step: string; success: boolean; data?: any; error?: string }> = [];

      // 1) Definir ou alterar o PIN na Meta (mesmo endpoint para novo e alteração)
      try {
        console.log(`🔐 PIN (${action}) na Meta — conta ${account.name} (${account.phone_number_id})`);
        const pinResponse = await this.makeProxyRequest(
          'post',
          `https://graph.facebook.com/v21.0/${encodeURIComponent(account.phone_number_id)}`,
          account,
          { headers, timeout: 30000 },
          { pin }
        );
        const pinOk = pinResponse.data?.success === true || pinResponse.status < 300;
        steps.push({ step: action === 'change' ? 'change_pin' : 'set_pin', success: pinOk, data: pinResponse.data });
        if (!pinOk) {
          return res.status(400).json({
            success: false,
            error: 'A Meta não confirmou o PIN (success != true).',
            steps,
          });
        }
      } catch (error: any) {
        const fb = error?.response?.data?.error;
        const msg = String(fb?.message || error?.message || 'Falha ao gravar PIN na Meta');
        console.error('❌ setTwoStepPin (PIN):', fb || error?.message);
        steps.push({ step: action === 'change' ? 'change_pin' : 'set_pin', success: false, error: msg });
        return res.status(error?.response?.status || 500).json({
          success: false,
          error: msg,
          error_code: fb?.code,
          error_subcode: fb?.error_subcode,
          steps,
        });
      }

      // 2) Registrar o número na Cloud API com o mesmo PIN (garante que o PIN “entra” de verdade)
      let registered = false;
      if (alsoRegister) {
        try {
          console.log(`📱 Register Cloud API com PIN — conta ${account.name}`);
          const regResponse = await this.makeProxyRequest(
            'post',
            `https://graph.facebook.com/v21.0/${encodeURIComponent(account.phone_number_id)}/register`,
            account,
            { headers, timeout: 30000 },
            { messaging_product: 'whatsapp', pin }
          );
          registered =
            regResponse.data?.success === true ||
            String(regResponse.data?.account_mode || '').length > 0 ||
            regResponse.status < 300;
          steps.push({ step: 'register', success: registered, data: regResponse.data });
        } catch (error: any) {
          const fb = error?.response?.data?.error;
          const msg = String(fb?.message || error?.message || 'Falha ao registrar número');
          const code = Number(fb?.code || 0);
          // Já registrado / sem mudança — não trata como falha fatal se o PIN já foi gravado
          const already =
            code === 100 ||
            /already|registered|exist/i.test(msg);
          steps.push({
            step: 'register',
            success: already,
            error: already ? undefined : msg,
            data: already ? { already: true, message: msg } : fb,
          });
          if (!already) {
            await tenantQuery(
              req,
              `UPDATE whatsapp_accounts
               SET two_step_pin = $1,
                   two_step_pin_set_at = NOW(),
                   two_step_pin_last_action = $2,
                   updated_at = NOW()
               WHERE id = $3 AND tenant_id = $4`,
              [pin, action === 'change' ? 'change' : 'set', id, tenantId]
            ).catch(() => undefined);

            return res.status(error?.response?.status || 500).json({
              success: false,
              error: `PIN gravado na Meta, mas o registro Cloud API falhou: ${msg}`,
              error_code: fb?.code,
              pin_saved: true,
              steps,
            });
          }
          registered = true;
        }
      }

      await tenantQuery(
        req,
        `UPDATE whatsapp_accounts
         SET two_step_pin = $1,
             two_step_pin_set_at = NOW(),
             two_step_pin_last_action = $2,
             cloud_api_registered_at = CASE WHEN $3::boolean THEN NOW() ELSE cloud_api_registered_at END,
             updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [
          pin,
          alsoRegister ? 'register' : action === 'change' ? 'change' : 'set',
          alsoRegister && registered,
          id,
          tenantId,
        ]
      );

      const label =
        alsoRegister
          ? 'PIN definido e número registrado na Cloud API.'
          : action === 'change'
            ? 'PIN alterado com sucesso na Meta.'
            : 'PIN registrado com sucesso na Meta.';

      return res.json({
        success: true,
        message: label,
        data: {
          action: alsoRegister ? 'register' : action,
          pin_set: true,
          registered: alsoRegister ? registered : undefined,
          steps,
        },
      });
    } catch (error: any) {
      console.error('Erro ao configurar PIN:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: error.response?.data?.error?.message || error.message,
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/analytics
   * Buscar analytics da conta (conversas, mensagens, etc)
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { period, granularity = 'DAY' } = req.query;
      let { start_date, end_date } = req.query;

      console.log('📊 Analytics - Parâmetros recebidos:', { id, start_date, end_date, period, granularity });

      // Se `period` for fornecido, calcular start_date e end_date
      if (period && !start_date && !end_date) {
        const days = parseInt(period as string);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        start_date = startDate.toISOString().split('T')[0];
        end_date = endDate.toISOString().split('T')[0];
        
        console.log('📅 Datas calculadas:', { start_date, end_date, days });
      }

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];
      console.log('✅ Conta encontrada:', account.name);

      // Buscar analytics via WhatsApp API
      const params: any = {
        fields: 'conversation_analytics',
        granularity: granularity
      };

      if (start_date) params.start = start_date;
      if (end_date) params.end = end_date;

      console.log('🌐 Chamando API WhatsApp com params:', params);

      // Buscar analytics via WhatsApp API (com proxy se configurado)
      const response = await this.makeProxyRequest(
        'get',
        `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
        account,
        {
          params,
          headers: {
            'Authorization': `Bearer ${account.access_token}`
          }
        }
      );

      console.log('✅ Analytics recebido da API');
      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('❌ Erro ao buscar analytics:', {
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status
      });
      
      // Retornar dados mockados em vez de erro 500 para não quebrar a página
      const queryPeriod = req.query.period as string | undefined;
      const queryEndDate = req.query.end_date as string | undefined;
      const queryStartDate = req.query.start_date as string | undefined;
      
      const days = queryPeriod ? parseInt(queryPeriod) : 30;
      const endDate = queryEndDate || new Date().toISOString().split('T')[0];
      const startDate = queryStartDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      res.json({ 
        success: true, 
        data: {
          start_date: startDate,
          end_date: endDate,
          period: days,
          summary: {
            total_messages: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
            delivery_rate: '0.00',
            read_rate: '0.00',
            failure_rate: '0.00'
          },
          charts: {
            messages_by_day: [],
            messages_by_hour: []
          },
          costs: {
            total: '0.00',
            daily_average: '0.00',
            monthly_projection: '0.00',
            by_type: [],
            currency: 'BRL'
          },
          top_contacts: [],
          active_campaigns: 0
        },
        warning: 'Não foi possível carregar analytics da API do WhatsApp. Dados indisponíveis no momento.'
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/qrcode
   * Gerar QR Code da conta
   */
  async getQRCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { format = 'png' } = req.query;

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      // Gerar QR Code via WhatsApp API (com proxy se configurado)
      const response = await this.makeProxyRequest(
        'post',
        `https://graph.facebook.com/v18.0/${account.phone_number_id}/message_qrdls`,
        account,
        {
          headers: {
            'Authorization': `Bearer ${account.access_token}`,
            'Content-Type': 'application/json'
          }
        },
        {
          prefilled_message: '',
          generate_qr_image: format
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Erro ao gerar QR Code:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/health
   * Verificar saúde da conta
   */
  async checkHealth(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      // Buscar informações da conta via WhatsApp API (com proxy se configurado)
      const response = await this.makeProxyRequest(
        'get',
        `https://graph.facebook.com/v18.0/${account.phone_number_id}`,
        account,
        {
          params: {
            fields: 'account_mode,quality_rating,messaging_limit_tier,is_official_business_account,verified_name'
          },
          headers: {
            'Authorization': `Bearer ${account.access_token}`
          }
        }
      );

      const healthData = {
        status: 'healthy',
        ...response.data,
        last_check: new Date()
      };

      res.json({ success: true, data: healthData });
    } catch (error: any) {
      console.error('Erro ao verificar saúde da conta:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message,
        status: 'unhealthy'
      });
    }
  }

  /**
   * POST /api/whatsapp-accounts/:id/facebook-integration
   * Configurar integração com Facebook Business
   */
  async configureFacebookIntegration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { facebook_access_token, ad_account_id, business_id } = req.body;

      if (!facebook_access_token) {
        return res.status(400).json({ 
          success: false, 
          error: 'Facebook Access Token é obrigatório' 
        });
      }

      // Validar token do Facebook
      try {
        await axios.get(
          `https://graph.facebook.com/v18.0/me`,
          {
            headers: {
              'Authorization': `Bearer ${facebook_access_token}`
            }
          }
        );
      } catch (error) {
        return res.status(400).json({ 
          success: false, 
          error: 'Token do Facebook inválido' 
        });
      }

      // Atualizar no banco (criptografado)
      const crypto = require('crypto');
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-minimum!!', 'utf-8').slice(0, 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(facebook_access_token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedToken = iv.toString('hex') + ':' + encrypted;

      await tenantQuery(req, 
        `UPDATE whatsapp_accounts 
         SET facebook_access_token = $1, 
             facebook_ad_account_id = $2, 
             facebook_business_id = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [encryptedToken, ad_account_id, business_id, id]
      );

      res.json({ 
        success: true, 
        message: 'Integração com Facebook configurada com sucesso' 
      });
    } catch (error: any) {
      console.error('Erro ao configurar integração:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * GET /api/whatsapp-accounts/:id/facebook-billing
   * Buscar informações de cobrança do Facebook
   */
  async getFacebookBilling(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query;

      // Buscar conta no banco
      const accountResult = await tenantQuery(req, 
        'SELECT id, name, facebook_access_token, facebook_ad_account_id FROM whatsapp_accounts WHERE id = $1',
        [id]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Conta não encontrada' });
      }

      const account = accountResult.rows[0];

      if (!account.facebook_access_token || !account.facebook_ad_account_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Integração com Facebook não configurada' 
        });
      }

      // Descriptografar token
      const crypto = require('crypto');
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-chars-minimum!!', 'utf-8').slice(0, 32);
      
      const parts = account.facebook_access_token.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      const facebookToken = decrypted;

      // Buscar insights do Facebook
      const params: any = {
        fields: 'spend,impressions,reach,frequency',
        level: 'account',
        time_increment: 1
      };

      if (start_date && end_date) {
        params.time_range = JSON.stringify({ since: start_date, until: end_date });
      } else {
        params.date_preset = 'this_month';
      }

      // Buscar billing do Facebook (com proxy se configurado)
      let billingConfig: AxiosRequestConfig = {
        params,
        headers: {
          'Authorization': `Bearer ${facebookToken}`
        }
      };

      const proxyConfigBilling = await getProxyConfigFromAccount(account.id, account.tenant_id);
      if (proxyConfigBilling) {
        console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigBilling)} - Buscar billing Facebook`);
        billingConfig = applyProxyToRequest(billingConfig, proxyConfigBilling, account.name);
      }

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${account.facebook_ad_account_id}/insights`,
        billingConfig
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Erro ao buscar billing do Facebook:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      });
    }
  }
}

export const whatsappSettingsController = new WhatsAppSettingsController();

