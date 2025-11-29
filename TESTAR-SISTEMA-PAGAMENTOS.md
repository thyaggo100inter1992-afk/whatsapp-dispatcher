# 🧪 COMO TESTAR O SISTEMA DE PAGAMENTOS

## ✅ BACKEND JÁ APLICADO

As migrations foram aplicadas com sucesso:
- ✅ Trial de 3 dias configurado
- ✅ Planos criados no banco
- ✅ Tabela de pagamentos criada

---

## 🚀 INICIAR O SISTEMA

### 1. Backend (Terminal 1)
```bash
cd backend
npm run dev
```

### 2. Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

---

## 🧪 PASSO A PASSO PARA TESTAR

### TESTE 1: Ver Planos Disponíveis

1. Abra o navegador:
```
http://localhost:3000/planos
```

2. **O que você deve ver:**
   - 6 planos listados (Básico, Pro, Profissional, etc)
   - Preços em destaque
   - "3 dias de trial GRÁTIS" em cada plano
   - Botão "Começar Agora" em cada card

---

### TESTE 2: Ver Status na Aba Financeiro

1. Faça login no sistema
2. Acesse:
```
http://localhost:3000/gestao
```

3. Clique na aba **"Financeiro"**

4. **O que você deve ver:**
   - Card mostrando status do seu plano
   - Se estiver em trial: "🎁 Trial Ativo - X dias restantes"
   - Botão "Fazer Upgrade"
   - Informações do plano atual

---

### TESTE 3: Banner de Trial Expirando

**Para testar o banner, você precisa estar com trial próximo de acabar.**

#### Opção A: Aguardar naturalmente (se tiver 2 dias ou menos)

#### Opção B: Simular no banco (TESTE APENAS!)

```sql
-- Conecte no PostgreSQL
psql -U postgres -d whatsapp_dispatcher

-- Ajustar trial para 2 dias (banner laranja)
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '2 days'
WHERE id = SEU_TENANT_ID;

-- Ou ajustar para 1 dia (banner vermelho - último dia)
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '1 day'
WHERE id = SEU_TENANT_ID;

-- Ou ajustar para hoje (banner vermelho - expira HOJE)
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '6 hours'
WHERE id = SEU_TENANT_ID;
```

**Depois, atualize qualquer página do sistema e o banner aparecerá no topo!**

---

### TESTE 4: Fluxo Completo de Checkout (SEM PAGAR DE VERDADE)

#### 4.1. Escolher Plano

1. Acesse:
```
http://localhost:3000/planos
```

2. Escolha um plano (ex: Profissional - R$ 197)
3. Clique em "Começar Agora"

#### 4.2. Página de Checkout

**Você será redirecionado para:**
```
http://localhost:3000/checkout?plan=profissional
```

**O que você deve ver:**
- Resumo do pedido (Plano, Valor, Trial)
- Opções de pagamento:
  - 📱 PIX (Aprovação Instantânea)
  - 📄 Boleto Bancário
- Botão "Finalizar Pagamento"

#### 4.3. Escolher PIX

1. Selecione "PIX"
2. Clique em "Finalizar Pagamento"

**O que acontece:**
- Sistema cria cobrança no Asaas
- Exibe tela com:
  - ✅ "Cobrança Criada!"
  - QR Code para escanear
  - Código PIX para copiar
  - ⚪ "Aguardando pagamento..."

#### 4.4. Escolher Boleto

1. Selecione "Boleto Bancário"
2. Clique em "Finalizar Pagamento"

**O que acontece:**
- Sistema cria cobrança no Asaas
- Exibe tela com:
  - ✅ "Cobrança Criada!"
  - Link para visualizar boleto
  - Vencimento (3 dias)

---

### TESTE 5: Simular Pagamento (Asaas Sandbox)

**ATENÇÃO:** Isso só funciona se você configurou o Asaas!

1. Acesse o **Asaas Sandbox**:
```
https://sandbox.asaas.com
```

2. Faça login

