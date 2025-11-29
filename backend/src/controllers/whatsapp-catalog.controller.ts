import { Request, Response } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import { ProductModel } from '../models/product.model';
import { tenantQuery } from '../database/tenant-query';
import { getProxyConfigFromAccount, applyProxyToRequest, formatProxyInfo } from '../helpers/proxy.helper';

/**
 * Controller para integração do catálogo com WhatsApp Business
 */
export class WhatsAppCatalogController {
  /**
   * Sincronizar produto com WhatsApp Business Catalog
   */
  async syncProduct(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      const accountId = parseInt(req.params.accountId);
      
      const tenantIdCheck = (req as any).tenant?.id;
      if (!tenantIdCheck) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }

      // Buscar produto
      const product = await ProductModel.findById(productId, tenantIdCheck);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      // Buscar conta WhatsApp
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta WhatsApp não encontrada'
        });
      }

      const account = accountResult.rows[0];

      if (!account.business_account_id) {
        return res.status(400).json({
          success: false,
          error: 'Conta WhatsApp não tem Business Account ID configurado'
        });
      }

      // NOTA: Para WhatsApp Business Cloud API, o catálogo é gerenciado através do WABA
      // Endpoint correto: /{whatsapp-business-account-id}/product_catalogs
      
      console.log('🔍 Buscando catálogo associado ao WABA...');
      
      let catalogId = account.facebook_catalog_id;
      
      // Se não tiver catalog_id salvo, buscar via API
      if (!catalogId) {
        try {
          // Buscar catálogos do WABA (endpoint correto) - com proxy se configurado
          let catalogConfig: AxiosRequestConfig = {
            headers: {
              'Authorization': `Bearer ${account.access_token}`
            }
          };

          const proxyConfig = await getProxyConfigFromAccount(accountId, tenantIdCheck);
          if (proxyConfig) {
            console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfig)} - Buscar catálogo`);
            catalogConfig = applyProxyToRequest(catalogConfig, proxyConfig, account.name);
          }

          const catalogResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${account.business_account_id}/product_catalogs`,
            catalogConfig
          );
          
          console.log('📦 Resposta da API de catálogos:', JSON.stringify(catalogResponse.data, null, 2));
          
          if (catalogResponse.data.data && catalogResponse.data.data.length > 0) {
            catalogId = catalogResponse.data.data[0].id;
            console.log(`✅ Catalog ID encontrado: ${catalogId}`);
            
            // Salvar catalog_id na conta para uso futuro
            await tenantQuery(req, 
              'UPDATE whatsapp_accounts SET facebook_catalog_id = $1 WHERE id = $2',
              [catalogId, accountId]
            );
          } else {
            // Nenhum catálogo encontrado
            console.log('❌ Nenhum catálogo encontrado.');
            console.log('');
            console.log('📝 VOCÊ PRECISA CRIAR UM CATÁLOGO PRIMEIRO:');
            console.log('');
            console.log('1. Acesse: https://business.facebook.com/commerce');
            console.log('2. Clique em "Criar Catálogo"');
            console.log('3. Escolha "E-commerce" como tipo');
            console.log('4. Siga as instruções para criar');
            console.log('5. Depois, conecte ao seu WhatsApp Business');
            console.log('');
            console.log('Ou use este link direto:');
            console.log('https://business.facebook.com/commerce/catalogs/');
            console.log('');
            
            throw new Error('CATÁLOGO NÃO ENCONTRADO. Você precisa criar um catálogo no Facebook Commerce Manager primeiro. Acesse: https://business.facebook.com/commerce');
          }
        } catch (catalogError: any) {
          console.error('❌ Erro ao buscar/criar catálogo:');
          console.error('Status:', catalogError.response?.status);
          console.error('Dados:', JSON.stringify(catalogError.response?.data, null, 2));
          throw new Error(`Erro ao acessar catálogo: ${catalogError.response?.data?.error?.message || catalogError.message}`);
        }
      } else {
        console.log(`📦 Usando catalog_id salvo: ${catalogId}`);
      }

      // Preparar dados do produto para WhatsApp
      const productData: any = {
        name: product.name,
        description: product.description || '',
        price: Math.round(product.price * 100), // Converter para centavos
        currency: product.currency,
        availability: product.in_stock ? 'in stock' : 'out of stock',
        visibility: product.is_active ? 'published' : 'staging',
        retailer_id: product.sku || `product_${product.id}`
      };

      // Adicionar imagem se existir
      if (product.image_url) {
        productData.image_url = product.image_url;
      }

      // Adicionar URL se existir
      if (product.url) {
        productData.url = product.url;
      }

      // Criar/atualizar produto no catálogo do WhatsApp Business
      console.log('➕ Sincronizando produto com Commerce Manager...');
      
      // Endpoint correto para adicionar produtos ao catálogo
      const catalogProductsEndpoint = `https://graph.facebook.com/v18.0/${catalogId}/products`;
      
      try {
        // Primeiro, verificar se o produto já existe (e se o ID não é local/fake)
        if (product.facebook_product_id && !product.facebook_product_id.startsWith('local_')) {
          console.log(`🔄 Atualizando produto ${product.facebook_product_id}...`);
          
          // Atualizar produto existente - com proxy se configurado
          let updateConfig: AxiosRequestConfig = {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          };

          const proxyConfigUpdate = await getProxyConfigFromAccount(accountId, tenantIdCheck);
          if (proxyConfigUpdate) {
            console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigUpdate)} - Atualizar produto`);
            updateConfig = applyProxyToRequest(updateConfig, proxyConfigUpdate, account.name);
          }

          await axios.post(
            `https://graph.facebook.com/v18.0/${product.facebook_product_id}`,
            productData,
            updateConfig
          );
          
          console.log('✅ Produto atualizado no catálogo');
        } else {
          // Criar novo produto no catálogo - com proxy se configurado
          console.log(`📤 Criando produto no catálogo ${catalogId}...`);

          let createConfig: AxiosRequestConfig = {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            }
          };

          const proxyConfigCreate = await getProxyConfigFromAccount(accountId, tenantIdCheck);
          if (proxyConfigCreate) {
            console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigCreate)} - Criar produto`);
            createConfig = applyProxyToRequest(createConfig, proxyConfigCreate, account.name);
          }

          const response = await axios.post(
            catalogProductsEndpoint,
            productData,
            createConfig
          );

          const facebookProductId = response.data.id;
          
          // Salvar ID do produto
          await tenantQuery(req, 
            'UPDATE products SET facebook_product_id = $1, synced_at = CURRENT_TIMESTAMP, sync_status = $2 WHERE id = $3',
            [facebookProductId, 'synced', productId]
          );

          console.log(`✅ Produto criado no catálogo: ${facebookProductId}`);
        }
      } catch (catalogError: any) {
        // Logar erro detalhado
        console.error('❌ ERRO NA API DO WHATSAPP CATALOG:');
        console.error('Status:', catalogError.response?.status);
        console.error('Mensagem:', catalogError.response?.data?.error?.message);
        console.error('Detalhes completos:', JSON.stringify(catalogError.response?.data, null, 2));
        console.error('URL tentada:', catalogProductsEndpoint);
        console.error('Dados enviados:', JSON.stringify(productData, null, 2));
        
        // Se for erro de autenticação ou configuração, não marcar como sincronizado
        if (catalogError.response?.status === 401 || catalogError.response?.status === 403) {
          throw new Error(`Erro de autenticação: ${catalogError.response?.data?.error?.message || 'Access token inválido'}`);
        }
        
        // Se for erro de parâmetro, também não marcar como sincronizado
        if (catalogError.response?.status === 400) {
          throw new Error(`Erro de parâmetro: ${catalogError.response?.data?.error?.message || 'Parâmetros inválidos'}`);
        }
        
        // Para outros erros, marcar como erro de sincronização
        await tenantQuery(req, 
          'UPDATE products SET sync_status = $1 WHERE id = $2',
          ['error', productId]
        );
        
        throw new Error(`Falha ao sincronizar: ${catalogError.response?.data?.error?.message || catalogError.message}`);
      }

      const tenantIdUpdate = (req as any).tenant?.id;
      if (!tenantIdUpdate) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      // Buscar produto atualizado
      const updatedProduct = await ProductModel.findById(productId, tenantIdUpdate);

      res.json({
        success: true,
        message: 'Produto sincronizado com WhatsApp Business Catalog com sucesso',
        data: {
          product_id: productId,
          facebook_product_id: updatedProduct?.facebook_product_id,
          catalog_id: catalogId
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao sincronizar produto:', error);
      
      // Erros específicos do Facebook
      if (error.response?.data?.error) {
        const fbError = error.response.data.error;
        return res.status(400).json({
          success: false,
          error: `Erro do Facebook: ${fbError.message}`,
          details: fbError
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sincronizar todos os produtos de uma conta
   */
  async syncAllProducts(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      // Buscar todos os produtos ativos da conta
      const products = await ProductModel.findByAccount(accountId, {
        is_active: true
      });

      const results = {
        total: products.length,
        synced: 0,
        failed: 0,
        errors: [] as any[]
      };

      // Sincronizar cada produto
      for (const product of products) {
        try {
          // Simular requisição para syncProduct
          const mockReq: any = {
            params: {
              productId: product.id,
              accountId: accountId
            }
          };

          const mockRes: any = {
            status: (code: number) => mockRes,
            json: (data: any) => {
              if (data.success) {
                results.synced++;
              } else {
                results.failed++;
                results.errors.push({
                  product_id: product.id,
                  product_name: product.name,
                  error: data.error
                });
              }
            }
          };

          await this.syncProduct(mockReq, mockRes);
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            product_id: product.id,
            product_name: product.name,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Sincronização concluída: ${results.synced} sucesso, ${results.failed} falhas`,
        results
      });

    } catch (error: any) {
      console.error('❌ Erro ao sincronizar produtos:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Remover produto do catálogo do WhatsApp
   */
  async unsyncProduct(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.productId);
      const accountId = parseInt(req.params.accountId);

      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      // Buscar produto
      const product = await ProductModel.findById(productId, tenantId);
      if (!product || !product.facebook_product_id) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado ou não sincronizado'
        });
      }

      // Buscar conta
      const accountResult = await tenantQuery(req, 
        'SELECT * FROM whatsapp_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conta WhatsApp não encontrada'
        });
      }

      const account = accountResult.rows[0];

      // Deletar produto do Facebook - com proxy se configurado
      let deleteConfig: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${account.access_token}`
        }
      };

      const proxyConfigDelete = await getProxyConfigFromAccount(accountId, tenantId);
      if (proxyConfigDelete) {
        console.log(`🌐 Aplicando proxy: ${formatProxyInfo(proxyConfigDelete)} - Deletar produto`);
        deleteConfig = applyProxyToRequest(deleteConfig, proxyConfigDelete, account.name);
      }

      await axios.delete(
        `https://graph.facebook.com/v18.0/${product.facebook_product_id}`,
        deleteConfig
      );

      // Remover ID do Facebook do produto
      await tenantQuery(req, 
        'UPDATE products SET facebook_product_id = NULL, synced_at = NULL WHERE id = $1',
        [productId]
      );

      res.json({
        success: true,
        message: 'Produto removido do WhatsApp com sucesso'
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover produto:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obter status de sincronização
   */
  async getSyncStatus(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);

      const result = await tenantQuery(req, 
        `SELECT 
          COUNT(*) as total_products,
          COUNT(facebook_product_id) as synced_products,
          COUNT(*) FILTER (WHERE is_active = true) as active_products,
          COUNT(*) FILTER (WHERE is_active = true AND facebook_product_id IS NOT NULL) as active_synced
         FROM products 
         WHERE whatsapp_account_id = $1`,
        [accountId]
      );

      const stats = result.rows[0];

      res.json({
        success: true,
        data: {
          total_products: parseInt(stats.total_products) || 0,
          synced_products: parseInt(stats.synced_products) || 0,
          active_products: parseInt(stats.active_products) || 0,
          active_synced: parseInt(stats.active_synced) || 0,
          pending_sync: parseInt(stats.active_products) - parseInt(stats.active_synced)
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const whatsappCatalogController = new WhatsAppCatalogController();

