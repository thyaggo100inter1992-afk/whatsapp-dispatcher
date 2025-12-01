-- ════════════════════════════════════════════════════════════
-- 🔍 VERIFICAR WEBHOOKS NO BANCO DE DADOS
-- ════════════════════════════════════════════════════════════

-- 1️⃣ Verificar se a tabela webhook_logs existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'webhook_logs'
) as tabela_webhook_logs_existe;

-- 2️⃣ Ver últimos 10 webhooks recebidos
SELECT 
    id,
    request_type,
    request_method,
    verification_success,
    webhook_object,
    received_at,
    processed_at,
    error_message,
    ip_address
FROM webhook_logs
ORDER BY id DESC
LIMIT 10;

-- 3️⃣ Estatísticas de webhooks (últimas 24 horas)
SELECT 
    COUNT(*) as total_webhooks,
    COUNT(*) FILTER (WHERE request_type = 'verification') as verificacoes,
    COUNT(*) FILTER (WHERE request_type = 'event') as eventos,
    COUNT(*) FILTER (WHERE verification_success = true) as verificacoes_sucesso,
    COUNT(*) FILTER (WHERE verification_success = false) as verificacoes_falha,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as com_erro,
    MAX(received_at) as ultimo_webhook
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '24 hours';

-- 4️⃣ Ver webhooks de verificação (últimos 5)
SELECT 
    id,
    verify_mode,
    verify_token,
    verification_success,
    received_at,
    ip_address
FROM webhook_logs
WHERE request_type = 'verification'
ORDER BY id DESC
LIMIT 5;

-- 5️⃣ Ver webhooks de eventos (últimos 10)
SELECT 
    id,
    webhook_object,
    whatsapp_account_id,
    message_id,
    message_status,
    received_at,
    processed_at
FROM webhook_logs
WHERE request_type = 'event'
ORDER BY id DESC
LIMIT 10;

-- 6️⃣ Ver mensagens com status atualizado via webhook
SELECT 
    m.id,
    m.phone_number,
    m.template_name,
    m.status,
    m.sent_at,
    m.delivered_at,
    m.read_at,
    m.failed_at,
    m.whatsapp_message_id
FROM messages m
WHERE m.status IN ('delivered', 'read', 'failed')
  AND m.delivered_at IS NOT NULL OR m.read_at IS NOT NULL OR m.failed_at IS NOT NULL
ORDER BY m.id DESC
LIMIT 10;

-- 7️⃣ Taxa de sucesso de webhooks por hora (últimas 24h)
SELECT 
    DATE_TRUNC('hour', received_at) as hora,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE verification_success = true OR request_type = 'event') as sucesso,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as erros
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', received_at)
ORDER BY hora DESC;

-- 8️⃣ IPs que enviaram webhooks (últimos 20)
SELECT 
    ip_address,
    COUNT(*) as quantidade,
    MAX(received_at) as ultimo_acesso
FROM webhook_logs
WHERE ip_address IS NOT NULL
GROUP BY ip_address
ORDER BY quantidade DESC
LIMIT 20;

-- 9️⃣ Verificar se há mensagens sem status atualizado (possível problema de webhook)
SELECT 
    COUNT(*) as total_enviadas,
    COUNT(*) FILTER (WHERE status = 'sent') as aguardando_status,
    COUNT(*) FILTER (WHERE status = 'delivered') as entregues,
    COUNT(*) FILTER (WHERE status = 'read') as lidas,
    COUNT(*) FILTER (WHERE status = 'failed') as falhas,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('delivered', 'read', 'failed'))::numeric / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as percentual_com_status
FROM messages
WHERE sent_at > NOW() - INTERVAL '24 hours';

-- 🔟 Últimos erros de webhook
SELECT 
    id,
    request_type,
    error_message,
    request_body,
    received_at
FROM webhook_logs
WHERE error_message IS NOT NULL
ORDER BY id DESC
LIMIT 10;



