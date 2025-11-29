import { query } from '../database/connection';

export interface Product {
  id: number;
  whatsapp_account_id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  in_stock: boolean;
  stock_quantity: number;
  category?: string;
  sku?: string;
  url?: string;
  is_active: boolean;
  facebook_product_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductDTO {
  whatsapp_account_id: number;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image_url?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  category?: string;
  sku?: string;
  url?: string;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  category?: string;
  sku?: string;
  url?: string;
  is_active?: boolean;
  facebook_product_id?: string;
}

export class ProductModel {
  /**
   * Criar novo produto
   */
  static async create(data: CreateProductDTO): Promise<Product> {
    const result = await query(
      `INSERT INTO products (
        whatsapp_account_id, name, description, price, currency,
        image_url, in_stock, stock_quantity, category, sku, url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.whatsapp_account_id,
        data.name,
        data.description || null,
        data.price,
        data.currency || 'BRL',
        data.image_url || null,
        data.in_stock !== undefined ? data.in_stock : true,
        data.stock_quantity || 0,
        data.category || null,
        data.sku || null,
        data.url || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Buscar produto por ID
   * 🔒 SEGURANÇA: Verifica se o produto pertence a uma conta do tenant
   */
  static async findById(id: number, tenantId?: number): Promise<Product | null> {
    if (!tenantId) {
      // Se não passar tenantId, busca sem filtro (para uso interno ou super admin)
      const result = await query(
        'SELECT * FROM products WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    }
    
    // Com tenantId, verificar se o produto pertence a uma conta do tenant
    const result = await query(
      `SELECT p.* FROM products p
       INNER JOIN whatsapp_accounts w ON p.whatsapp_account_id = w.id
       WHERE p.id = $1 AND w.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  /**
   * Listar produtos de uma conta
   */
  static async findByAccount(
    accountId: number,
    filters?: {
      category?: string;
      in_stock?: boolean;
      is_active?: boolean;
      search?: string;
    }
  ): Promise<Product[]> {
    let sql = 'SELECT * FROM products WHERE whatsapp_account_id = $1';
    const params: any[] = [accountId];
    let paramCount = 1;

    if (filters?.category) {
      paramCount++;
      sql += ` AND category = $${paramCount}`;
      params.push(filters.category);
    }

    if (filters?.in_stock !== undefined) {
      paramCount++;
      sql += ` AND in_stock = $${paramCount}`;
      params.push(filters.in_stock);
    }

    if (filters?.is_active !== undefined) {
      paramCount++;
      sql += ` AND is_active = $${paramCount}`;
      params.push(filters.is_active);
    }

    if (filters?.search) {
      paramCount++;
      sql += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Atualizar produto
   */
  static async update(id: number, data: UpdateProductDTO): Promise<Product | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.findById(id);
    }

    paramCount++;
    values.push(id);

    const result = await query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Deletar produto
   */
  static async delete(id: number, tenantId: number): Promise<boolean> {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para delete');
    }
    const result = await query(
      'DELETE FROM products WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Obter categorias de uma conta
   */
  static async getCategories(accountId: number): Promise<string[]> {
    const result = await query(
      `SELECT DISTINCT category 
       FROM products 
       WHERE whatsapp_account_id = $1 
       AND category IS NOT NULL 
       AND is_active = true
       ORDER BY category`,
      [accountId]
    );
    return result.rows.map(row => row.category);
  }

  /**
   * Obter estatísticas do catálogo
   */
  static async getStats(accountId: number) {
    const result = await query(
      `SELECT 
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE is_active = true) as active_products,
        COUNT(*) FILTER (WHERE in_stock = true) as in_stock_products,
        COUNT(DISTINCT category) as total_categories,
        SUM(stock_quantity) as total_stock,
        AVG(price) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price
       FROM products 
       WHERE whatsapp_account_id = $1`,
      [accountId]
    );
    return result.rows[0];
  }
}

