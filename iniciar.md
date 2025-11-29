# 🚀 Script de Inicialização Rápida

## Windows (PowerShell)

### Passo 1: Abrir PowerShell como Administrador

### Passo 2: Instalar tudo de uma vez

```powershell
# Navegue até a pasta do projeto
cd "NOVO DISPARADOR DE API OFICIAL"

# Backend
Write-Host "📦 Instalando dependências do Backend..." -ForegroundColor Green
cd backend
npm install

# Criar .env
Write-Host "📝 Criando arquivo .env..." -ForegroundColor Green
Copy-Item env.example.txt .env

Write-Host "⚠️  IMPORTANTE: Edite o arquivo backend/.env com suas configurações!" -ForegroundColor Yellow
Write-Host "   Pressione Enter para continuar após editar..." -ForegroundColor Yellow
Read-Host

# Executar migrations
Write-Host "🗄️  Executando migrations do banco de dados..." -ForegroundColor Green
npm run migrate

# Frontend
Write-Host "📦 Instalando dependências do Frontend..." -ForegroundColor Green
cd ../frontend
npm install

# Criar .env.local
Write-Host "📝 Criando arquivo .env.local..." -ForegroundColor Green
"NEXT_PUBLIC_API_URL=http://localhost:3001" | Out-File -FilePath .env.local -Encoding utf8

Write-Host "✅ Instalação concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Para iniciar o sistema, execute:" -ForegroundColor Cyan
Write-Host "   Terminal 1: cd backend && npm run dev" -ForegroundColor White
Write-Host "   Terminal 2: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "   Acesse: http://localhost:3000" -ForegroundColor Yellow
```

---

## Linux / macOS (Bash)

### Criar script de instalação:

Crie um arquivo `instalar.sh`:

```bash
#!/bin/bash

echo "📦 Instalando dependências do Backend..."
cd backend
npm install

echo "📝 Criando arquivo .env..."
cp env.example.txt .env

echo "⚠️  IMPORTANTE: Edite o arquivo backend/.env com suas configurações!"
echo "   Pressione Enter para continuar após editar..."
read

echo "🗄️  Executando migrations do banco de dados..."
npm run migrate

echo "📦 Instalando dependências do Frontend..."
cd ../frontend
npm install

echo "📝 Criando arquivo .env.local..."
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local

echo "✅ Instalação concluída!"
echo ""
echo "🚀 Para iniciar o sistema, execute:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "   Acesse: http://localhost:3000"
```

Executar:
```bash
chmod +x instalar.sh
./instalar.sh
```

---

## 🏃 Scripts para Iniciar o Sistema

### Windows (criar arquivo `iniciar-backend.bat`):

```bat
@echo off
cd backend
npm run dev
pause
```

### Windows (criar arquivo `iniciar-frontend.bat`):

```bat
@echo off
cd frontend
npm run dev
pause
```

**Uso:** Dê duplo clique nos arquivos `.bat`

---

### Linux/macOS (criar arquivo `iniciar-backend.sh`):

```bash
#!/bin/bash
cd backend
npm run dev
```

### Linux/macOS (criar arquivo `iniciar-frontend.sh`):

```bash
#!/bin/bash
cd frontend
npm run dev
```

**Uso:**
```bash
chmod +x iniciar-backend.sh iniciar-frontend.sh
./iniciar-backend.sh &
./iniciar-frontend.sh
```

---

## 📋 Checklist Antes de Iniciar

- [ ] Node.js instalado (v18+)
- [ ] PostgreSQL instalado e rodando
- [ ] Redis instalado e rodando
- [ ] Banco de dados `whatsapp_dispatcher` criado
- [ ] Arquivo `backend/.env` configurado
- [ ] Arquivo `frontend/.env.local` configurado
- [ ] Migrations executadas (`npm run migrate`)
- [ ] Dependências instaladas (backend e frontend)

---

## 🆘 Verificações Rápidas

### Verificar Node.js:
```bash
node --version  # Deve mostrar v18 ou superior
npm --version
```

### Verificar PostgreSQL:
```bash
psql --version
psql -U postgres -c "SELECT version();"
```

### Verificar Redis:
```bash
redis-cli ping  # Deve retornar PONG
```

### Verificar se as portas estão livres:

**Windows:**
```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

**Linux/macOS:**
```bash
lsof -i :3000
lsof -i :3001
lsof -i :5432
lsof -i :6379
```

---

## 🎯 Ordem de Execução

1. **Redis** (deve estar rodando)
2. **PostgreSQL** (deve estar rodando)
3. **Backend** (`cd backend && npm run dev`)
4. **Frontend** (`cd frontend && npm run dev`)
5. **Abrir navegador** (http://localhost:3000)

---

## ✅ Tudo Funcionando?

Você deve ver:

```
Backend:
🚀 ========================================
🚀 Server running on port 3001
🚀 API: http://localhost:3001/api
🚀 Health: http://localhost:3001/api/health
🚀 ========================================

Frontend:
ready - started server on 0.0.0.0:3000
```

**Acesse: http://localhost:3000**

---

## 🐛 Problemas?

1. Verifique os logs no terminal
2. Verifique se PostgreSQL e Redis estão rodando
3. Verifique se as portas estão livres
4. Verifique se o arquivo `.env` está configurado corretamente
5. Consulte: `INSTALACAO_WINDOWS.md` ou `README.md`

---

**Boa sorte! 🚀**


