# 🔄 Migração de Templates para Tenant Correto

## 📋 Problema

Templates foram criados com `tenant_id` incorreto (1) quando deveriam estar no tenant da conta do WhatsApp (4).

## 🎯 Solução

Este script migra automaticamente todos os templates para o tenant correto baseado na conta do WhatsApp que os criou.

## 🚀 Como Executar

### Opção 1: Script Node.js (Recomendado)

```bash
cd /root/whatsapp-dispatcher/backend
node scripts/migrar-templates.js
```

**Vantagens:**
- ✅ Mostra preview antes de executar
- ✅ Pede confirmação
- ✅ Usa transação (rollback automático em caso de erro)
- ✅ Mostra resultado final

### Opção 2: SQL Direto (Avançado)

```bash
psql -U postgres -d whatsapp_dispatcher -f scripts/migrar-templates-tenant4.sql
```

**⚠️ ATENÇÃO:** Por padrão o SQL tem `ROLLBACK` ativo para segurança!

## 📊 O que o script faz?

1. **Verifica** quantos templates serão migrados
2. **Mostra** os primeiros 10 templates afetados
3. **Pede confirmação** antes de prosseguir
4. **Migra** templates para o tenant correto
5. **Migra** registros de histórico relacionados
6. **Mostra** resultado final

## 🔍 Exemplo de Saída

```
🔍 ===== VERIFICANDO TEMPLATES PARA MIGRAÇÃO =====

📊 TEMPLATES ENCONTRADOS PARA MIGRAÇÃO:
─────────────────────────────────────────
   • Total: 50 templates
   • Tenant Atual: 1
   • Tenant Correto: 4

📋 PRIMEIROS 10 TEMPLATES QUE SERÃO MIGRADOS:
─────────────────────────────────────────────────

1. 46_saque_complementar
   ID: 123
   Conta: NETTICRED
   Status: APPROVED
   Categoria: MARKETING
   Tenant Atual → Correto: 1 → 4

❓ Deseja prosseguir com a migração? (sim/não): sim

🚀 ===== INICIANDO MIGRAÇÃO =====

✅ 50 templates migrados para tenant 4
✅ 50 registros de histórico migrados para tenant 4

🎉 ===== MIGRAÇÃO CONCLUÍDA COM SUCESSO! =====

📊 RESULTADO FINAL:
────────────────────
   • Tenant 4: 50 templates
```

## ⚠️ Segurança

- ✅ **Transação**: Tudo é feito em uma transação, rollback automático em caso de erro
- ✅ **Preview**: Mostra o que será alterado antes de confirmar
- ✅ **Confirmação**: Pede confirmação explícita do usuário
- ✅ **Backup**: Recomendado fazer backup do banco antes (opcional)

## 🔙 Backup (Opcional)

```bash
pg_dump -U postgres whatsapp_dispatcher > backup_antes_migracao.sql
```

## 📝 Logs

O script mostra logs detalhados de cada etapa para auditoria.

## ❓ Dúvidas?

Entre em contato com o administrador do sistema.

