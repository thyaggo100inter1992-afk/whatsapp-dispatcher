# ⚡ Guia de Início Rápido

Comece a usar o sistema em **5 minutos**!

---

## 🚀 Instalação Rápida

### 1️⃣ Requisitos
- ✅ Node.js 18+
- ✅ PostgreSQL 14+
- ✅ Redis 6+

### 2️⃣ Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas configurações
npm run migrate
npm run dev
```

### 3️⃣ Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
```

### 4️⃣ Acessar

Abra: http://localhost:3000

---

## 📱 Primeiros Passos

### 1. Configure sua Conta WhatsApp

1. Acesse **Configurações** no menu
2. Clique em **"Adicionar Conta"**
3. Preencha os dados:
   ```
   Nome: Minha Conta
   Número: 5562999998888
   Access Token: EAAxxxxx (da Meta)
   Phone Number ID: 123456789
   Business Account ID: 987654321
   ```
4. Clique em **"Testar Conexão"**
5. Se OK, clique em **"Salvar"**

### 2. Envie sua Primeira Mensagem

1. No Dashboard, clique em **"Enviar Mensagem Imediata"**
2. Selecione sua conta
3. Digite o número do destinatário: `5562999998888`
4. Escolha um template da lista
5. Clique em **"Enviar Mensagem Agora"**

### 3. Crie sua Primeira Campanha

1. No Dashboard, clique em **"Criar Campanha"**
2. Nome: `Teste 1`
3. Adicione um template
4. Cole alguns contatos:
   ```
   5562999998888, João
   5511888887777, Maria
   ```
5. Clique em **"Iniciar Campanha Agora"**

---

## 🎯 Funcionalidades Principais

### Múltiplos Templates
```
Template 1 → Conta A → Mídia 1
Template 2 → Conta B → Mídia 2
Template 3 → Conta C → Mídia 3
```
*Sistema rotaciona automaticamente!*

### Upload de Mídia
- Arraste e solte arquivos
- Ou clique para selecionar
- Suporta: Imagem, Vídeo, Áudio, PDF

### Controle de Envio
- **Atraso entre mensagens**: 2-5 segundos
- **Pausar a cada**: 10 mensagens
- **Duração da pausa**: 60 segundos
- **Horário**: Apenas entre 8h-20h

### Personalização
```
Contato: 5562999998888, João Silva, São Paulo
Variáveis disponíveis:
- {{1}} = João Silva
- {{2}} = São Paulo
```

---

## 📊 Monitoramento

### Dashboard
- ✅ Campanhas ativas
- ✅ Mensagens enviadas hoje
- ✅ Taxa de entrega
- ✅ Contas configuradas

### Status das Mensagens
- 🕐 **Pendente**: Na fila
- ✅ **Enviada**: Entregue ao WhatsApp
- ✅ **Entregue**: Chegou no destinatário
- ✅ **Lida**: Visualizada
- ❌ **Falha**: Erro no envio

---

## 🔧 Problemas Comuns

### Backend não inicia
```bash
# Verificar se o PostgreSQL está rodando
psql -U postgres -c "SELECT version();"

# Verificar se o Redis está rodando
redis-cli ping
```

### Frontend não conecta
```bash
# Verificar se o backend está rodando
curl http://localhost:3001/api/health
```

### Erro ao enviar mensagem
- ✅ Verifique se o token está válido
- ✅ Verifique se o template existe
- ✅ Verifique se o número está correto (formato: 5562999998888)

---

## 💡 Dicas

### Performance
- Use Redis para melhor performance
- Configure múltiplas contas para distribuir carga
- Ajuste o delay entre mensagens

### Segurança
- Nunca compartilhe seu Access Token
- Use senhas fortes no PostgreSQL
- Mantenha o sistema atualizado

### Melhores Práticas
- Teste templates antes de campanhas grandes
- Use pausas para evitar bloqueios
- Monitore a taxa de entrega
- Respeite horários (8h-20h)

---

## 📚 Próximos Passos

1. ✅ Leia o **README.md** completo
2. ✅ Configure múltiplas contas
3. ✅ Crie templates no Meta Business
4. ✅ Teste com poucos contatos primeiro
5. ✅ Escale gradualmente

---

## 🆘 Precisa de Ajuda?

- 📖 [README Completo](README.md)
- 🪟 [Guia Windows](INSTALACAO_WINDOWS.md)
- 💬 Abra uma Issue no GitHub

---

**🎉 Pronto para começar! Boa sorte com seus envios!**


