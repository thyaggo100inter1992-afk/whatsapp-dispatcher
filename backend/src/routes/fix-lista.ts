import { Router, Request, Response } from 'express';
import { query } from '../database/connection';

const router = Router();

// Endpoint temporário para forçar criação da lista "Sem WhatsApp"
router.get('/criar-lista-sem-whatsapp', async (req: Request, res: Response) => {
  try {
    console.log('🔧 Forçando criação da lista "Sem WhatsApp"...');
    
    // Inserir a lista
    const result = await query(
      `INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) 
       VALUES ($1, $2, $3, NULL, true) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, 
           description = EXCLUDED.description,
           auto_add_enabled = EXCLUDED.auto_add_enabled
       RETURNING *`,
      ['no_whatsapp', 'Sem WhatsApp', 'Números sem WhatsApp ou inválidos']
    );
    
    // Verificar se existe
    const check = await query(
      `SELECT * FROM restriction_list_types`
    );
    
    res.json({
      success: true,
      message: '✅ Lista "Sem WhatsApp" criada/atualizada com sucesso!',
      lista_criada: result.rows[0],
      todas_listas: check.rows
    });
    
  } catch (error: any) {
    console.error('❌ Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;

