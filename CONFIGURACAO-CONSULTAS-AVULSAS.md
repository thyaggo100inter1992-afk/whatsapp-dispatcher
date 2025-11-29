# 📦 Configuração Padrão de Consultas Avulsas

## 🎯 Objetivo

Definir configuração padrão global de **Pacotes** e **Faixas de Preço** para consultas avulsas, aplicável a todos os tenants do sistema, com regra de compra mínima de 100 consultas para quantidade personalizada.

---

## 📊 Configuração Implementada

### 1. **Pacotes Pré-Definidos**

| Ordem | Nome          | Quantidade | Preço Total | Preço/Unidade | Desconto | Destaque |
|-------|---------------|------------|-------------|---------------|----------|----------|
| 1     | Básico        | 50         | R$ 5,00     | R$ 0,10       | 0%       | -        |
| 2     | Intermediário | 100        | R$ 9,00     | R$ 0,09       | 20% OFF  | ⭐ Popular |
| 3     | Avançado      | 200        | R$ 16,00    | R$ 0,08       | 33% OFF  | -        |
| 4     | Profissional  | 300        | R$ 21,00    | R$ 0,07       | 40% OFF  | -        |

### 2. **Faixas de Preço (Quantidade Personalizada)**

| Ordem | Faixa          | Preço por Consulta |
|-------|----------------|--------------------|
| 1     | 1-300          | R$ 0,08            |
| 2     | 301-600        | R$ 0,07            |
| 3     | 601-999        | R$ 0,07            |
| 4     | 1000+          | R$ 0,06            |

### 3. **⚠️ REGRA IMPORTANTE**

**Compra por quantidade personalizada (usando faixas de preço) só é permitida ACIMA DE 100 CONSULTAS.**

Para quantidades menores, o cliente deve escolher um dos **pacotes pré-definidos**.

---

## 🔧 Arquivos Modificados

### **Backend**

1. **`backend/migrations/update_consultas_defaults.sql`**
   - Migration SQL que define os pacotes e faixas padrão
   - Limpa dados antigos e insere a nova configuração

2. **`backend/aplicar-configuracao-padrao-consultas.js`**
   - Script Node.js para aplicar a migration
   - Executa e exibe resultado formatado no console

3. **`backend/src/controllers/consultas-avulsas.controller.ts`**
   - **LINHA 154**: Adiciona validação de tipo de compra (`pacote` ou `personalizada`)
   - **LINHA 192-201**: Valida quantidade mínima de 100 para compra personalizada
   ```typescript
   const MIN_QUANTIDADE_FAIXA = 100;
   if (tipo === 'personalizada' && quantidade < MIN_QUANTIDADE_FAIXA) {
     return res.status(400).json({
       success: false,
       message: `Para quantidade personalizada, o mínimo é ${MIN_QUANTIDADE_FAIXA} consultas...`
     });
   }
   ```

### **Frontend**

4. **`frontend/src/pages/comprar-consultas.tsx`**
   - **LINHA 121-156**: Adiciona validação no frontend
   - Bloqueia compra personalizada abaixo de 100 consultas
   - Exibe mensagem clara ao usuário
   - Passa parâmetro `tipo: 'personalizada'` para o backend
   ```typescript
   const MIN_QUANTIDADE_PERSONALIZADA = 100;
   if (quantidade < MIN_QUANTIDADE_PERSONALIZADA) {
     alert(`⚠️ Quantidade Personalizada Bloqueada\n\n` +
           `Para quantidade personalizada, o mínimo é ${MIN_QUANTIDADE_PERSONALIZADA} consultas.\n\n` +
           `💡 Dica: Escolha um dos pacotes pré-definidos acima para quantidades menores!`);
     return;
   }
   ```

---

## 🚀 Como Aplicar

### **1. Executar Migration (já executada)**

```bash
cd backend
node aplicar-configuracao-padrao-consultas.js
```

**Output esperado:**
```
🔧 ========================================
🔧 APLICAR CONFIGURAÇÃO PADRÃO
🔧 Pacotes e Faixas de Consultas Avulsas
🔧 ========================================

✅ CONFIGURAÇÃO APLICADA COM SUCESSO!

📦 PACOTES CONFIGURADOS:
   1. Básico           |  50 consultas | R$   5.00 | R$ 0.10/un | 0% OFF
   2. Intermediário    | 100 consultas | R$   9.00 | R$ 0.09/un | 20% OFF ⭐ POPULAR
   3. Avançado         | 200 consultas | R$  16.00 | R$ 0.08/un | 33% OFF
   4. Profissional     | 300 consultas | R$  21.00 | R$ 0.07/un | 40% OFF

💰 FAIXAS DE PREÇO CONFIGURADAS:
   1.    1-300  consultas | R$ 0.08/consulta
   2.  301-600  consultas | R$ 0.07/consulta
   3.  601-999  consultas | R$ 0.07/consulta
   4. 1000-∞    consultas | R$ 0.06/consulta

⚠️  REGRA IMPORTANTE:
   Compra por quantidade personalizada (faixa)
   só é permitida ACIMA DE 100 CONSULTAS
```

