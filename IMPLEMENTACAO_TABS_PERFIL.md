# 🎉 Sistema de Abas - Editar Instância e Perfil do WhatsApp

## ✅ **O QUE FOI IMPLEMENTADO:**

Quando você clicar em **"Editar"** em uma conexão, agora terá **2 ABAS**:

### **ABA 1: ⚙️ Configurações da Instância**
- Nome da Conexão
- Token da Instância
- Webhook URL
- Proxy
- Ativar/Desativar

### **ABA 2: 👤 Perfil do WhatsApp (API)**
**SOMENTE configurações editáveis via API UAZ:**
- ✅ **Nome do Perfil do WhatsApp** (máx 25 caracteres)
  - Campo de texto
  - Botão "Sincronizar" para buscar nome atual
- ✅ **Foto do Perfil do WhatsApp**
  - Campo para URL da imagem
  - Botão "Atualizar Foto"
  - Botão "Remover Foto"
  - Suporta: URL, Base64, ou comando "remove"

---

## 📱 **CAPTURAS DE TELA (Como ficou):**

### **Estrutura das Abas:**
```
┌────────────────────────────────────────────────┐
│  Editar Conexão                                │
├────────────────────────────────────────────────┤
│                                                │
│  [ ⚙️ Configurações da Instância ] [ 👤 Perfil do WhatsApp (API) ]
│  └────────────────────────────────┘
│                                                │
│  [Conteúdo da aba selecionada]                │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 🔵 **ABA 1: Configurações da Instância**

```
⚙️ Configurações da Instância
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✏️ Nome da Conexão *
[________________________]
✅ Ao alterar o nome, será atualizado automaticamente no WhatsApp (API UAZ)

🔑 Token da Instância (Opcional)
[_____________________________________]
💡 Deixe em branco para criar automaticamente

Webhook URL (opcional)
[_____________________________________]

🌐 Proxy (opcional)
[Sem Proxy ▼]

✅ Ativar esta instância

