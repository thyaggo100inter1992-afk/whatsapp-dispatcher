# 🎨 Frontend - WhatsApp API Dispatcher

Frontend da aplicação construído com React, Next.js e Tailwind CSS.

---

## 📋 Estrutura

```
frontend/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── Layout.tsx           # Layout principal
│   │   └── MediaUpload.tsx      # Upload de mídia
│   ├── pages/             # Páginas Next.js
│   │   ├── index.tsx            # Dashboard
│   │   ├── configuracoes.tsx    # Config de contas
│   │   ├── campanhas.tsx        # Lista de campanhas
│   │   ├── campanha/
│   │   │   └── criar.tsx        # Criar campanha
│   │   └── mensagem/
│   │       └── enviar.tsx       # Enviar mensagem
│   ├── services/          # Chamadas API
│   │   └── api.ts               # Axios configurado
│   └── styles/            # Estilos
│       └── globals.css          # Estilos globais
├── public/                # Arquivos públicos
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 🚀 Instalação

```bash
npm install
```

---

## ⚙️ Configuração

Crie o arquivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🏃 Executar

### Desenvolvimento:
```bash
npm run dev
```

### Produção:
```bash
npm run build
npm start
```

---

## 🎨 Páginas

### Dashboard (/)
- Visão geral do sistema
- Botões principais: Criar Campanha e Enviar Imediata
- Estatísticas rápidas

### Configurações (/configuracoes)
- CRUD completo de contas WhatsApp
- Testar conexão
- Ativar/Desativar contas
- Buscar templates

### Criar Campanha (/campanha/criar)
- Nome da campanha
- Múltiplos templates
- Múltiplos números de origem
- Upload de múltiplas mídias
- Lista de contatos (copiar/colar)
- Agendamento
- Controles de pausa
- Estimativa de tempo

### Enviar Mensagem (/mensagem/enviar)
- Seleção de conta
- Número do destinatário
- Busca de templates
- Upload de mídia
- Envio imediato

### Campanhas (/campanhas)
- Lista de todas as campanhas
- Status e progresso
- Estatísticas detalhadas
- Link para detalhes

---

## 🎨 Temas e Cores

### Paleta de Cores (Tailwind):
```css
primary: Verde (#2bb381)
dark: Verde escuro (#1a2f28)
blue: Azul (#3b82f6)
green: Verde claro (#22c55e)
red: Vermelho (#ef4444)
```

### Componentes Customizados:
- `.btn` - Botões
- `.btn-primary` - Botão primário
- `.btn-secondary` - Botão secundário
- `.btn-danger` - Botão de perigo
- `.card` - Card
- `.input` - Input
- `.badge` - Badge

---

## 📦 Dependências Principais

- **next** - Framework React
- **react** - Biblioteca UI
- **tailwindcss** - Estilização
- **axios** - Requisições HTTP
- **react-dropzone** - Upload de arquivos
- **react-icons** - Ícones
- **date-fns** - Manipulação de datas
- **socket.io-client** - WebSocket

---

## 🔄 Comunicação com Backend

### API Service (`src/services/api.ts`):
```typescript
import { whatsappAccountsAPI, campaignsAPI, messagesAPI, uploadAPI } from '@/services/api';

// Exemplo de uso:
const accounts = await whatsappAccountsAPI.getAll();
```

### Endpoints disponíveis:
- `whatsappAccountsAPI.*`
- `campaignsAPI.*`
- `messagesAPI.*`
- `uploadAPI.*`

---

## 🎯 Features Implementadas

### Upload de Mídia
- Drag and drop
- Preview de imagens
- Validação de tipo
- Validação de tamanho
- Suporte: Imagem, Vídeo, Áudio, PDF

### Filtros de Template
- Buscar por nome
- Excluir templates específicos
- Categorização (UTILITY, MARKETING, etc)

### Validações
- Campos obrigatórios
- Formato de telefone
- Tamanho de arquivo
- Tipos de arquivo permitidos

---

## 🧪 Desenvolvimento

### Adicionar nova página:
```tsx
// pages/nova-pagina.tsx
export default function NovaPagina() {
  return <div>Conteúdo</div>;
}
```

### Adicionar novo componente:
```tsx
// components/MeuComponente.tsx
export default function MeuComponente() {
  return <div>Componente</div>;
}
```

### Chamada API:
```typescript
import { api } from '@/services/api';

const response = await api.get('/endpoint');
```

---

## 🎨 Customização

### Mudar cores:
Edite `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#sua-cor',
      }
    }
  }
}
```

### Adicionar fonte:
Edite `pages/_document.tsx`:
```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
```

---

## 🐳 Docker

```bash
docker build -t whatsapp-frontend .
docker run -p 3000:3000 whatsapp-frontend
```

---

## 📝 Notas

- Next.js usa Server-Side Rendering (SSR)
- Páginas em `pages/` são rotas automáticas
- Componentes em `components/` são reutilizáveis
- Tailwind CSS é utility-first
- TypeScript para type safety

---

## 🔧 Scripts

```bash
npm run dev       # Desenvolvimento
npm run build     # Build para produção
npm start         # Iniciar produção
npm run lint      # Linter
```

---

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)


