# 🎓 Sistema de Tutoriais em Vídeo - IMPLEMENTADO ✅

## 📋 Visão Geral

Sistema completo para o **Super Admin** fazer upload de vídeos tutoriais explicativos da plataforma, que ficam disponíveis para todos os usuários através de cards nos dashboards.

---

## ✅ O QUE FOI IMPLEMENTADO

### 🔧 Backend

#### 1. Banco de Dados
- **Tabela:** `tutorial_videos`
- **Campos:**
  - `id` - ID único
  - `titulo` - Título do tutorial (obrigatório)
  - `descricao` - Descrição do conteúdo
  - `filename` - Nome do arquivo
  - `filepath` - Caminho no servidor
  - `file_size` - Tamanho do arquivo em bytes
  - `mime_type` - Tipo MIME do vídeo
  - `duracao` - Duração em segundos (opcional)
  - `categoria` - Categoria (ex: "Campanhas", "Templates", etc)
  - `ordem` - Ordem de exibição
  - `ativo` - Se está visível para usuários
  - `uploaded_by` - Quem fez o upload
  - `created_at` / `updated_at` - Timestamps

#### 2. Controllers
- **Admin Controller** (`backend/src/controllers/admin/tutorials.controller.js`)
  - Upload de vídeos
  - Listar todos os tutoriais
  - Atualizar informações
  - Deletar tutoriais
  - Obter tutorial específico

- **Users Controller** (`backend/src/controllers/tutorials.controller.js`)
  - Listar apenas tutoriais ativos
  - Stream de vídeo (com suporte a range requests)

#### 3. Rotas
- **Admin (Super Admin):**
  - `GET /api/admin/tutorials` - Listar todos
  - `POST /api/admin/tutorials/upload` - Upload de vídeo
  - `GET /api/admin/tutorials/:id` - Obter específico
  - `PUT /api/admin/tutorials/:id` - Atualizar
  - `DELETE /api/admin/tutorials/:id` - Deletar

- **Usuários:**
  - `GET /api/tutorials` - Listar tutoriais ativos
  - `GET /api/tutorials/stream/:id` - Fazer stream do vídeo

#### 4. Armazenamento
- **Vídeos salvos em:** `backend/uploads/tutorials/`
- **Sem uso de Cloudinary** (sem limites!)
- **Limite de upload:** 500MB por vídeo
- **Formatos aceitos:** Todos os formatos de vídeo (MP4, MOV, AVI, MKV, etc)

---

### 🎨 Frontend

#### 1. Painel do Super Admin (`/admin/tutoriais`)
**Arquivo:** `frontend/src/pages/admin/tutoriais.tsx`

**Funcionalidades:**
- ✅ Upload de vídeos com drag & drop
- ✅ Formulário completo:
  - Título (obrigatório)
  - Descrição
  - Categoria
  - Ordem de exibição
  - Status Ativo/Inativo
- ✅ Lista de tutoriais cadastrados
- ✅ Preview dos vídeos
- ✅ Editar informações (título, descrição, categoria, ordem, status)
- ✅ Ativar/Desativar tutoriais
- ✅ Deletar tutoriais (remove do banco e do servidor)
- ✅ Assistir vídeo em nova aba
- ✅ Interface moderna e responsiva

#### 2. Menu do Admin
**Arquivo:** `frontend/src/components/admin/AdminLayout.tsx`
- ✅ Novo item "🎬 Tutoriais" adicionado ao menu

#### 3. Página de Tutoriais para Usuários (`/tutoriais`)
**Arquivo:** `frontend/src/pages/tutoriais.tsx`

**Funcionalidades:**
- ✅ Grid com cards de todos os tutoriais ativos
- ✅ Filtro por categoria
- ✅ Thumbnail do vídeo em cada card
- ✅ Informações: título, categoria, descrição
- ✅ Modal de reprodução ao clicar
- ✅ Player de vídeo com controles completos
- ✅ Design moderno com gradientes
- ✅ Responsivo (mobile, tablet, desktop)
- ✅ Botão "Voltar ao Início"

#### 4. Cards nos Dashboards
**Arquivos modificados:**
- `frontend/src/pages/dashboard-oficial.tsx`
- `frontend/src/pages/dashboard-uaz.tsx`

**Card adicionado:**
- 🎬 **Tutoriais**
- Ícone: FaVideo (laranja)
- Descrição: "Vídeos explicativos"
- Redireciona para: `/tutoriais`