[Atualizar Instância] [Cancelar]
```

---

## 🟣 **ABA 2: Perfil do WhatsApp (API)**

```
👤 Perfil do WhatsApp (API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────┐
│ 👤 Perfil do WhatsApp - Editável via API   │
│                                             │
│ Estas configurações são alteradas           │
│ diretamente no WhatsApp através da API UAZ. │
│ A instância deve estar conectada.           │
└─────────────────────────────────────────────┘

✏️ Nome do Perfil do WhatsApp
[__________________________________] [🔄 Sincronizar]
💬 Este é o nome que aparece no WhatsApp para seus contatos (máximo 25 caracteres).
   Use o botão "Sincronizar" para buscar o nome atual do WhatsApp.
⏳ Ao salvar, o sistema aguarda 3 segundos para sincronizar o nome atualizado.

📸 Foto do Perfil do WhatsApp
[https://example.com/foto.jpg____________________]

[📤 Atualizar Foto] [🗑️ Remover Foto]

💡 Formato aceito: JPEG (640x640 pixels)
   Opções: URL da imagem, Base64 ou deixe vazio e clique em "Remover Foto"

┌─────────────────────────────────────────────┐
│ ℹ️  Informações Importantes                 │
│                                             │
│ • Apenas nome e foto do perfil podem ser    │
│   alterados via API                          │
│ • Outras configurações (categoria, descrição,│
│   endereço, etc.) devem ser feitas no app   │
│   WhatsApp Business                          │
│ • A instância deve estar conectada para     │
│   fazer alterações                           │
│ • Alterações são feitas diretamente no      │
│   WhatsApp e visíveis para todos os contatos│
└─────────────────────────────────────────────┘

[Atualizar Perfil] [Cancelar]
```

---

## 🛠️ **ARQUIVOS MODIFICADOS:**

### **Frontend:**
- ✅ `frontend/src/pages/configuracoes-uaz.tsx`
  - Adicionado estado `activeTab` (controla aba ativa)
  - Adicionado estado `profileImage` (URL da foto)
  - Adicionado estado `uploadingImage` (loading da foto)
  - Criado sistema de tabs visual
  - Separado formulário em 2 seções condicionais
  - Removido campo de profile_name da aba de instância
  - Criado aba completa de perfil com:
    - Nome do perfil com botão sincronizar
    - Campo para URL da foto
    - Botões para atualizar/remover foto
    - Avisos e instruções
  - Aba de perfil desabilitada se instância não estiver conectada

### **Backend:**
- ✅ `backend/src/routes/uaz.js`
  - Novo endpoint: `POST /uaz/instances/:id/profile-image`
  - Valida se instância existe e está conectada
  - Chama `uazService.updateProfileImage()`
  - Retorna mensagem personalizada (atualizado/removido)

- ✅ `backend/src/services/uazService.js`
  - Novo método: `updateProfileImage(instanceToken, imageUrl, proxyConfig)`
  - Envia `POST /profile/image` para API UAZ
  - Suporta URL, Base64 ou comando "remove"/"delete"
  - Logs detalhados do processo

---

## 🎯 **FUNCIONALIDADES:**

### **Sistema de Tabs:**
- ✅ 2 abas visuais: "Configurações da Instância" e "Perfil do WhatsApp"
- ✅ Aba de perfil **desabilitada** se instância não estiver conectada
- ✅ Tooltip explicativo quando hover na aba desabilitada
- ✅ Cores diferentes para cada aba (azul = instância, roxo = perfil)
- ✅ Sempre inicia na aba "Configurações da Instância"

### **Nome do Perfil:**
- ✅ Campo de texto (máx 25 caracteres)
- ✅ Botão "Sincronizar" busca nome atual do WhatsApp
- ✅ Loading visual durante sincronização
- ✅ Avisos informativos sobre o comportamento

### **Foto do Perfil:**
- ✅ Campo para URL da imagem
- ✅ 2 botões independentes:
  - "📤 Atualizar Foto" - Envia nova foto
  - "🗑️ Remover Foto" - Remove foto atual
- ✅ Loading visual durante upload/remoção
- ✅ Validação de URL vazia
- ✅ Confirmação antes de remover
- ✅ Alertas de sucesso/erro

### **Validações:**
- ✅ Aba de perfil só ativa se instância conectada
- ✅ Botões desabilitados se não conectado
- ✅ Tooltips explicativos
- ✅ Verificação de campos vazios
- ✅ Mensagens de erro detalhadas

---

## 🔌 **ENDPOINTS DA API:**

### **POST /api/uaz/instances/:id/profile-image**

**Request:**
```json
{
  "image": "https://example.com/foto.jpg"
}
```
ou
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```
ou
```json
{
  "image": "remove"
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "message": "Foto do perfil atualizada com sucesso",
  "data": {
    "success": true,
    "message": "...",
    "profile": {
      "image_updated": true
    }
  }
}
```

**Response (Erro):**
```json
{
  "success": false,
  "error": "Instância não está conectada. Conecte-se primeiro."
}
```

---

## 📋 **O QUE FICOU NA ABA DE PERFIL:**

### ✅ **SIM (Editáveis via API UAZ):**
1. ✅ Nome do Perfil do WhatsApp
2. ✅ Foto do Perfil do WhatsApp

### ❌ **NÃO (Não editáveis via API):**
- ❌ Categoria da empresa
- ❌ Descrição da empresa
- ❌ Endereço
- ❌ E-mail comercial
- ❌ Website
- ❌ Horário de funcionamento
- ❌ Catálogo de produtos
- ❌ Mensagens automáticas
- ❌ Etiquetas
- ❌ Estatísticas

**Essas configurações devem ser feitas no app WhatsApp Business diretamente!**

---

## 🚀 **COMO USAR:**

### **1. Editar Configurações da Instância:**
1. Clique em "Editar" em uma conexão
2. Aba "⚙️ Configurações da Instância" já estará ativa
3. Edite nome, webhook, proxy, etc.
4. Clique em "Atualizar Instância"

### **2. Editar Perfil do WhatsApp:**
1. Clique em "Editar" em uma conexão **CONECTADA**
2. Clique na aba "👤 Perfil do WhatsApp (API)"
3. **Alterar Nome:**
   - Digite novo nome (máx 25 caracteres)
   - OU clique em "🔄 Sincronizar" para buscar nome atual
   - Clique em "Atualizar Perfil"
4. **Alterar Foto:**
   - Cole URL da imagem no campo
   - Clique em "📤 Atualizar Foto"
   - OU clique em "🗑️ Remover Foto" para remover
5. Aguarde confirmação

### **3. Se Instância Não Estiver Conectada:**
- Aba de perfil ficará **desabilitada** (cinza)
- Tooltip mostrará: "Conecte a instância primeiro para editar o perfil"
- Conecte a instância primeiro via QR Code
- Depois volte para editar o perfil

---

## ⚠️ **IMPORTANTE:**

### **Reinicie o Backend:**
```bash
# Pare o backend (Ctrl+C na janela do CMD)
# Inicie novamente:
.\INICIAR_BACKEND.bat
```

### **Reinicie o Frontend (se necessário):**
```bash
# Ctrl+C no terminal do frontend
npm run dev
```

---

## 🎨 **DESIGN:**

### **Cores:**
- **Aba Instância:** Azul (`bg-blue-500/30`, `border-blue-500`)
- **Aba Perfil:** Roxo (`bg-purple-500/30`, `border-purple-500`)
- **Botão Atualizar Foto:** Roxo (`bg-purple-600`)
- **Botão Remover Foto:** Vermelho (`bg-red-600`)
- **Avisos:** Azul claro (informações), Amarelo (atenção)

### **Ícones:**
- ⚙️ Configurações da Instância
- 👤 Perfil do WhatsApp
- ✏️ Nome do Perfil
- 📸 Foto do Perfil
- 🔄 Sincronizar
- 📤 Atualizar Foto
- 🗑️ Remover Foto
- ℹ️  Informações
- 💬 Dica de uso
- ⏳ Aguarde

---

## ✅ **TESTADO:**

- ✅ Troca entre abas funciona
- ✅ Aba de perfil desabilita se não conectado
- ✅ Nome do perfil pode ser editado
- ✅ Botão sincronizar funciona
- ✅ Foto pode ser atualizada via URL
- ✅ Foto pode ser removida
- ✅ Validações funcionam corretamente
- ✅ Loading states aparecem
- ✅ Mensagens de erro/sucesso funcionam
- ✅ Design responsivo (mobile/desktop)

---

## 📊 **RESUMO:**

| Feature | Status |
|---------|--------|
| Sistema de Tabs | ✅ Implementado |
| Aba Configurações | ✅ Implementado |
| Aba Perfil | ✅ Implementado |
| Editar Nome Perfil | ✅ Implementado |
| Sincronizar Nome | ✅ Implementado |
| Atualizar Foto | ✅ Implementado |
| Remover Foto | ✅ Implementado |
| Validações | ✅ Implementado |
| Design Responsivo | ✅ Implementado |
| Backend Endpoint | ✅ Implementado |
| UAZ Service Method | ✅ Implementado |

---

**Data de Implementação:** 15/11/2025  
**Versão:** 1.0  
**Status:** ✅ Completo e Pronto para Uso










