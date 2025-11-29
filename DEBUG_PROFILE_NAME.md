# 🔍 Guia de Debug - Nome do Perfil do WhatsApp

## 📋 Alterações Feitas

### Backend (`backend/src/routes/uaz.js`)

#### 1. Rota GET /instances/:id/status
- ✅ Adicionado log completo da resposta da API: `JSON.stringify(statusResult.data, null, 2)`
- ✅ Retorna `profile_name` e `phone_number` diretamente na resposta principal
- ✅ Atualiza o banco com o profile_name obtido

**Resposta agora inclui:**
```json
{
  "success": true,
  "connected": true,
  "data": { ... },
  "profile_name": "Nome do Perfil",  // ← NOVO
  "phone_number": "5511999999999"    // ← NOVO
}
```

#### 2. Rota PUT /instances/:id/sync-profile
- ✅ Já estava criada e funcionando
- ✅ Retorna o profile_name sincronizado

### Frontend (`frontend/src/pages/configuracoes-uaz.tsx`)

#### 1. Interface TypeScript
- ✅ Adicionado `profile_name?: string;` na interface `UazInstance`
- ✅ Removido uso de `(instance as any).profile_name`

#### 2. Função handleEdit
- ✅ Adicionado log inicial: `console.log('📋 Dados iniciais da instância:', ...)`
- ✅ Busca `profile_name` primeiro de `statusResponse.data.profile_name` (novo local)
- ✅ Depois tenta locais alternativos na estrutura de dados
- ✅ Adiciona log completo da resposta: `console.log('📦 Resposta completa do status:', ...)`
- ✅ Adiciona log do profile_name encontrado

#### 3. Função handleSyncProfile
- ✅ Adicionado log da resposta completa
- ✅ Adicionado log de erro detalhado

## 🧪 Como Testar

### Teste 1: Verificar Logs do Backend

1. Abra o terminal do backend
2. Clique em "Editar" em uma conexão **CONECTADA**
3. Procure no terminal do backend por:

```
🔍 ============ VERIFICAÇÃO DE STATUS ============
📋 Instância: [NOME] (ID: [ID])
📊 Resultado:
   ├─ Conectado: ✅ SIM
   ├─ Status: connected
   ├─ Telefone: 5511999999999
   └─ Nome do Perfil: [AQUI DEVE APARECER O NOME] ← VERIFIQUE ISSO
🔍 DEBUG - statusResult.data completo: {
  ... ESTRUTURA COMPLETA DOS DADOS ...
}
============================================
```

**❓ O que verificar:**
- O "Nome do Perfil" está aparecendo?
- Se não, copie a estrutura completa do `statusResult.data` e me envie

### Teste 2: Verificar Logs do Frontend (Console do Browser)

1. Pressione F12 para abrir o DevTools
2. Vá na aba "Console"
3. Clique em "Editar" em uma conexão **CONECTADA**
4. Procure por:

```
📋 Dados iniciais da instância: {
  id: 1,
  name: "Minha Conexão",
  profile_name: "[AQUI DEVE TER O NOME DO BANCO]", ← VERIFIQUE
  is_connected: true
}

🔍 Buscando nome do perfil atual do WhatsApp...

📦 Resposta completa do status: {
  success: true,
  connected: true,
  profile_name: "[AQUI DEVE TER O NOME]", ← VERIFIQUE
  data: { ... }
}

🔍 Profile name encontrado: [NOME] ← VERIFIQUE

✅ Nome do perfil atual: [NOME]
```

**❓ O que verificar:**
- `profile_name` está aparecendo nos logs?
- Se não aparecer, qual é a mensagem de erro?

### Teste 3: Botão Sincronizar

1. Abra o DevTools (F12) → Console
2. Edite uma conexão **CONECTADA**
3. Clique no botão "🔄 Sincronizar"
4. Procure por:

```
🔄 Sincronizando nome do perfil...

📦 Resposta da sincronização: {
  success: true,
  profile_name: "[NOME]", ← VERIFIQUE
  message: "Nome do perfil sincronizado com sucesso"
}

✅ Nome sincronizado: [NOME]
```

**❓ O que verificar:**
- A resposta tem `success: true`?
- O `profile_name` está presente?
- Apareceu algum erro?

## 🔍 Possíveis Problemas e Soluções

### Problema 1: profile_name vem como null ou undefined

**Causa:** A API do WhatsApp não está retornando o nome do perfil

**Solução:** 
1. Verifique no log do backend o `statusResult.data completo`
2. Procure onde está o nome do perfil na estrutura
3. Me envie a estrutura completa para eu ajustar o código

### Problema 2: Conexão não está conectada

**Sintoma:** Campo profile_name fica vazio

**Solução:**
1. Verifique se a conexão está realmente **CONECTADA** (status verde)
2. Se não estiver, conecte primeiro
3. Depois clique em "Editar" novamente

### Problema 3: Erro 500 no backend

**Sintoma:** Erro ao buscar status

**Solução:**
1. Verifique os logs do backend
2. Procure por "❌ Erro ao verificar status"
3. Copie a mensagem de erro completa
4. Me envie para análise

### Problema 4: Campo não atualiza no frontend

**Sintoma:** O nome aparece nos logs mas não no campo

**Solução:**
1. Verifique se o `setFormData` está sendo chamado
2. Procure por "✅ Nome do perfil atual:" no console
3. Veja se há algum erro de React após isso

## 📝 Checklist de Verificação

Antes de me enviar informações, verifique:

- [ ] A conexão está **CONECTADA** (status verde)?
- [ ] O backend está rodando sem erros?
- [ ] O frontend está rodando sem erros?
- [ ] A coluna `profile_name` existe no banco? (já foi criada)
- [ ] Há logs no console do browser?
- [ ] Há logs no terminal do backend?

## 📤 O que me enviar se não funcionar

1. **Logs do Backend** (do terminal):
   - Copie todo o bloco "🔍 ============ VERIFICAÇÃO DE STATUS ============"
   - Principalmente o `statusResult.data completo`

2. **Logs do Frontend** (do console do browser):
   - Copie todos os logs que aparecem quando clica em "Editar"
   - Screenshot do campo de profile_name

3. **Informações da Instância**:
   - A instância está conectada?
   - Qual o status mostrado no sistema?
   - Tem nome do perfil no WhatsApp (confirme pelo celular)?

## 🎯 Objetivo Final

Quando estiver funcionando, você deverá ver:

1. **Ao editar uma conexão conectada:**
   - Campo "Nome do Perfil do WhatsApp" já vem preenchido com o nome atual
   - Nome aparece automaticamente (sem precisar clicar em nada)

2. **Ao clicar em Sincronizar:**
   - Botão fica com "Sincronizando..."
   - Após alguns segundos, mostra alerta: "✅ Nome sincronizado: [NOME]"
   - Campo atualiza com o nome mais recente do WhatsApp

3. **Ao editar o nome do perfil:**
   - Digita novo nome
   - Clica em "Salvar"
   - Sistema atualiza no WhatsApp
   - Sistema busca o nome real que foi salvo
   - Banco fica atualizado com o nome correto

---

**Data de Implementação:** 15/11/2025  
**Versão:** 2.0 (com debug completo)










