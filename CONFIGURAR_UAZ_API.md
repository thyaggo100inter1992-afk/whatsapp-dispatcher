# 🔧 Como Configurar a UAZ API

## ❌ Problema Identificado

```
UAZ_API_URL: undefined
UAZ_ADMIN_TOKEN: NÃO configurado
Porta 8081: Nada rodando
```

**Resultado:** Campanhas QR Connect não conseguem enviar mensagens.

---

## ✅ Solução

### **PASSO 1: Iniciar a UAZ API**

Se você já tem a UAZ API instalada:

```bash
cd /caminho/da/uaz-api
npm start
```

Ou se usar Docker:

```bash
docker run -p 8081:8081 -d --name uaz-api uaz/api
```

---

### **PASSO 2: Adicionar no .env**

Abra o arquivo `backend/.env` e adicione:

```env
# UAZ API Configuration
UAZ_API_URL=http://localhost:8081
UAZ_ADMIN_TOKEN=seu_token_admin_aqui
```

**Onde encontrar o Admin Token:**
- Se você instalou a UAZ, verifique o arquivo `.env` dela
- Ou veja na documentação da instalação
- Geralmente é um UUID como: `b59b9ec5-6965-467e-9642-6e600988ac11`

---

### **PASSO 3: Reiniciar o Backend**

```bash
cd backend
npm run stop-backend
npm run start-backend
```

---

### **PASSO 4: Testar**

```bash
cd backend
npx ts-node test-uaz-direct.ts
```

---

## 🌐 Se a UAZ API estiver em outro servidor

Se a UAZ estiver rodando em outro servidor/porta:

```env
# Exemplo: UAZ em outra porta
UAZ_API_URL=http://localhost:3000

# Exemplo: UAZ em outro servidor
UAZ_API_URL=http://192.168.1.100:8081

# Exemplo: UAZ em servidor externo
UAZ_API_URL=https://uaz.seudominio.com
```

---

## 📦 Se NÃO tem a UAZ API instalada

### **Opção A: Instalar UAZ API**

1. Clone o repositório:
```bash
git clone https://github.com/unkind709/uaz.git
cd uaz
```

2. Instale dependências:
```bash
npm install
```

3. Configure:
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

4. Inicie:
```bash
npm start
```

5. Anote a porta e o admin token

---

### **Opção B: Usar Evolution API**

Se você está usando **Evolution API** ao invés de UAZ:

```env
# Evolution API Configuration
UAZ_API_URL=http://localhost:8080
UAZ_ADMIN_TOKEN=seu_api_key_evolution
```

---

### **Opção C: Usar Baileys Direto**

Se prefere usar Baileys sem intermediários, podemos adaptar o código.

---

## 🧪 Verificar se está funcionando

Após configurar:

```bash
# Verificar se a porta está aberta
netstat -an | findstr :8081

# Testar conexão
curl http://localhost:8081/instance/status -H "AdminToken: seu_token"

# Ou use o script de teste
cd backend
npx ts-node test-uaz-direct.ts
```

---

## ❓ Qual API você está usando?

- [ ] UAZ API (https://github.com/unkind709/uaz)
- [ ] Evolution API (https://evolution-api.com/)
- [ ] Baileys direto
- [ ] Outra (qual?)

**Me informe qual você está usando** para eu adaptar a configuração correta! 🚀