### **2. Reiniciar Backend**

```bash
# Se estiver rodando, reinicie o backend para aplicar as alterações no código
npm run dev
```

---

## 🧪 Como Testar

### **Teste 1: Pacotes Pré-Definidos**
1. Acesse a página de compra de consultas
2. ✅ Visualize os 4 pacotes (Básico, Intermediário, Avançado, Profissional)
3. ✅ "Intermediário" deve aparecer como **⭐ Popular**
4. ✅ Clique em qualquer pacote e confirme a compra

### **Teste 2: Quantidade Personalizada (VÁLIDA)**
1. Digite uma quantidade **≥ 100** (ex: 150)
2. ✅ Sistema deve calcular o preço automaticamente
3. ✅ Permita gerar o QR Code PIX

### **Teste 3: Quantidade Personalizada (INVÁLIDA)**
1. Digite uma quantidade **< 100** (ex: 50, 75, 99)
2. ❌ Sistema deve exibir alerta:
   ```
   ⚠️ Quantidade Personalizada Bloqueada
   
   Para quantidade personalizada, o mínimo é 100 consultas.
   
   💡 Dica: Escolha um dos pacotes pré-definidos acima para quantidades menores!
   ```
3. ✅ Compra não deve ser permitida

### **Teste 4: Backend Validation**
1. Tente burlar o frontend fazendo POST direto à API:
   ```bash
   POST /api/consultas-avulsas/comprar
   {
     "quantidade": 50,
     "valor": 4.00,
     "tipo": "personalizada"
   }
   ```
2. ❌ Backend deve retornar erro 400:
   ```json
   {
     "success": false,
     "message": "Para quantidade personalizada, o mínimo é 100 consultas..."
   }
   ```

---

## 📊 Estrutura de Dados

### **Tabela: `consultas_avulsas_pacotes`**
```sql
CREATE TABLE consultas_avulsas_pacotes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  quantidade INTEGER NOT NULL,
  preco DECIMAL(10, 2) NOT NULL,
  preco_unitario DECIMAL(10, 2) GENERATED ALWAYS AS (preco / quantidade) STORED,
  desconto INTEGER DEFAULT 0,
  popular BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Tabela: `consultas_faixas_preco`**
```sql
CREATE TABLE consultas_faixas_preco (
  id SERIAL PRIMARY KEY,
  quantidade_min INTEGER NOT NULL,
  quantidade_max INTEGER,  -- NULL = sem limite
  preco_unitario DECIMAL(10, 2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🌍 Escopo Global

**IMPORTANTE:** 
- ✅ As tabelas **NÃO** têm `tenant_id`
- ✅ Configuração é **GLOBAL** (compartilhada por todos os tenants)
- ✅ Todos os tenants veem os mesmos pacotes e faixas
- ✅ Administrador pode gerenciar via painel admin (`/admin/pacotes-consultas` e `/admin/faixas-preco-consultas`)

---

## 🎨 Interface do Usuário

### **Página de Compra**

```
┌─────────────────────────────────────────────┐
│  📦 Pacotes Pré-Definidos                   │
├─────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────────┐             │
│  │ Básico  │  │Intermediário │ ⭐ POPULAR  │
│  │ 50      │  │ 100          │             │
│  │ R$ 5,00 │  │ R$ 9,00      │ 20% OFF     │
│  └─────────┘  └──────────────┘             │
│                                             │
│  ┌─────────┐  ┌──────────────┐             │
│  │Avançado │  │Profissional  │             │
│  │ 200     │  │ 300          │             │
│  │R$ 16,00 │  │ R$ 21,00     │ 40% OFF     │
│  └─────────┘  └──────────────┘             │
├─────────────────────────────────────────────┤
│  💎 Quantidade Personalizada                │
│  ⚠️  Mínimo: 100 consultas                  │
│                                             │
│  [ Digite quantidade... ]  [Comprar]        │
└─────────────────────────────────────────────┘
```

---

## 🔐 Validação em Camadas

| Camada | Validação | Mensagem |
|--------|-----------|----------|
| **Frontend** | Bloqueia input < 100 | ⚠️ Quantidade Personalizada Bloqueada... |
| **Backend** | Valida tipo + quantidade | Para quantidade personalizada, o mínimo é 100... |

---

## 📅 Data da Implementação

**25 de Novembro de 2025**

---

## ✅ Status

- ✅ Migration criada e aplicada
- ✅ Backend validado
- ✅ Frontend validado
- ✅ Testado com sucesso
- ✅ Documentação completa

---

**Versão:** 1.0  
**Autor:** Sistema Multi-Tenant  
**Tipo:** Configuração Global