3. Vá em **"Cobranças"**

4. Encontre a cobrança que você criou

5. Clique em **"Simular Pagamento"**

6. **O que acontece automaticamente:**
   - Asaas envia webhook para seu sistema
   - Backend recebe confirmação
   - Sistema LIBERA o tenant automaticamente
   - Status muda para "Ativo"
   - Banner some
   - Card mostra "✅ Plano Ativo"

---

## 🔍 VERIFICAR NO BANCO

### Ver planos criados:
```sql
SELECT nome, slug, preco_mensal, duracao_trial_dias 
FROM plans 
ORDER BY preco_mensal;
```

### Ver status do seu tenant:
```sql
SELECT 
  nome, 
  status, 
  plano,
  trial_ends_at,
  blocked_at,
  proximo_vencimento
FROM tenants 
WHERE id = SEU_TENANT_ID;
```

### Ver cobranças criadas:
```sql
SELECT 
  id,
  valor,
  status,
  payment_type,
  due_date,
  created_at
FROM payments 
ORDER BY created_at DESC;
```

---

## 📊 ESTADOS DO SISTEMA

### Estado 1: Trial Ativo (3 dias)
```
Banner: Não aparece (>2 dias restantes)
Card: 🎁 Trial Ativo - 3 dias restantes
Botão: "Fazer Upgrade"
```

### Estado 2: Trial Acabando (2 dias)
```
Banner: 🎁 Laranja - "2 dias restantes"
Card: 🎁 Trial Ativo - 2 dias restantes
Botão: "Fazer Upgrade"
```

### Estado 3: Último Dia
```
Banner: ⚠️ Vermelho - "Trial acaba HOJE!"
Card: 🎁 Trial Ativo - 1 dia restante
Botão: "Fazer Upgrade"
```

### Estado 4: Trial Expirado (Bloqueado)
```
Banner: Não aparece
Card: 🔒 Conta Bloqueada
Botão: "Reativar Agora"
Alerta: "Será deletado em 7 dias"
```

### Estado 5: Plano Ativo
```
Banner: Não aparece
Card: ✅ Plano Profissional Ativo
Info: "Próximo vencimento: DD/MM/YYYY"
Botão: "Mudar Plano"
```

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### Erro: "Plano não encontrado"
```bash
# Verificar se planos foram criados:
cd backend
node verificar-planos.js
```

### Erro: "Sistema de pagamentos não configurado"
```bash
# Configurar Asaas:
CONFIGURAR-ASAAS-AGORA.bat

# Ou adicionar manualmente no .env:
ASAAS_API_KEY=sua_key_aqui
ASAAS_ENVIRONMENT=sandbox
```

### Banner não aparece
```bash
# Verificar trial no banco:
SELECT trial_ends_at, trial_days_remaining 
FROM tenants 
WHERE id = SEU_ID;

# Se trial_ends_at for NULL, ajustar:
UPDATE tenants 
SET trial_ends_at = NOW() + INTERVAL '2 days'
WHERE id = SEU_ID;
```

### Página de planos vazia
```bash
# Verificar console do navegador (F12)
# Verificar se backend está rodando
# Verificar se planos foram criados no banco
```

---

## ✅ CHECKLIST DE TESTES

- [ ] Backend rodando (porta 5000)
- [ ] Frontend rodando (porta 3000)
- [ ] Migrations aplicadas
- [ ] Página `/planos` carrega
- [ ] Página `/gestao` → Financeiro mostra status
- [ ] Banner aparece (se trial <= 2 dias)
- [ ] Checkout funciona (gera cobrança)
- [ ] QR Code PIX é exibido
- [ ] Link de boleto é exibido

---

## 🎉 TUDO PRONTO!

Se todos os testes passaram:
- ✅ Sistema está funcionando perfeitamente
- ✅ Frontend integrado com backend
- ✅ Pronto para produção (após configurar Asaas)

**Próximo passo:** Configurar Asaas em produção! 🚀





