/**
 * Middleware de Verificação de Super Admin
 * Permite acesso apenas para usuários com role 'super_admin'
 */

function requireSuperAdmin(req, res, next) {
  try {
    // Verificar se o usuário está autenticado (req.user é injetado pelo authenticate middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    // Verificar se o usuário tem role de super_admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas super administradores podem acessar este recurso.',
        required_role: 'super_admin',
        current_role: req.user.role
      });
    }

    // Injetar userId e tenantId para compatibilidade com controladores antigos
    req.userId = req.user.id;
    req.tenantId = req.tenant.id;
    req.userRole = req.user.role;

    // Se passou nas verificações, continuar
    next();
  } catch (error) {
    console.error('Erro no middleware super admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar permissões'
    });
  }
}

module.exports = { requireSuperAdmin };

