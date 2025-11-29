# ⚙️ CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE

## 📄 Criar arquivo `.env.local`

Crie um arquivo chamado `.env.local` na raiz da pasta `frontend` com o seguinte conteúdo:

```bash
# API Backend URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 🔧 Configurações Disponíveis

### `NEXT_PUBLIC_API_URL`
- **Descrição:** URL base da API backend
- **Padrão:** `http://localhost:3000/api`
- **Exemplos:**
  - Desenvolvimento local: `http://localhost:3000/api`
  - Produção: `https://api.minhaempresa.com/api`
  - Backend em outra porta: `http://localhost:5000/api`

## 📝 Exemplo Completo

```bash
# .env.local

# ========================================
# API Backend Configuration
# ========================================
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Se estiver rodando o backend em Docker ou outro host:
# NEXT_PUBLIC_API_URL=http://192.168.1.100:3000/api
```

## 🚀 Como Usar

1. **Crie o arquivo:**
```bash
cd frontend
copy CONFIGURAR-ENV.md .env.local
# Ou no Linux/Mac: cp CONFIGURAR-ENV.md .env.local
```

2. **Edite o `.env.local`** com os valores corretos

3. **Reinicie o servidor Next.js:**
```bash
npm run dev
```

## ⚠️ IMPORTANTE

- O arquivo `.env.local` está no `.gitignore` e não será commitado
- Variáveis que começam com `NEXT_PUBLIC_` ficam disponíveis no browser
- Nunca exponha secrets ou tokens privados em variáveis `NEXT_PUBLIC_`
- Sempre reinicie o servidor após alterar variáveis de ambiente

## 🔐 Segurança

- ✅ Use `NEXT_PUBLIC_` apenas para URLs públicas
- ❌ NUNCA use `NEXT_PUBLIC_` para API keys secretas
- ✅ Secrets devem ficar no backend

## 📚 Documentação

Mais informações: https://nextjs.org/docs/basic-features/environment-variables





