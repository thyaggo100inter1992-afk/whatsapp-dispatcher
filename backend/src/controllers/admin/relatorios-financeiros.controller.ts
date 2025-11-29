/**
 * Controller Admin - Relatórios Financeiros
 * Dashboard completo de rendimentos e métricas financeiras
 * SUPER ADMIN - Visualização consolidada de TODOS os tenantes
 */

import { Request, Response } from 'express';
import { pool } from '../../database/connection';

class RelatoriosFinanceirosController {
  /**
   * GET /api/admin/relatorios-financeiros/dashboard
   * Retorna todas as métricas financeiras consolidadas de TODOS os tenantes
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const { data_inicio, data_fim } = req.query;
      
      console.log('📊 Gerando relatório financeiro consolidado...');
      
      // Validar datas
      const dataInicio = data_inicio 
        ? new Date(data_inicio as string) 
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dataFim = data_fim 
        ? new Date(data_fim as string) 
        : new Date();

      console.log(`📅 Período: ${dataInicio.toISOString().split('T')[0]} até ${dataFim.toISOString().split('T')[0]}`);

      // 1. TENANTS COM PAGAMENTO NO PERÍODO
      const tenantsComPagamento = await pool.query(`
        SELECT COUNT(DISTINCT tenant_id) as total
        FROM payments
        WHERE status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
      `, [dataInicio, dataFim]);

      // 2. TENANTS SEM PAGAMENTO NO PERÍODO (ativos mas sem pagamento)
      const tenantsSemPagamento = await pool.query(`
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status IN ('active', 'trial')
        AND id NOT IN (
          SELECT DISTINCT tenant_id 
          FROM payments 
          WHERE status IN ('confirmed', 'received')
          AND paid_at BETWEEN $1 AND $2
        )
      `, [dataInicio, dataFim]);

      // 3. VALOR RECEBIDO (pagamentos confirmados)
      const valorRecebido = await pool.query(`
        SELECT 
          COALESCE(SUM(valor), 0) as total,
          COUNT(*) as quantidade_pagamentos,
          COUNT(DISTINCT tenant_id) as tenants_distintos
        FROM payments
        WHERE status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
      `, [dataInicio, dataFim]);

      // 4. VALOR A RECEBER (pagamentos pendentes)
      const valorPendente = await pool.query(`
        SELECT 
          COALESCE(SUM(valor), 0) as total,
          COUNT(*) as quantidade_pendentes,
          COUNT(DISTINCT tenant_id) as tenants_distintos
        FROM payments
        WHERE status = 'pending'
        AND created_at BETWEEN $1 AND $2
      `, [dataInicio, dataFim]);

      // 5. STATUS DOS TENANTS (TODOS)
      const statusTenants = await pool.query(`
        SELECT 
          status,
          COUNT(*) as quantidade
        FROM tenants
        GROUP BY status
        ORDER BY quantidade DESC
      `);

      // 6. TENANTS ATIVOS vs INATIVOS (simplificado)
      const tenantsAtivos = await pool.query(`
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status IN ('active', 'trial')
      `);

      const tenantsInativos = await pool.query(`
        SELECT COUNT(*) as total
        FROM tenants
        WHERE status IN ('blocked', 'cancelled', 'deleted')
      `);

      // 7. CONSULTAS AVULSAS - Quantidade e Valor
      const consultasAvulsas = await pool.query(`
        SELECT 
          COUNT(*) as quantidade_compras,
          COALESCE(SUM(valor), 0) as valor_total,
          COALESCE(SUM((metadata->>'quantidade_consultas')::int), 0) as total_consultas_compradas,
          COUNT(DISTINCT tenant_id) as tenants_distintos
        FROM payments
        WHERE metadata->>'tipo' = 'consultas_avulsas'
        AND status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
      `, [dataInicio, dataFim]);

      // 8. CONSULTAS REALIZADAS (quantas consultas foram feitas)
      const consultasRealizadas = await pool.query(`
        SELECT 
          COUNT(*) as total_consultas,
          COUNT(*) FILTER (WHERE is_consulta_avulsa = true) as consultas_avulsas_usadas,
          COUNT(*) FILTER (WHERE is_consulta_avulsa = false OR is_consulta_avulsa IS NULL) as consultas_plano_usadas,
          COUNT(DISTINCT tenant_id) as tenants_distintos
        FROM novavida_consultas
        WHERE created_at BETWEEN $1 AND $2
      `, [dataInicio, dataFim]);

      // 9. BREAKDOWN POR TIPO DE PAGAMENTO
      const breakdownPagamentos = await pool.query(`
        SELECT 
          COALESCE(metadata->>'tipo', 'renovacao') as tipo_cobranca,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor), 0) as valor_total,
          COUNT(DISTINCT tenant_id) as tenants_distintos
        FROM payments
        WHERE status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
        GROUP BY metadata->>'tipo'
        ORDER BY valor_total DESC
      `, [dataInicio, dataFim]);

      // 10. PLANOS MAIS VENDIDOS
      const planosMaisVendidos = await pool.query(`
        SELECT 
          COALESCE(p.nome, 'Sem Plano') as plano_nome,
          COUNT(*) as quantidade_vendas,
          COALESCE(SUM(pay.valor), 0) as receita_total,
          COUNT(DISTINCT pay.tenant_id) as tenants_distintos
        FROM payments pay
        LEFT JOIN plans p ON pay.plan_id = p.id
        WHERE pay.status IN ('confirmed', 'received')
        AND pay.paid_at BETWEEN $1 AND $2
        GROUP BY p.nome
        ORDER BY receita_total DESC
        LIMIT 10
      `, [dataInicio, dataFim]);

      // 11. TOP 10 TENANTS QUE MAIS GASTARAM
      const topTenants = await pool.query(`
        SELECT 
          t.id,
          t.nome,
          t.email,
          COUNT(p.id) as quantidade_pagamentos,
          COALESCE(SUM(p.valor), 0) as valor_total_gasto
        FROM tenants t
        JOIN payments p ON p.tenant_id = t.id
        WHERE p.status IN ('confirmed', 'received')
        AND p.paid_at BETWEEN $1 AND $2
        GROUP BY t.id, t.nome, t.email
        ORDER BY valor_total_gasto DESC
        LIMIT 10
      `, [dataInicio, dataFim]);

      // 12. MÉTRICAS DE FORMA DE PAGAMENTO
      const formasPagamento = await pool.query(`
        SELECT 
          payment_type as forma,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor), 0) as valor_total
        FROM payments
        WHERE status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
        GROUP BY payment_type
        ORDER BY valor_total DESC
      `, [dataInicio, dataFim]);

      // 13. RECEITA DIÁRIA NO PERÍODO (para gráfico)
      const receitaDiaria = await pool.query(`
        SELECT 
          DATE(paid_at) as data,
          COUNT(*) as quantidade_pagamentos,
          COALESCE(SUM(valor), 0) as valor_total
        FROM payments
        WHERE status IN ('confirmed', 'received')
        AND paid_at BETWEEN $1 AND $2
        GROUP BY DATE(paid_at)
        ORDER BY data ASC
      `, [dataInicio, dataFim]);

      // CONSOLIDAR RESPOSTA
      const resultado = {
        success: true,
        periodo: {
          data_inicio: dataInicio.toISOString().split('T')[0],
          data_fim: dataFim.toISOString().split('T')[0]
        },
        resumo_geral: {
          tenants_com_pagamento: parseInt(tenantsComPagamento.rows[0].total),
          tenants_sem_pagamento: parseInt(tenantsSemPagamento.rows[0].total),
          tenants_ativos: parseInt(tenantsAtivos.rows[0].total),
          tenants_inativos: parseInt(tenantsInativos.rows[0].total),
          valor_recebido: parseFloat(valorRecebido.rows[0].total),
          valor_pendente: parseFloat(valorPendente.rows[0].total),
          quantidade_pagamentos: parseInt(valorRecebido.rows[0].quantidade_pagamentos),
          quantidade_pendentes: parseInt(valorPendente.rows[0].quantidade_pendentes),
          ticket_medio: valorRecebido.rows[0].quantidade_pagamentos > 0 
            ? parseFloat(valorRecebido.rows[0].total) / parseInt(valorRecebido.rows[0].quantidade_pagamentos)
            : 0
        },
        tenants: {
          por_status: statusTenants.rows.map(row => ({
            status: row.status,
            quantidade: parseInt(row.quantidade)
          })),
          ativos: parseInt(tenantsAtivos.rows[0].total),
          inativos: parseInt(tenantsInativos.rows[0].total)
        },
        consultas_avulsas: {
          quantidade_compras: parseInt(consultasAvulsas.rows[0].quantidade_compras),
          valor_total: parseFloat(consultasAvulsas.rows[0].valor_total),
          total_consultas_compradas: parseInt(consultasAvulsas.rows[0].total_consultas_compradas),
          tenants_que_compraram: parseInt(consultasAvulsas.rows[0].tenants_distintos),
          ticket_medio: consultasAvulsas.rows[0].quantidade_compras > 0
            ? parseFloat(consultasAvulsas.rows[0].valor_total) / parseInt(consultasAvulsas.rows[0].quantidade_compras)
            : 0
        },
        consultas_realizadas: {
          total: parseInt(consultasRealizadas.rows[0].total_consultas || 0),
          avulsas_usadas: parseInt(consultasRealizadas.rows[0].consultas_avulsas_usadas || 0),
          plano_usadas: parseInt(consultasRealizadas.rows[0].consultas_plano_usadas || 0),
          tenants_que_consultaram: parseInt(consultasRealizadas.rows[0].tenants_distintos || 0)
        },
        breakdown_pagamentos: breakdownPagamentos.rows.map(row => ({
          tipo_cobranca: row.tipo_cobranca,
          quantidade: parseInt(row.quantidade),
          valor_total: parseFloat(row.valor_total),
          tenants_distintos: parseInt(row.tenants_distintos)
        })),
        planos_mais_vendidos: planosMaisVendidos.rows.map(row => ({
          plano_nome: row.plano_nome,
          quantidade_vendas: parseInt(row.quantidade_vendas),
          receita_total: parseFloat(row.receita_total),
          tenants_distintos: parseInt(row.tenants_distintos)
        })),
        top_tenants: topTenants.rows.map(row => ({
          id: row.id,
          nome: row.nome,
          email: row.email,
          quantidade_pagamentos: parseInt(row.quantidade_pagamentos),
          valor_total_gasto: parseFloat(row.valor_total_gasto)
        })),
        formas_pagamento: formasPagamento.rows.map(row => ({
          forma: row.forma,
          quantidade: parseInt(row.quantidade),
          valor_total: parseFloat(row.valor_total)
        })),
        receita_diaria: receitaDiaria.rows.map(row => ({
          data: row.data,
          quantidade_pagamentos: parseInt(row.quantidade_pagamentos),
          valor_total: parseFloat(row.valor_total)
        }))
      };

      console.log('✅ Relatório financeiro gerado com sucesso!');
      console.log(`💰 Valor recebido: R$ ${resultado.resumo_geral.valor_recebido.toFixed(2)}`);
      console.log(`👥 Tenants com pagamento: ${resultado.resumo_geral.tenants_com_pagamento}`);

      return res.json(resultado);

    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório financeiro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar relatório',
        error: error.message
      });
    }
  }

  /**
   * GET /api/admin/relatorios-financeiros/exportar
   * Exportar relatório em CSV
   */
  async exportarCSV(req: Request, res: Response) {
    try {
      const { data_inicio, data_fim } = req.query;
      
      const dataInicio = data_inicio 
        ? new Date(data_inicio as string) 
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dataFim = data_fim 
        ? new Date(data_fim as string) 
        : new Date();

      // Buscar todos os pagamentos do período
      const pagamentos = await pool.query(`
        SELECT 
          p.id,
          p.created_at,
          p.paid_at,
          t.nome as tenant_nome,
          t.email as tenant_email,
          p.valor,
          p.status,
          p.payment_type,
          COALESCE(p.metadata->>'tipo', 'renovacao') as tipo_cobranca,
          pl.nome as plano_nome
        FROM payments p
        JOIN tenants t ON t.id = p.tenant_id
        LEFT JOIN plans pl ON pl.id = p.plan_id
        WHERE p.created_at BETWEEN $1 AND $2
        ORDER BY p.created_at DESC
      `, [dataInicio, dataFim]);

      // Gerar CSV
      let csv = 'ID,Data Criação,Data Pagamento,Tenant,Email,Valor,Status,Forma Pagamento,Tipo,Plano\n';
      
      pagamentos.rows.forEach(row => {
        csv += `${row.id},`;
        csv += `${row.created_at},`;
        csv += `${row.paid_at || 'N/A'},`;
        csv += `"${row.tenant_nome}",`;
        csv += `${row.tenant_email},`;
        csv += `${row.valor},`;
        csv += `${row.status},`;
        csv += `${row.payment_type},`;
        csv += `${row.tipo_cobranca},`;
        csv += `"${row.plano_nome || 'N/A'}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-financeiro-${dataInicio.toISOString().split('T')[0]}-${dataFim.toISOString().split('T')[0]}.csv`);
      
      return res.send('\uFEFF' + csv); // BOM para UTF-8

    } catch (error: any) {
      console.error('❌ Erro ao exportar CSV:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao exportar CSV',
        error: error.message
      });
    }
  }
}

export const relatoriosFinanceirosController = new RelatoriosFinanceirosController();



