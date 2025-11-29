# 🚀 Configurações Avançadas da Conta WhatsApp - Documentação

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Migração do Banco de Dados](#migração-do-banco-de-dados)
3. [Funcionalidades Implementadas](#funcionalidades-implementadas)
4. [Como Usar](#como-usar)
5. [Integração com Facebook Business](#integração-com-facebook-business)
6. [Solução de Problemas](#solução-de-problemas)

---

## 🎯 Visão Geral

Foi implementado um **sistema completo de configurações avançadas** para cada conta WhatsApp API. Agora você pode gerenciar todas as configurações da API diretamente pelo sistema, incluindo:

- ✅ **Perfil do Negócio** (foto, descrição, email, endereço)
- ✅ **Segurança** (PIN de verificação em duas etapas)
- ✅ **Analytics** (em desenvolvimento)
- ✅ **Webhooks** (em desenvolvimento)
- ✅ **Catálogo de Produtos** (em desenvolvimento)
- ✅ **Financeiro** (integração com Facebook Business)
- ✅ **Avançado** (QR Code, Health Check)

---

## 🗄️ Migração do Banco de Dados

### ⚠️ IMPORTANTE: Execute a migração antes de usar!

**Arquivo de Migração:** `backend/src/database/migrations/add_facebook_integration_fields.sql`

### Como executar:

#### **Opção 1: Via pgAdmin**
1. Abra o **pgAdmin**
2. Conecte ao banco de dados `whatsapp_dispatcher`
3. Abra o **Query Tool** (F5)
4. Cole o conteúdo do arquivo `add_facebook_integration_fields.sql`
5. Execute (F5)

#### **Opção 2: Via linha de comando**
```bash
psql -U postgres -d whatsapp_dispatcher -f backend/src/database/migrations/add_facebook_integration_fields.sql
```

### O que a migração faz:
```sql
-- Adiciona campos para integração com Facebook Business
ALTER TABLE whatsapp_accounts 
ADD COLUMN IF NOT EXISTS facebook_access_token TEXT,
ADD COLUMN IF NOT EXISTS facebook_ad_account_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS facebook_business_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;
```

---

## 🎨 Funcionalidades Implementadas

### 1️⃣ **Aba: Básico**
**Visualização de informações da conta:**
- Nome da conta
- Número do WhatsApp
- Phone Number ID (com botão de copiar)
- Status da conta

### 2️⃣ **Aba: Perfil**
**Gerenciamento completo do perfil de negócio:**
- ✅ **Upload de Foto de Perfil** (JPG/PNG, máx 5MB)
- ✅ **Sobre** (About) - até 139 caracteres
- ✅ **Descrição Completa** - até 512 caracteres
- ✅ **Email de Contato**
- ✅ **Endereço**

**Endpoints Backend:**
- `GET /api/whatsapp-accounts/:id/profile` - Buscar perfil
- `POST /api/whatsapp-accounts/:id/profile` - Atualizar perfil
- `POST /api/whatsapp-accounts/:id/profile-photo` - Upload de foto

### 3️⃣ **Aba: Segurança**
**Configuração de Verificação em Duas Etapas (2FA):**
- ✅ Configurar PIN de 6 dígitos
- ✅ Confirmação do PIN
- ✅ Validação automática

**Endpoint Backend:**
- `POST /api/whatsapp-accounts/:id/two-step-pin` - Configurar PIN

⚠️ **ATENÇÃO:** Guarde o PIN em local seguro! Será necessário para reconectar a conta.

### 4️⃣ **Aba: Analytics**
**Relatórios e Analytics da conta:**
- 📊 Em desenvolvimento
- Endpoint preparado: `GET /api/whatsapp-accounts/:id/analytics`

### 5️⃣ **Aba: Webhooks**
**Configurações de Webhook:**
- 🔔 Em desenvolvimento

### 6️⃣ **Aba: Catálogo**
**Gerenciamento de Catálogo de Produtos:**
- 🛒 Em desenvolvimento

### 7️⃣ **Aba: Financeiro**
**Integração com Facebook Business Manager:**
- ✅ Configurar integração (Token, Ad Account ID, Business ID)
- ✅ Armazenamento seguro (criptografia AES-256)
- 📊 Relatórios financeiros (em desenvolvimento)

**Endpoints Backend:**
- `POST /api/whatsapp-accounts/:id/facebook-integration` - Configurar integração
- `GET /api/whatsapp-accounts/:id/facebook-billing` - Buscar dados de cobrança

### 8️⃣ **Aba: Avançado**
**Ferramentas avançadas:**
- ✅ **QR Code** - Gerar QR Code da conta
- ✅ **Health Check** - Verificar saúde da conta (quality rating, messaging limit tier, etc)

**Endpoints Backend:**
- `GET /api/whatsapp-accounts/:id/qrcode` - Gerar QR Code
- `GET /api/whatsapp-accounts/:id/health` - Health Check

---

## 🎮 Como Usar

### **Passo 1: Acessar as Configurações**
1. Vá em **Configurações** (menu lateral)
2. Na lista de contas, clique no botão **"Configurar"** (roxo) da conta desejada

### **Passo 2: Navegar pelas Abas**
- Clique nas abas no topo da página
- Cada aba tem suas próprias configurações

### **Passo 3: Exemplos de Uso**

#### **Alterar Foto de Perfil:**
1. Vá na aba **"Perfil"**
2. Clique em **"Escolher arquivo"**
3. Selecione uma imagem JPG ou PNG (máx 5MB)
4. Clique em **"Upload"**
5. Aguarde a confirmação ✅

#### **Configurar PIN de Segurança:**
1. Vá na aba **"Segurança"**
2. Digite um PIN de 6 dígitos numéricos
3. Confirme o PIN
4. Clique em **"Alterar PIN"**
5. ⚠️ **GUARDE O PIN EM LOCAL SEGURO!**

#### **Gerar QR Code:**
1. Vá na aba **"Avançado"**
2. Clique em **"Gerar QR Code"**
3. O QR Code aparecerá na tela

#### **Verificar Saúde da Conta:**
1. Vá na aba **"Avançado"**
2. Clique em **"Verificar Saúde"**
3. Veja o status da conta (quality rating, messaging limit tier, etc)

---

## 💰 Integração com Facebook Business

### **O que é?**
Integração com o **Facebook Business Manager** para acessar:
- 💵 Informações financeiras detalhadas
- 📊 Relatórios de gastos por período
- 📈 Análise de custos por categoria
- 💳 Gestão de pagamentos

### **Como Obter o Token do Facebook**

#### **Opção 1: User Access Token (temporário)**
1. Acesse: https://developers.facebook.com/tools/explorer
2. Selecione seu app
3. Clique em **"Generate Access Token"**
4. Permita as permissões:
   - `business_management`
   - `ads_read`
   - `ads_management`
5. Copie o token gerado

#### **Opção 2: System User Token (RECOMENDADO - permanente)**
1. Vá em **Facebook Business Manager**
2. **Business Settings** → **Users** → **System Users**
3. Clique em **"Add"** para criar um System User
4. Atribua permissões:
   - **Finance Analyst** ou **Finance Editor**
   - Acesso à conta de anúncios
5. Clique em **"Generate New Token"**
6. Selecione permissões:
   - `business_management`
   - `ads_read`
   - `ads_management`
7. Copie o token (ele não expira!)

### **Como Configurar no Sistema**
1. Vá na aba **"Financeiro"**
2. Cole o **Facebook Access Token**
3. Informe o **Ad Account ID** (formato: `act_XXXXXXXXXX`)
   - Encontre em: Facebook Ads Manager → Configurações da Conta
4. Informe o **Business ID**
   - Encontre em: Business Settings → Info do Negócio
5. Clique em **"Salvar Integração"**
6. ✅ Pronto! A integração está configurada.

### **Segurança**
- ✅ Token armazenado com **criptografia AES-256**
- ✅ Chave de criptografia configurável via `.env`
- ✅ Nunca exposto na API de resposta

---

## 🛠️ Solução de Problemas

### **Erro: "Nenhum arquivo enviado" ao fazer upload de foto**
- Certifique-se de selecionar um arquivo JPG ou PNG
- Tamanho máximo: 5MB

### **Erro: "PIN deve ter 6 dígitos numéricos"**
- O PIN deve conter exatamente 6 números (0-9)
- Exemplo válido: `123456`

### **Erro: "Integração com Facebook não configurada"**
- Configure primeiro na aba **"Financeiro"**
- Verifique se o token está correto

### **Erro: "Token do Facebook inválido"**
- Gere um novo token no Facebook
- Certifique-se de ter as permissões corretas

### **QR Code não aparece**
- Aguarde alguns segundos após clicar
- Verifique se a conta está ativa
- Teste a conexão na página de Configurações

### **Health Check mostra "unhealthy"**
- Verifique se o Access Token está válido
- Teste a conexão da conta
- Entre em contato com o suporte do WhatsApp Business

---

## 📦 Arquivos Criados/Modificados

### **Backend**
- ✅ `backend/src/controllers/whatsapp-settings.controller.ts` (NOVO)
- ✅ `backend/src/routes/index.ts` (MODIFICADO)
- ✅ `backend/src/database/migrations/add_facebook_integration_fields.sql` (NOVO)
- ✅ `backend/uploads/temp/` (NOVO DIRETÓRIO)

### **Frontend**
- ✅ `frontend/src/pages/configuracoes/conta/[id].tsx` (NOVO)
- ✅ `frontend/src/pages/configuracoes.tsx` (MODIFICADO - botão "Configurar")

---

## 🎯 Próximos Passos (Desenvolvimento Futuro)

### **Analytics (Aba Analytics)**
- [ ] Gráficos de conversas
- [ ] Estatísticas de mensagens
- [ ] Análise de performance

### **Webhooks (Aba Webhooks)**
- [ ] Configurar URL do webhook
- [ ] Testar webhook
- [ ] Logs de eventos

### **Catálogo (Aba Catálogo)**
- [ ] Listar produtos
- [ ] Adicionar produtos
- [ ] Editar/remover produtos

### **Financeiro (Aba Financeiro)**
- [ ] Dashboard de gastos
- [ ] Gráficos de custos
- [ ] Relatórios detalhados
- [ ] Gestão de pagamentos

---

## ✅ Checklist de Instalação

- [ ] Executar migração do banco de dados
- [ ] Reiniciar o backend (`cd backend && npm start`)
- [ ] Reiniciar o frontend (`cd frontend && npm run dev`)
- [ ] Configurar variável `ENCRYPTION_KEY` no `.env` (opcional)
- [ ] Testar upload de foto de perfil
- [ ] Testar configuração de PIN
- [ ] Testar QR Code
- [ ] Testar Health Check
- [ ] Testar integração com Facebook (opcional)

---

## 📞 Suporte

Se precisar de ajuda ou encontrar algum problema:
1. Verifique esta documentação
2. Consulte os logs do backend
3. Consulte os logs do frontend (F12 no navegador)

---

**✨ Sistema criado com sucesso!**
**🚀 Agora você tem controle total das configurações da sua conta WhatsApp API!**


