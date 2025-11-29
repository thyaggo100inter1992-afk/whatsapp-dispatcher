# 📡 EXEMPLOS DE USO DA API DE PAGAMENTOS

## 🔍 1. LISTAR PLANOS DISPONÍVEIS

```javascript
// Frontend - Mostrar planos na página de preços

const response = await fetch('http://localhost:5000/api/payments/plans', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();

// Resultado:
{
  "success": true,
  "plans": [
    {
      "id": 1,
      "nome": "Básico",
      "slug": "basico",
      "descricao": "Ideal para começar",
      "preco_mensal": 97.00,
      "preco_anual": 970.00,
      "limite_usuarios": 3,
      "limite_instancias_whatsapp": 1,
      "limite_mensagens_mes": 5000,
      "recursos": {
        "api_acesso": false,
        "relatorios_avancados": false,
        "suporte_prioritario": false
      }
    },
    {
      "id": 2,
      "nome": "Profissional",
      "slug": "profissional",
      "preco_mensal": 197.00,
      "limite_usuarios": 10,
      "limite_instancias_whatsapp": 3,
      "limite_mensagens_mes": 20000,
      "recursos": {
        "api_acesso": true,
        "relatorios_avancados": true,
        "suporte_prioritario": true
      }
    }
  ]
}

// Como usar no frontend:
data.plans.forEach(plan => {
  console.log(`${plan.nome}: R$ ${plan.preco_mensal}`);
});
```

---

## 📊 2. VER STATUS DO MEU PAGAMENTO

```javascript
// Ver se estou em trial, quantos dias restam, etc.

const response = await fetch('http://localhost:5000/api/payments/status', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();

// Resultado (em trial):
{
  "success": true,
  "tenant": {
    "status": "trial",
    "plano": "basico",
    "plano_nome": "Básico",
    "preco_mensal": 97.00,
    "is_trial": true,
    "is_blocked": false,
    "trial_ends_at": "2024-11-27T10:00:00Z",
    "trial_days_remaining": 2
  },
  "last_payment": null
}

// Resultado (ativo com pagamento):
{
  "success": true,
  "tenant": {
    "status": "active",
    "plano": "profissional",
    "plano_nome": "Profissional",
    "preco_mensal": 197.00,
    "is_trial": false,
    "is_blocked": false,
    "proximo_vencimento": "2024-12-27"
  },
  "last_payment": {
    "id": 123,
    "valor": 197.00,
    "status": "confirmed",
    "payment_type": "BOLETO",
    "paid_at": "2024-11-25T15:30:00Z"
  }
}

// Resultado (bloqueado):
{
  "success": true,
  "tenant": {
    "status": "blocked",
    "is_trial": false,
    "is_blocked": true,
    "blocked_at": "2024-11-24T00:00:00Z",
    "will_be_deleted_at": "2024-12-01T00:00:00Z",
    "days_until_deletion": 7
  },
  "last_payment": {
    "status": "overdue"
  }
}

// Como usar no frontend:
if (data.tenant.is_trial) {
  showBanner(`Você tem ${data.tenant.trial_days_remaining} dias de trial`);
}

if (data.tenant.is_blocked) {
  showAlert('Sua conta está bloqueada. Faça o pagamento para reativar.');
}
```

---

## 💳 3. CRIAR COBRANÇA (BOLETO)

```javascript
// Cliente escolhe plano Profissional e quer pagar com Boleto

const response = await fetch('http://localhost:5000/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    plan_slug: 'profissional',
    billing_type: 'BOLETO'
  })
});

const data = await response.json();

// Resultado:
{
  "success": true,
  "message": "Cobrança criada com sucesso",
  "payment": {
    "id": 123,
    "valor": 197.00,
    "due_date": "2024-11-27",
    "payment_type": "BOLETO",
    "invoice_url": "https://www.asaas.com/i/abc123",
    "bank_slip_url": "https://www.asaas.com/b/abc123",
    "pix_qr_code": null,
    "pix_copy_paste": null
  },
  "plan": {
    "nome": "Profissional",
    "preco": 197.00
  }
}

// Como usar no frontend:
if (data.success) {
  // Redirecionar para página de pagamento
  window.open(data.payment.bank_slip_url, '_blank');
  
  // Ou exibir boleto inline
  showBoleto(data.payment.bank_slip_url);
  
  // Mostrar mensagem
  alert(`Boleto gerado! Valor: R$ ${data.payment.valor}`);
}
```

---

## 📱 4. CRIAR COBRANÇA (PIX)

```javascript
// Cliente escolhe PIX

const response = await fetch('http://localhost:5000/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    plan_slug: 'profissional',
    billing_type: 'PIX'
  })
});

const data = await response.json();

// Resultado:
{
  "success": true,
  "payment": {
    "id": 124,
    "valor": 197.00,
    "payment_type": "PIX",
    "pix_qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSU...",
    "pix_copy_paste": "00020126580014br.gov.bcb.pix..."
  }
}

// Como usar no frontend:
if (data.success) {
  // Mostrar QR Code
  document.getElementById('qrcode').src = data.payment.pix_qr_code;
  
  // Mostrar código copia e cola
  document.getElementById('pixCode').value = data.payment.pix_copy_paste;
  
  // Botão copiar
  copyButton.onclick = () => {
    navigator.clipboard.writeText(data.payment.pix_copy_paste);
    alert('Código PIX copiado!');
  };
}
```

---

## 🔔 5. WEBHOOK (BACKEND RECEBE AUTOMATICAMENTE)

