# 🔧 RESOLVER ERRO DE WEBHOOK AGORA

## ❌ Problema:

Os erros 500 que você está vendo são porque a **tabela `webhook_logs` não existe no banco de dados**.

```
❌ 500 /api/webhook/config
❌ 500 /api/webhook/stats  
❌ 500 /api/webhook/logs
```

---

## ✅ SOLUÇÃO RÁPIDA (3 métodos - escolha 1)

### 🚀 MÉTODO 1: Usar Node.js (MAIS FÁCIL)

```bash
# Execute este arquivo:
APLICAR-MIGRATION-NODE.bat
```

**Depois:**
1. Pressione `Ctrl+C` no terminal do backend
2. Execute `3-iniciar-backend.bat`
3. Recarregue a página (F5)

---

### 🐘 MÉTODO 2: Usar pgAdmin (RECOMENDADO)

1. **Abra o pgAdmin**

2. **Conecte ao banco**: `whatsapp_dispatcher`

3. **Abra o arquivo**: `APLICAR-WEBHOOK-FIX.sql`
   - Você pode dar duplo-clique no arquivo

4. **Execute o script** (botão ▶️ Play)

5. **Reinicie o backend**:
   ```bash
   # Pressione Ctrl+C no terminal
   3-iniciar-backend.bat
   ```

6. **Recarregue a página** (F5)

---

### 💻 MÉTODO 3: Linha de Comando (psql)

```bash
# No terminal:
cd backend
psql -U postgres -d whatsapp_dispatcher -f ../APLICAR-WEBHOOK-FIX.sql
```

---

## 🎯 O que a migration faz?

Cria a tabela `webhook_logs` que armazena:
- ✅ Histórico de webhooks recebidos
- ✅ Status de processamento
- ✅ Contadores de mensagens/cliques
- ✅ Logs para debugging

---

## 🔍 Como saber se funcionou?

### ✅ Antes de reiniciar:

Execute no pgAdmin:
```sql
SELECT COUNT(*) FROM webhook_logs;
```

Se retornar `0` (zero registros) = **funcionou!**  
Se retornar erro = **tabela ainda não existe**

### ✅ Depois de reiniciar:

1. Abra: http://localhost:3000/configuracoes
2. Clique em uma conta
3. Vá para aba **Webhooks**
4. Deve aparecer a interface completa! 🎉

---

## 🐛 Ainda com erro?

### Verifique o console do backend:

Deve aparecer algo como:
```
✅ Servidor rodando na porta 3001
✅ Conectado ao PostgreSQL
```

Se aparecer erro de SQL = a tabela não foi criada ainda.

### Solução manual:

Copie e execute este SQL no pgAdmin:

```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(20) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    verify_mode VARCHAR(50),
    verify_token VARCHAR(255),
    verify_challenge TEXT,
    verification_success BOOLEAN,
    webhook_object VARCHAR(100),
    event_type VARCHAR(50),
    request_body JSONB,
    request_query JSONB,
    request_headers JSONB,
    processing_status VARCHAR(50) DEFAULT 'success',
    processing_error TEXT,
    messages_processed INTEGER DEFAULT 0,
    statuses_processed INTEGER DEFAULT 0,
    clicks_detected INTEGER DEFAULT 0,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    whatsapp_account_id INTEGER,
    ip_address VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at DESC);
CREATE INDEX idx_webhook_logs_request_type ON webhook_logs(request_type);
CREATE INDEX idx_webhook_logs_whatsapp_account ON webhook_logs(whatsapp_account_id);
CREATE INDEX idx_webhook_logs_processing_status ON webhook_logs(processing_status);
```

---

## 📞 Resumo Visual:

```
┌─────────────────────────────────────────────┐
│  1. Executar:                               │
│     APLICAR-MIGRATION-NODE.bat              │
│     (ou usar pgAdmin)                       │
├─────────────────────────────────────────────┤
│  2. Reiniciar Backend:                      │
│     Ctrl+C → 3-iniciar-backend.bat          │
├─────────────────────────────────────────────┤
│  3. Recarregar Navegador:                   │
│     F5                                       │
└─────────────────────────────────────────────┘
```

---

## ✨ Resultado Final:

Depois desses passos, a página de Webhooks vai mostrar:

✅ URL e token do webhook  
✅ Cards de estatísticas coloridos  
✅ Histórico de webhooks recebidos  
✅ Filtros por período  
✅ Instruções de configuração  

---

**Escolha um dos 3 métodos acima e execute! 🚀**