---

## 🚀 COMO USAR

### Para o Super Admin:

#### 1. **Acessar Painel de Tutoriais**
```
http://localhost:3000/admin/tutoriais
```

#### 2. **Fazer Upload de Vídeo**
1. Preencha o formulário:
   - **Título:** Nome do tutorial (obrigatório)
   - **Categoria:** Ex: "Campanhas", "Templates", "API Oficial"
   - **Descrição:** Explique o conteúdo do vídeo
   - **Ordem:** Número para ordenação (0 = primeiro)
   - **Ativo:** Marque para ficar visível aos usuários
2. Clique em "Selecionar Vídeo"
3. Escolha o arquivo de vídeo (MP4, MOV, AVI, etc)
4. Aguarde o upload (pode demorar dependendo do tamanho)
5. ✅ Pronto! Vídeo disponível!

#### 3. **Gerenciar Tutoriais**
- **Ativar/Desativar:** Clique no botão "👁️ Ativar" ou "🚫 Desativar"
- **Editar:** Clique em "✏️ Editar" → Altere os dados → "✅ Salvar"
- **Deletar:** Clique em "🗑️ Deletar" → Confirme
- **Assistir:** Clique em "▶️ Assistir" para ver o vídeo

---

### Para os Usuários:

#### 1. **Acessar Tutoriais**

**Opção A - Pelo Dashboard:**
- Entre no Dashboard (API Oficial ou QR Connect)
- Clique no card "🎬 **Tutoriais**"

**Opção B - Direto pela URL:**
```
http://localhost:3000/tutoriais
```

#### 2. **Assistir Vídeos**
1. Veja todos os tutoriais disponíveis em cards
2. Use o filtro de categoria (se disponível)
3. Clique no card do tutorial desejado
4. Modal abre com o vídeo em tela cheia
5. Use os controles para play/pause, volume, tela cheia
6. Clique no ❌ para fechar

---

## 📂 Estrutura de Arquivos

### Backend:
```
backend/
├── src/
│   ├── controllers/
│   │   ├── admin/
│   │   │   └── tutorials.controller.js     ✅ CRUD Admin
│   │   └── tutorials.controller.js         ✅ Listagem e Stream
│   └── routes/
│       ├── admin/
│       │   └── tutorials.routes.js         ✅ Rotas Admin
│       ├── tutorials.routes.js             ✅ Rotas Usuários
│       └── index.ts                        ✅ Registro das rotas
├── uploads/
│   └── tutorials/                          📹 Vídeos armazenados aqui
├── criar-tabela-tutoriais.sql              📄 SQL da tabela
├── aplicar-tabela-tutoriais.js             🔧 Script Node.js
└── APLICAR-TABELA-TUTORIAIS.bat            ▶️ Executável Windows
```

### Frontend:
```
frontend/
└── src/
    ├── pages/
    │   ├── admin/
    │   │   └── tutoriais.tsx               🎬 Painel Admin
    │   ├── tutoriais.tsx                   👥 Página usuários
    │   ├── dashboard-oficial.tsx           ✅ Card adicionado
    │   └── dashboard-uaz.tsx               ✅ Card adicionado
    └── components/
        └── admin/
            └── AdminLayout.tsx             ✅ Menu atualizado
```

---

## 🔧 INSTALAÇÃO

### 1. Criar Tabela no Banco de Dados

**Opção A - Windows (Recomendado):**
```bash
cd backend
APLICAR-TABELA-TUTORIAIS.bat
```

**Opção B - Manual:**
```bash
cd backend
node aplicar-tabela-tutoriais.js
```

**Opção C - SQL Direto:**
Execute o conteúdo de `backend/criar-tabela-tutoriais.sql` no seu banco PostgreSQL.

### 2. Reiniciar Backend
```bash
# Na pasta backend
npm run dev
```

### 3. Reiniciar Frontend
```bash
# Na pasta frontend
npm run dev
```

---

## 🎯 Recursos Implementados

### ✅ Super Admin:
- ✅ Upload de vídeos até 500MB
- ✅ Gerenciar título, descrição e categoria
- ✅ Controlar ordem de exibição
- ✅ Ativar/desativar tutoriais
- ✅ Editar informações sem reenviar vídeo
- ✅ Deletar tutoriais (remove arquivo físico)
- ✅ Preview e assistir vídeos
- ✅ Interface drag & drop
- ✅ Validações (apenas vídeos, título obrigatório)

