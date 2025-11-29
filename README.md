# 🚀 Sistema de Disparo em Massa - WhatsApp API Oficial

Sistema completo para envio de mensagens em massa usando a **API Oficial do WhatsApp Business**. Criado com Node.js, PostgreSQL, Redis, React e Next.js.

![Banner](https://img.shields.io/badge/WhatsApp-API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)

---

## ✨ Funcionalidades

### 📱 Gerenciamento de Contas WhatsApp
- ✅ Adicionar múltiplas contas WhatsApp Business API
- ✅ Testar conexão antes de salvar
- ✅ Ativar/Desativar contas
- ✅ Buscar templates aprovados automaticamente

### 📅 Campanhas em Massa
- ✅ Criar campanhas programadas ou imediatas
- ✅ **Múltiplos templates** em rotação
- ✅ **Múltiplos números de origem** (rotação automática)
- ✅ **Upload de mídias** (imagem, vídeo, áudio, documentos)
- ✅ Agendamento com data/hora específica
- ✅ Controle de horário de funcionamento
- ✅ Sistema de pausas automáticas
- ✅ Atraso configurável entre mensagens
- ✅ Importação de contatos (copiar/colar)
- ✅ Personalização com variáveis

### 💬 Envio Imediato
- ✅ Enviar mensagens individuais instantaneamente
- ✅ Buscar templates por nome
- ✅ Excluir templates específicos da lista
- ✅ Upload de mídia para mensagens individuais
- ✅ Preview de templates antes do envio

### 📊 Monitoramento
- ✅ Dashboard com estatísticas em tempo real
- ✅ Status de envio: Enviado, Entregue, Lido, Falha
- ✅ Progresso de campanhas ao vivo
- ✅ Logs detalhados de cada mensagem
- ✅ Estimativa de tempo de envio

### 🔧 Recursos Técnicos
- ✅ Sistema de filas inteligente (Bull Queue)
- ✅ WebSocket para atualizações em tempo real
- ✅ Retry automático em caso de falhas
- ✅ Banco de dados PostgreSQL robusto
- ✅ Redis para cache e filas
- ✅ Interface moderna e responsiva

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** + **TypeScript**
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados
- **Redis** - Cache e filas
- **Bull** - Gerenciamento de filas
- **Socket.IO** - Comunicação em tempo real
- **Axios** - Requisições HTTP
- **Multer** - Upload de arquivos

### Frontend
- **React** + **Next.js**
- **TypeScript**
- **Tailwind CSS** - Estilização
- **React Icons** - Ícones
- **React Dropzone** - Upload de arquivos
- **Socket.IO Client** - Atualizações em tempo real
- **date-fns** - Manipulação de datas

---

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado:

- **Node.js** (v18 ou superior) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 ou superior) - [Download](https://www.postgresql.org/download/)
- **Redis** (v6 ou superior) - [Download](https://redis.io/download/)
- **Conta WhatsApp Business API** - [Meta for Developers](https://developers.facebook.com/)

---

## 🚀 Instalação Local

### 1️⃣ Clone o Repositório

```bash
git clone <url-do-repositorio>
cd "NOVO DISPARADOR DE API OFICIAL"
```

### 2️⃣ Configurar o Backend

```bash
# Entrar na pasta do backend
cd backend

# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env
```

**Edite o arquivo `.env` com suas configurações:**

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_dispatcher
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui

# Redis (para filas)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=sua_chave_secreta_super_segura_aqui

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 3️⃣ Criar o Banco de Dados

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar o banco de dados
CREATE DATABASE whatsapp_dispatcher;

# Sair do psql
\q

# Executar as migrations
npm run migrate
```

### 4️⃣ Iniciar o Backend

```bash
# Modo desenvolvimento
npm run dev

# Ou modo produção
npm run build
npm start
```

**✅ Backend rodando em: http://localhost:3001**

---

### 5️⃣ Configurar o Frontend

Em **outro terminal**:

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências
npm install

# Criar arquivo .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
```

### 6️⃣ Iniciar o Frontend

```bash
# Modo desenvolvimento
npm run dev

# Ou modo produção
npm run build
npm start
```

**✅ Frontend rodando em: http://localhost:3000**

---

## 🎯 Como Usar

### 1️⃣ Configurar Conta WhatsApp

1. Acesse: http://localhost:3000/configuracoes
2. Clique em **"Adicionar Conta"**
3. Preencha os dados da sua conta WhatsApp Business API:
   - **Nome**: Ex: "Atendimento Principal"
   - **Número**: Ex: 5562817429510
   - **Access Token**: Token da Meta
   - **Phone Number ID**: ID do número
   - **Business Account ID**: ID da conta business
4. Clique em **"Testar Conexão"** para validar
5. Clique em **"Salvar"**

### 2️⃣ Criar uma Campanha

1. No Dashboard, clique em **"Criar Campanha"**
2. Preencha o **nome da campanha**
3. **Adicione Templates:**
   - Clique em "Adicionar Template"
   - Selecione o número de origem
   - Escolha o template
   - (Opcional) Faça upload de uma mídia
   - Repita para adicionar mais templates
4. **Cole os contatos** (um por linha):
   ```
   5562999998888, João Silva
   5511888887777, Maria Santos
   5521777776666, Pedro Costa
   ```
5. Configure o **agendamento** (opcional)
6. Ajuste os **controles de pausa**
7. Clique em **"Iniciar Campanha"** ou **"Agendar"**

### 3️⃣ Enviar Mensagem Imediata

1. No Dashboard, clique em **"Enviar Mensagem Imediata"**
2. Selecione o **número de origem**
3. Digite o **número do destinatário**
4. Busque e selecione um **template**
5. (Opcional) Faça upload de uma **mídia**
6. Clique em **"Enviar Mensagem Agora"**

---

## 📱 Obtendo Credenciais do WhatsApp

### Passo a Passo:

1. Acesse: https://developers.facebook.com/
2. Crie um **App** (tipo: Business)
3. Adicione o produto **WhatsApp**
4. Configure um número de telefone
5. Obtenha as credenciais:
   - **Access Token**: Nas configurações do App
   - **Phone Number ID**: Na seção WhatsApp > Getting Started
   - **Business Account ID**: Na seção WhatsApp > Settings

### Links Úteis:
- [Documentação WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Como criar templates](https://business.facebook.com/wa/manage/message-templates/)
- [Guia de primeiros passos](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

## 🐳 Instalação com Docker (Opcional)

```bash
# Criar arquivo docker-compose.yml (já incluído)
docker-compose up -d

# Backend: http://localhost:3001
# Frontend: http://localhost:3000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

---

## 📊 Estrutura do Projeto

```
📁 NOVO DISPARADOR DE API OFICIAL/
├── 📁 backend/
│   ├── src/
│   │   ├── config/          # Configurações
│   │   ├── controllers/     # Controladores
│   │   ├── database/        # Conexão e migrations
│   │   ├── middlewares/     # Middlewares
│   │   ├── models/          # Models do banco
│   │   ├── routes/          # Rotas da API
│   │   ├── services/        # Serviços (WhatsApp, Filas)
│   │   └── server.ts        # Servidor principal
│   ├── package.json
│   └── tsconfig.json
├── 📁 frontend/
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── pages/           # Páginas Next.js
│   │   ├── services/        # Chamadas API
│   │   └── styles/          # Estilos globais
│   ├── package.json
│   └── next.config.js
└── README.md
```

---

## 🔒 Segurança

- ✅ Tokens armazenados de forma segura no banco
- ✅ Validações de entrada em todas as rotas
- ✅ Rate limiting para evitar abuso
- ✅ CORS configurado corretamente
- ✅ Logs de todas as operações

---

## 🚀 Deploy em Produção

### Backend (Sugestões):
- **Heroku**
- **DigitalOcean**
- **AWS EC2**
- **Railway**
- **Render**

### Frontend (Sugestões):
- **Vercel** (Recomendado para Next.js)
- **Netlify**
- **AWS Amplify**

### Banco de Dados:
- **Heroku Postgres**
- **AWS RDS**
- **DigitalOcean Managed Database**
- **Supabase**

### Redis:
- **Redis Cloud**
- **AWS ElastiCache**
- **DigitalOcean Managed Redis**

---

## 🐛 Problemas Comuns

### Erro de conexão com o banco
```bash
# Verificar se o PostgreSQL está rodando
sudo systemctl status postgresql

# Iniciar PostgreSQL
sudo systemctl start postgresql
```

### Erro de conexão com Redis
```bash
# Verificar se o Redis está rodando
redis-cli ping

# Iniciar Redis
redis-server
```

### Porta já em uso
```bash
# Verificar processos na porta 3001
lsof -i :3001

# Matar processo
kill -9 <PID>
```

---

## 📝 Licença

Este projeto está sob a licença MIT.

---

## 👨‍💻 Autor

Desenvolvido com ❤️ para facilitar o envio de mensagens em massa via WhatsApp API Oficial.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um Fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abrir um Pull Request

---

## 📞 Suporte

Em caso de dúvidas ou problemas:

- Abra uma **Issue** no GitHub
- Consulte a [documentação oficial do WhatsApp](https://developers.facebook.com/docs/whatsapp)

---

**⭐ Se este projeto foi útil para você, deixe uma estrela no GitHub!**


