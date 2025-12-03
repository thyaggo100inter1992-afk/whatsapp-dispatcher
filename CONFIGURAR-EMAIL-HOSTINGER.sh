#!/bin/bash

# Script para configurar email da Hostinger no servidor

echo "📧 Configurando Email da Hostinger..."
echo ""

# Solicitar informações
read -p "Digite o email completo (ex: contato@nettsistemas.com): " EMAIL_USER
read -sp "Digite a senha do email: " EMAIL_PASS
echo ""

# Conectar ao servidor e configurar
ssh root@72.60.141.244 << EOF

cd /root/whatsapp-dispatcher/backend

# Backup do .env atual
cp .env .env.backup-\$(date +%Y%m%d-%H%M%S)

# Remover configurações antigas de email (se existirem)
sed -i '/^SMTP_/d' .env
sed -i '/^EMAIL_/d' .env
sed -i '/^SENDGRID_/d' .env
sed -i '/^AWS_SES_/d' .env
sed -i '/^MAILGUN_/d' .env

# Adicionar configurações da Hostinger
cat >> .env << 'ENVEOF'

# ==========================================
# EMAIL CONFIGURATION - HOSTINGER
# ==========================================
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$EMAIL_USER
SMTP_PASS=$EMAIL_PASS
EMAIL_FROM=$EMAIL_USER
ENVEOF

echo ""
echo "✅ Configurações adicionadas ao .env"
echo ""

# Reiniciar servidor
echo "🔄 Reiniciando servidor..."
pm2 restart whatsapp-backend

# Aguardar 3 segundos
sleep 3

# Verificar logs
echo ""
echo "📋 Verificando inicialização do Email Service..."
pm2 logs whatsapp-backend --lines 50 --nostream | grep -i "email service"

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "Para testar o envio de email, execute:"
echo "  cd /root/whatsapp-dispatcher/backend"
echo "  node test-email.js"

EOF