### ✅ Usuários:
- ✅ Ver todos os tutoriais ativos
- ✅ Filtrar por categoria
- ✅ Cards visuais com preview
- ✅ Modal de reprodução
- ✅ Player com controles completos
- ✅ Streaming otimizado (range requests)
- ✅ Responsivo (mobile/tablet/desktop)
- ✅ Acesso rápido pelos dashboards

---

## 🔒 Segurança

### Admin:
- ✅ Apenas **Super Admins** podem acessar `/admin/tutoriais`
- ✅ Middleware `requireSuperAdmin` protege todas as rotas admin
- ✅ Validação de tipo de arquivo (apenas vídeos)
- ✅ Limite de tamanho (500MB)

### Usuários:
- ✅ Apenas usuários autenticados podem ver tutoriais
- ✅ Apenas tutoriais com `ativo = true` são exibidos
- ✅ Vídeos servidos com streaming seguro

---

## 🎨 Design

### Cores utilizadas:
- **Super Admin:** Roxo/Rosa (gradiente)
- **Card Tutoriais:** Laranja (destaque)
- **Modal de vídeo:** Preto/Gradiente

### Ícones:
- 🎬 FaVideo - Tutoriais
- 📤 FaUpload - Upload
- ✏️ FaEdit - Editar
- 🗑️ FaTrash - Deletar
- ▶️ FaPlayCircle - Play
- 👁️ FaEye / 🚫 FaEyeSlash - Ativar/Desativar

---

## 📊 Benefícios

### Para o Negócio:
- ✅ **Sem custos de Cloudinary** - Vídeos no próprio servidor
- ✅ **Sem limites de armazenamento** - Só depende do servidor
- ✅ **Reduz suporte** - Usuários aprendem sozinhos
- ✅ **Onboarding mais rápido** - Novos usuários se adaptam mais rápido

### Para os Usuários:
- ✅ **Acesso fácil** - Cards direto no dashboard
- ✅ **Aprendizado visual** - Melhor que texto
- ✅ **Categorizado** - Encontra o que precisa rápido
- ✅ **Sempre disponível** - Pode revisar quando quiser

---

## 🚨 Importante

### Antes de Colocar em Produção:

1. **Configure o servidor web** para servir vídeos grandes:
   - Nginx: `client_max_body_size 500M;`
   - Apache: `php_value upload_max_filesize 500M`

2. **Verifique espaço em disco** no servidor

3. **Considere CDN** se tiver muitos acessos simultâneos

4. **Backup dos vídeos** periodicamente

---

## 📝 Exemplos de Uso

### Sugestões de Tutoriais:

#### Campanhas:
- "Como criar sua primeira campanha"
- "Agendamento de campanhas"
- "Rotação de instâncias"
- "Pausar e retomar campanhas"

#### Templates:
- "Criando templates com botões"
- "Templates com carrossel"
- "Variáveis dinâmicas em templates"

#### API Oficial:
- "Configurar credenciais WhatsApp Business"
- "Conectar conta oficial"
- "Envio imediato de mensagens"

#### QR Connect:
- "Como gerar QR Code"
- "Conectar WhatsApp Web"
- "Criar campanha QR"

#### Base de Dados:
- "Importar contatos via Excel"
- "Edição em massa de perfis"
- "Consultar CPF - Nova Vida"

---

## 🎉 Resultado Final

**Super Admin** tem controle total dos vídeos tutoriais através de uma interface moderna e intuitiva. **Usuários** têm acesso fácil aos tutoriais através de cards nos dashboards, podendo aprender a usar a plataforma de forma visual e prática, sem depender de suporte!

---

## 🆘 Troubleshooting

### Erro ao fazer upload:
- Verifique se a pasta `backend/uploads/tutorials/` existe
- Verifique permissões de escrita
- Confirme que o arquivo é um vídeo válido
- Veja se não excedeu 500MB

### Vídeo não carrega:
- Verifique se o vídeo está marcado como "Ativo"
- Confirme que o arquivo existe em `backend/uploads/tutorials/`
- Teste o stream direto: `http://localhost:3001/api/tutorials/stream/{ID}`

### Card não aparece no dashboard:
- Confirme que o usuário tem permissão de acesso
- Verifique se há tutoriais ativos no banco
- Limpe o cache do navegador (Ctrl+F5)

---

**🎊 Sistema de Tutoriais 100% Funcional!** 🎊