```javascript
// Este endpoint é chamado pelo Asaas automaticamente
// Você NÃO precisa chamar manualmente

// Quando cliente paga, Asaas envia:
POST http://seu-dominio.com/api/payments/webhook

{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_abc123",
    "customer": "cus_xyz789",
    "value": 197.00,
    "status": "CONFIRMED",
    "billingType": "BOLETO",
    "confirmedDate": "2024-11-25T15:30:00Z"
  }
}

// Sistema processa automaticamente:
// 1. Busca pagamento no banco
// 2. Atualiza status para 'confirmed'
// 3. Libera tenant (status = 'active')
// 4. Atualiza próximo vencimento (+30 dias)
// 5. Atualiza limites do plano

// Cliente pode fazer login novamente! ✅
```

---

## 🎨 EXEMPLO DE TELA DE CHECKOUT

```javascript
// Página de Checkout React/Vue/Angular

function CheckoutPage() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingType, setBillingType] = useState('BOLETO');
  
  // 1. Carregar planos
  useEffect(() => {
    fetch('/api/payments/plans', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setPlans(data.plans));
  }, []);
  
  // 2. Criar cobrança
  const handleCheckout = async () => {
    const response = await fetch('/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        plan_slug: selectedPlan,
        billing_type: billingType
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (billingType === 'BOLETO') {
        // Abrir boleto em nova aba
        window.open(data.payment.bank_slip_url, '_blank');
      } else if (billingType === 'PIX') {
        // Mostrar QR Code
        setPixData(data.payment);
        showPixModal();
      }
    }
  };
  
  return (
    <div>
      <h1>Escolha seu Plano</h1>
      
      {plans.map(plan => (
        <div key={plan.id} className="plan-card">
          <h2>{plan.nome}</h2>
          <p>R$ {plan.preco_mensal}/mês</p>
          <ul>
            <li>{plan.limite_usuarios} usuários</li>
            <li>{plan.limite_instancias_whatsapp} instâncias</li>
            <li>{plan.limite_mensagens_mes} mensagens/mês</li>
          </ul>
          <button onClick={() => setSelectedPlan(plan.slug)}>
            Escolher
          </button>
        </div>
      ))}
      
      {selectedPlan && (
        <div className="payment-method">
          <h3>Forma de Pagamento</h3>
          <label>
            <input 
              type="radio" 
              value="BOLETO"
              checked={billingType === 'BOLETO'}
              onChange={(e) => setBillingType(e.target.value)}
            />
            Boleto Bancário
          </label>
          <label>
            <input 
              type="radio" 
              value="PIX"
              checked={billingType === 'PIX'}
              onChange={(e) => setBillingType(e.target.value)}
            />
            PIX (Aprovação Instantânea)
          </label>
          
          <button onClick={handleCheckout}>
            Finalizar Pagamento
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🚨 EXEMPLO DE ALERTA DE TRIAL

```javascript
// Exibir alerta quando trial estiver acabando

function TrialAlert() {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetch('/api/payments/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setStatus(data.tenant));
  }, []);
  
  if (!status || !status.is_trial) return null;
  
  if (status.trial_days_remaining <= 1) {
    return (
      <div className="alert alert-danger">
        ⚠️ Seu trial expira em {status.trial_days_remaining} dia(s)!
        <button onClick={() => window.location.href = '/checkout'}>
          Fazer Upgrade Agora
        </button>
      </div>
    );
  }
  
  return (
    <div className="alert alert-info">
      ℹ️ Você tem {status.trial_days_remaining} dias de trial restantes
    </div>
  );
}
```

---

## 🔒 EXEMPLO DE BLOQUEIO

```javascript
// Verificar se conta está bloqueada

function CheckBlocked() {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetch('/api/payments/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setStatus(data.tenant);
      
      // Se bloqueado, redirecionar para checkout
      if (data.tenant.is_blocked) {
        alert('Sua conta está bloqueada. Faça o pagamento para reativar.');
        window.location.href = '/checkout';
      }
    });
  }, []);
  
  return null;
}
```

---

## 📧 EMAILS AUTOMÁTICOS (TODO - Opcional)

```javascript
// Você pode implementar envio de emails em:

// 1. Após criar cobrança:
async createPayment(req, res) {
  // ... criar cobrança ...
  
  // Enviar email
  await sendEmail({
    to: tenant.email,
    subject: 'Pagamento Gerado - Boleto/PIX',
    html: `
      <h1>Seu pagamento foi gerado!</h1>
      <p>Valor: R$ ${payment.valor}</p>
      <p>Vencimento: ${payment.due_date}</p>
      <a href="${payment.invoice_url}">Ver Boleto</a>
    `
  });
}

// 2. No webhook (pagamento confirmado):
async handleWebhook(req, res) {
  // ... liberar tenant ...
  
  // Enviar email
  await sendEmail({
    to: tenant.email,
    subject: 'Pagamento Confirmado! 🎉',
    html: `
      <h1>Bem-vindo de volta!</h1>
      <p>Seu pagamento foi confirmado.</p>
      <p>Sua conta está ativa até ${proximo_vencimento}</p>
      <a href="https://seusite.com">Acessar Sistema</a>
    `
  });
}
```

---

## ✅ RESUMO

### Endpoints Disponíveis:
- `GET /api/payments/plans` - Listar planos
- `GET /api/payments/status` - Ver status
- `POST /api/payments/create` - Criar cobrança
- `POST /api/payments/webhook` - Webhook Asaas (automático)

### Fluxo Completo:
1. Frontend lista planos
2. Cliente escolhe plano
3. Frontend cria cobrança
4. Cliente paga
5. Asaas envia webhook
6. Backend libera automaticamente
7. Cliente volta a usar

**SIMPLES ASSIM!** 🚀





