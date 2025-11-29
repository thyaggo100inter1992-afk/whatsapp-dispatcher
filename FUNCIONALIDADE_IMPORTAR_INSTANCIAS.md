# 📥 FUNCIONALIDADE: IMPORTAR INSTÂNCIAS DA UAZ API

**Data:** 19/11/2025  
**Status:** ✅ IMPLEMENTADO E PRONTO!

---

## 🎯 O QUE FAZ

Esta funcionalidade permite **importar instâncias já conectadas** da UAZ API diretamente para o sistema, sem precisar criar e conectar novamente.

### 💡 Caso de Uso:

Quando você:
- Já tem instâncias criadas e conectadas na UAZ API
- Quer trazer essas instâncias para dentro do sistema
- Não quer reconectar tudo do zero

**AGORA PODE** simplesmente importá-las com poucos cliques! 🎉

---

## 🔧 COMO FUNCIONA

### 1️⃣ Backend

#### **Novo Método no uazService.js:**
```javascript
async fetchInstances(proxyConfig = null)
```
- Faz: `GET https://nettsistemas.uazapi.com/instance/fetchInstances`
- Header: `AdminToken`
- Retorna: Todas as instâncias criadas na UAZ API

#### **Novos Endpoints:**

**1. GET `/api/uaz/fetch-instances`**
- Busca instâncias da UAZ API
- Compara com banco local
- Retorna apenas as que NÃO estão cadastradas

**2. POST `/api/uaz/import-instances`**
```json
{
  "instances": [
    {
      "token": "abc123...",
      "name": "556281045992",
      "owner": "556281045992",
      "status": "connected",
      "profileName": "NettCred Financeira",
      "profilePicUrl": "https://..."
    }
  ]
}
```
- Importa as instâncias selecionadas
- Salva no banco `uaz_instances`
- Retorna resumo (importadas vs erros)

---

### 2️⃣ Frontend

#### **Novo Botão:**
Localização: `Configurações UAZ` → Topo da página

```
[Nova Instância] [Importar Instâncias] [Pausar Todas] [...]
```

#### **Modal de Seleção:**
- Lista todas as instâncias disponíveis
- Mostra: Nome, Número, Status (Conectada/Desconectada), Token
- Checkbox para selecionar múltiplas
- Botão "Selecionar Todas"
- Contador de selecionadas

---

## 🚀 COMO USAR

### Passo a Passo:

1. **Acesse:** Configurações UAZ (menu lateral)

2. **Clique:** Botão **"Importar Instâncias"** (roxo/rosa)

3. **Aguarde:** Sistema busca instâncias da UAZ API

4. **Selecione:** Marque as instâncias que deseja importar
   - ✅ Pode selecionar múltiplas
   - 📋 Pode usar "Selecionar Todas"

5. **Importe:** Clique em **"Importar (X)"**

6. **Pronto!** 🎉 
   - Instâncias aparecem na lista
   - Dados preservados (número, nome perfil, foto, status)
   - Prontas para usar em campanhas!

---

## 📊 INFORMAÇÕES EXIBIDAS

Para cada instância disponível:

| Campo | Descrição |
|-------|-----------|
| 👤 Nome | Nome da conexão na UAZ |
| 📱 Número | Telefone do WhatsApp |
| 👤 Perfil | Nome do perfil do WhatsApp |
| ✅/⭕ Status | Conectada ou Desconectada |
| 🔑 Token | Token da instância (parcial) |
| 📅 Data | Quando foi criada |

---

## ✅ VALIDAÇÕES

### Sistema NÃO Importa:

❌ Instâncias já cadastradas (evita duplicação)  
❌ Instâncias sem token válido  

### Sistema Importa:

✅ Instâncias conectadas  
✅ Instâncias desconectadas  
✅ Instâncias com ou sem número  
✅ Instâncias com ou sem foto de perfil  

---

## 🎨 INTERFACE

### Botão Principal:
```
Cor: Gradiente Roxo → Rosa
Ícone: + (Plus)
Texto: "Importar Instâncias"
Estado Loading: Spinner animado
```

### Modal:
```
Título: "Importar Instâncias"
Subtítulo: "Selecione as instâncias da UAZ API para importar"
Cor: Tema escuro com bordas roxas
Tamanho: Máximo 90% da tela, responsivo
```

### Cards de Instância:
```
Normal: Borda branca/10%
Selecionado: Borda roxa + fundo roxo/10%
Hover: Scale 1.02 + borda mais clara
```

---

## 📝 CÓDIGO RELEVANTE

### Arquivos Modificados:

```
backend/src/services/uazService.js
  └─ Linha ~150: Método fetchInstances()

backend/src/routes/uaz.js
  └─ Linha ~3286: GET /fetch-instances
  └─ Linha ~3344: POST /import-instances

frontend/src/pages/configuracoes-uaz.tsx
  └─ Estados: showImportModal, availableInstances, etc
  └─ Funções: handleFetchInstances, handleImportInstances
  └─ Modal: Linha ~1260+
```

---

## 🔐 SEGURANÇA

✅ Usa `AdminToken` para buscar instâncias  
✅ Valida dados antes de importar  
✅ Não importa duplicadas  
✅ Logs detalhados de cada operação  
✅ Tratamento de erros em cada etapa  

---

## 🐛 POSSÍVEIS PROBLEMAS E SOLUÇÕES

### "Nenhuma instância disponível"
**Causa:** Todas já foram importadas  
**Solução:** Normal! Significa que está tudo sincronizado  

### "Erro ao buscar instâncias"
**Causa:** AdminToken inválido ou UAZ API fora do ar  
**Solução:** Verificar variável `UAZ_ADMIN_TOKEN` no .env  

### "Erro ao importar"
**Causa:** Instância duplicada ou dados inválidos  
**Solução:** Verificar logs do backend para detalhes  

---

## 📚 DOCUMENTAÇÃO DA UAZ API

Endpoint usado:
```bash
GET https://nettsistemas.uazapi.com/instance/fetchInstances
Header: AdminToken: [seu_token]

Response:
{
  "instances": [
    {
      "id": "r07433c48fe801f",
      "token": "3739c539-f323-47bd-...",
      "status": "connected",
      "name": "556281045992",
      "owner": "556281045992",
      "profileName": "NettCred Financeira",
      "profilePicUrl": "https://...",
      "created": "2025-11-17T23:24:55.008Z"
    }
  ]
}
```

---

## 🎓 DICAS

💡 **Importe em lote:** Selecione todas de uma vez se tiver muitas  
💡 **Verifique status:** Instâncias conectadas já funcionam imediatamente  
💡 **Organize nomes:** Renomeie depois se necessário (botão Editar)  
💡 **Sincronize perfis:** Use botão "Sincronizar" para atualizar dados  

---

## ✨ BENEFÍCIOS

✅ Economia de tempo (não precisa reconectar)  
✅ Preserva dados da instância  
✅ Interface intuitiva  
✅ Suporta múltiplas seleções  
✅ Feedback visual claro  
✅ Logs detalhados  

---

**🚀 PRONTO PARA USAR!**

Acesse `Configurações UAZ` → `Importar Instâncias` e teste agora! 🎉





