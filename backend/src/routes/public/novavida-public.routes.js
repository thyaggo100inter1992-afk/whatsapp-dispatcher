/**
 * API Pública - Consulta Nova Vida (CPF/CNPJ)
 * Autenticação: token do tenant (nsk_...) OU email + senha
 * Devolve o mesmo payload da consulta do painel (dados cadastrais, telefones, e-mails, endereços, WhatsApp).
 */

const express = require('express');
const router = express.Router();
const { autenticarApiPublica } = require('../../helpers/public-api-auth.helper');
const { checkNovaVidaLimit } = require('../../middlewares/tenant-limits.middleware');
const { consultarDocumentoHandler } = require('../novaVida');

async function authPublicNovaVida(req, res, next) {
  const auth = await autenticarApiPublica(req);
  if (auth.erro) {
    return res.status(auth.erro.status).json({
      sucesso: false,
      success: false,
      mensagem: auth.erro.mensagem,
      error: auth.erro.mensagem,
    });
  }

  req.user = {
    id: auth.usuario.id,
    nome: auth.usuario.nome,
    email: auth.usuario.email,
    role: auth.usuario.role,
  };
  req.tenant = { id: auth.tenantId };

  if (!req.body.documento) {
    req.body.documento = req.body.cpf || req.body.cnpj;
  }

  next();
}

/**
 * POST /api/public/novavida/consultar
 *
 * Body:
 *   token             (recomendado)
 *   documento|cpf     (obrigatório)
 *   verificarWhatsapp (opcional, default true)
 *   whatsappColumn    (opcional: first | second | third | all) default first
 */
router.post('/consultar', authPublicNovaVida, checkNovaVidaLimit, consultarDocumentoHandler);

module.exports = router;
