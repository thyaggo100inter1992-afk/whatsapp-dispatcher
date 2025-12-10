# 🔧 Script de Normalização de CPF/CNPJ

Este script corrige **TODOS** os CPFs e CNPJs existentes no banco de dados, adicionando zeros à esquerda.

## 📋 O que faz:

- **CPFs**: Completa com zeros até 11 dígitos
  - Exemplo: `12345` → `00000012345`
  
- **CNPJs**: Completa com zeros até 14 dígitos
  - Exemplo: `1234567` → `00000001234567`

## 🚀 Como executar:

### Opção 1: Usando Node.js (RECOMENDADO)

```bash
# No diretório raiz do projeto
node backend/scripts/normalizar-documentos.js
```

Este script:
1. ✅ Mostra estatísticas **ANTES** da correção
2. ✅ Mostra exemplos dos documentos que serão corrigidos
3. ✅ Pede confirmação antes de aplicar
4. ✅ Executa a correção em uma transação (rollback em caso de erro)
5. ✅ Mostra estatísticas **DEPOIS** da correção

### Opção 2: Executar SQL diretamente

```bash
# Conectar no PostgreSQL
psql -h localhost -U postgres -d whatsapp_dispatcher

# Executar o arquivo SQL
\i backend/scripts/normalizar-documentos-existentes.sql
```

**⚠️ ATENÇÃO:** O arquivo SQL vem com `ROLLBACK` por padrão (apenas mostra o que seria feito). Para aplicar as mudanças, edite o arquivo e troque `ROLLBACK` por `COMMIT`.

## 📊 Exemplo de saída:

```
╔════════════════════════════════════════════════════════════╗
║  🔧 MIGRAÇÃO: NORMALIZAR CPF/CNPJ NO BANCO DE DADOS       ║
╚════════════════════════════════════════════════════════════╝

📊 ANALISANDO BANCO DE DADOS...

┌─────────────────────────────────────────────┐
│  📋 SITUAÇÃO ATUAL DO BANCO                 │
├─────────────────────────────────────────────┤
│  Total de registros: 79277                  │
├─────────────────────────────────────────────┤
│  ✅ CPFs corretos (11 dígitos): 77000       │
│  ❌ CPFs incorretos (< 11): 2277            │
├─────────────────────────────────────────────┤
│  ✅ CNPJs corretos (14 dígitos): 0          │
│  ❌ CNPJs incorretos (12-13): 0             │
└─────────────────────────────────────────────┘

⚠️  SERÃO CORRIGIDOS 2277 DOCUMENTO(S)

📝 EXEMPLOS DE CPFs QUE SERÃO CORRIGIDOS:

   102512 → 00000102512 (IGOR CESAR NOGUEIRA MOREIRA)
   3011168 → 00003011168 (MARIANA GOMES FONTES BETHONICO)
   8002512 → 00008002512 (ELIAS JEAN DOS PASSOS)

⚠️  ATENÇÃO: Esta operação irá alterar o banco de dados!

Deseja continuar? (digite SIM para confirmar): SIM

🔧 INICIANDO CORREÇÃO...

   Corrigindo CPFs...
   ✅ 2277 CPF(s) corrigido(s)
   Corrigindo CNPJs...
   ✅ 0 CNPJ(s) corrigido(s)

✅ CORREÇÃO CONCLUÍDA COM SUCESSO!

📊 VERIFICANDO RESULTADO...

┌─────────────────────────────────────────────┐
│  🎉 RESULTADO FINAL                         │
├─────────────────────────────────────────────┤
│  Total de registros: 79277                  │
├─────────────────────────────────────────────┤
│  ✅ CPFs corretos (11 dígitos): 79277       │
│  ❌ CPFs incorretos (< 11): 0               │
├─────────────────────────────────────────────┤
│  ✅ CNPJs corretos (14 dígitos): 0          │
│  ❌ CNPJs incorretos (12-13): 0             │
└─────────────────────────────────────────────┘

🎉 SUCESSO! Todos os documentos foram normalizados corretamente!
```

## ⚠️ IMPORTANTE:

1. **Backup**: Recomendo fazer backup do banco antes de executar
2. **Horário**: Execute em horário de baixo uso do sistema
3. **Velocidade**: O script é rápido (processa milhares de registros por segundo)
4. **Segurança**: Usa transações - se der erro, faz rollback automático

## 🔒 Segurança:

- ✅ Usa transações (BEGIN/COMMIT/ROLLBACK)
- ✅ Pede confirmação antes de executar
- ✅ Mostra exemplos antes de aplicar
- ✅ Não afeta outros campos, apenas o campo `documento`

## 📞 Suporte:

Se tiver algum problema, entre em contato!

