# 🔧 Correção: Erro ao Buscar Nome do Perfil

## ❌ Problema

Erro 500 ao tentar buscar o nome do perfil do WhatsApp:
```
⚠️ Não foi possível buscar nome do perfil:
Request failed with status code 500
```

---

## 🎯 Causa Provável

A coluna `profile_name` ainda **não foi criada** no banco de dados.

---

## ✅ Solução

### Passo 1: Executar o SQL

Execute o arquivo BAT para criar a coluna:

```batch
APLICAR-PROFILE-NAME.bat
```

Ou execute manualmente:

```sql
psql -U postgres -d disparador_massa -f ADICIONAR-PROFILE-NAME.sql
```

### Passo 2: Reiniciar o Backend

Após executar o SQL, **REINICIE** o backend:
- Feche o terminal do backend (Ctrl+C)
- Execute novamente: `3-iniciar-backend.bat`

### Passo 3: Testar Novamente

1. Recarregue a página no navegador (F5)
2. Clique em "Editar" em uma conexão conectada
3. ✅ Agora o nome do perfil deve aparecer!

---

## 🔍 Verificar se a Coluna Existe

Para verificar se a coluna foi criada, execute no PostgreSQL:

```sql
-- Conectar no banco
psql -U postgres -d disparador_massa

-- Verificar se coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'uaz_instances' 
AND column_name = 'profile_name';
```

**Resultado esperado:**
```
 column_name  |     data_type     
--------------+-------------------
 profile_name | character varying
```

Se não mostrar nada, a coluna NÃO existe. Execute o SQL novamente.

---

## 📝 Logs Melhorados

Após a correção, agora o backend mostra mais detalhes sobre erros:

```bash
❌ Erro ao verificar status da instância: column "profile_name" does not exist
   └─ Stack: Error: column "profile_name" does not exist
```

Isso facilita identificar o problema rapidamente.

---

## ✅ Após Executar o SQL

O sistema funcionará assim:

1. **Ao clicar "Editar":**
   - Busca o nome atual do perfil do WhatsApp
   - Preenche o campo automaticamente

2. **Campo preenchido:**
   ```
   Nome do Perfil do WhatsApp
   [Minha Empresa - Atendimento]
   ```

3. **Pode editar e salvar:**
   - Atualiza no WhatsApp via API
   - Salva no banco de dados

---

## 🚀 Checklist

- [ ] Executou `APLICAR-PROFILE-NAME.bat`
- [ ] Reiniciou o backend
- [ ] Recarregou a página (F5)
- [ ] Testou editar uma conexão
- [ ] Nome do perfil apareceu

---

## ⚠️ Se Ainda Não Funcionar

1. **Verifique os logs do backend** - Procure por erros
2. **Confirme que a coluna foi criada** - Use o SQL acima
3. **Reinicie o PostgreSQL** - Se necessário
4. **Limpe o cache do navegador** - Ctrl+Shift+Delete

---

## 📞 Suporte

Se o problema persistir, verifique:

1. ✅ PostgreSQL está rodando
2. ✅ Backend está rodando sem erros
3. ✅ Conexão está realmente conectada (status: connected)
4. ✅ Token da instância é válido

---

**🎉 Problema resolvido! Execute o SQL e reinicie o backend!**










