import { Request, Response } from 'express';
import { ProductModel, CreateProductDTO, UpdateProductDTO } from '../models/product.model';

export class ProductController {
  /**
   * Criar novo produto
   */
  async create(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);
      const productData: CreateProductDTO = {
        whatsapp_account_id: accountId,
        ...req.body
      };

      // Validações
      if (!productData.name || productData.name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Nome do produto é obrigatório'
        });
      }

      if (!productData.price || productData.price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Preço deve ser maior que zero'
        });
      }

      const product = await ProductModel.create(productData);

      res.json({
        success: true,
        data: product,
        message: 'Produto criado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao criar produto:', error);
      
      // Erro de SKU duplicado
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'SKU já existe para esta conta'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Listar produtos
   */
  async list(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);
      
      const filters = {
        category: req.query.category as string,
        in_stock: req.query.in_stock === 'true' ? true : req.query.in_stock === 'false' ? false : undefined,
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
        search: req.query.search as string
      };

      const products = await ProductModel.findByAccount(accountId, filters);

      res.json({
        success: true,
        data: products,
        total: products.length
      });
    } catch (error: any) {
      console.error('Erro ao listar produtos:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Buscar produto por ID
   */
  async findById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const tenantId = (req as any).tenant?.id;
      
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      
      const product = await ProductModel.findById(id, tenantId);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      console.error('Erro ao buscar produto:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Atualizar produto
   */
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const updateData: UpdateProductDTO = req.body;

      // Validações
      if (updateData.price !== undefined && updateData.price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Preço deve ser maior que zero'
        });
      }

      const product = await ProductModel.update(id, updateData);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        data: product,
        message: 'Produto atualizado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      
      // Erro de SKU duplicado
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'SKU já existe para esta conta'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Deletar produto
   */
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const tenantId = (req as any).tenant?.id;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant não identificado' });
      }
      const deleted = await ProductModel.delete(id, tenantId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Produto deletado com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao deletar produto:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obter categorias
   */
  async getCategories(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);
      const categories = await ProductModel.getCategories(accountId);

      res.json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      console.error('Erro ao buscar categorias:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obter estatísticas
   */
  async getStats(req: Request, res: Response) {
    try {
      const accountId = parseInt(req.params.accountId);
      const stats = await ProductModel.getStats(accountId);

      res.json({
        success: true,
        data: {
          total_products: parseInt(stats.total_products) || 0,
          active_products: parseInt(stats.active_products) || 0,
          in_stock_products: parseInt(stats.in_stock_products) || 0,
          total_categories: parseInt(stats.total_categories) || 0,
          total_stock: parseInt(stats.total_stock) || 0,
          average_price: parseFloat(stats.average_price) || 0,
          min_price: parseFloat(stats.min_price) || 0,
          max_price: parseFloat(stats.max_price) || 0
        }
      });
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const productController = new ProductController();

