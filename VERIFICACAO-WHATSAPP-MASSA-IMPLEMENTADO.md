# 📱 Verificação de WhatsApp em Massa - Sistema Nova Vida

## ✅ Sistema Implementado com Sucesso!

Este documento explica como funciona o novo sistema de verificação de WhatsApp em massa para consultas da Nova Vida.

---

## 🎯 Funcionalidades Implementadas

### 1. **Checkbox de Ativação/Desativação**
- ✅ Opção para **ativar/desativar** a verificação de WhatsApp
- ✅ Ativo por padrão para maior conveniência
- ✅ Quando desativado, não consome créditos de verificação

### 2. **Delay Configurável**
- ⏱️ Campo para configurar **delay entre verificações**
- ⏱️ Padrão: **3 segundos** (proteção contra banimento)
- ⏱️ Máximo: **60 segundos**
- ⏱️ Recomendado: **2-5 segundos** para alta carga

### 3. **Rotação Inteligente de Instâncias**
- 🔄 **Busca instâncias ativas** antes de CADA verificação
- 🔄 **Remove automaticamente** instâncias que ficarem inativas
- 🔄 **Reintegra automaticamente** instâncias que voltarem a ficar ativas
- 🔄 **Round-robin** (rotação circular) entre todas as instâncias ativas
- 🔄 **Para automaticamente** se não houver instâncias ativas

### 4. **Proteção Anti-Banimento**
- 🛡️ Delay obrigatório entre verificações
- 🛡️ Distribuição da carga entre múltiplas instâncias
- 🛡️ Logs detalhados para monitoramento

---

## 📋 Como Aplicar a Atualização do Banco de Dados

### **Opção 1: Via Script Batch (Windows)**

```bash
APLICAR-ATUALIZAR-TABELA-NOVAVIDA-WHATSAPP.bat
```

### **Opção 2: Via SQL Direto**

1. Abra o arquivo `ATUALIZAR-TABELA-NOVAVIDA-WHATSAPP.sql`
2. Execute no PostgreSQL:

```bash
psql -U postgres -d "gestao-disparador" -f ATUALIZAR-TABELA-NOVAVIDA-WHATSAPP.sql
```

### **Opção 3: Via pgAdmin**

1. Abra o pgAdmin
2. Conecte ao banco `gestao-disparador`
3. Abra o Query Tool
4. Cole o conteúdo de `ATUALIZAR-TABELA-NOVAVIDA-WHATSAPP.sql`
5. Execute (F5)

---

## 🚀 Como Usar o Novo Sistema

### **1. Acesse a Consulta em Massa**

Navegue para: **Funções Extras** → **Consultar Dados** → **Aba "Consulta em Massa"**

### **2. Configure a Verificação de WhatsApp**

```
┌─────────────────────────────────────────────────────────────┐
│ 📱 VERIFICAÇÃO DE WHATSAPP                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ☑️ Verificar WhatsApp dos telefones retornados              │
│                                                              │
│    ⏱️ Delay entre verificações: [3] segundos                │
│                                                              │
│    ⚠️ Recomendado: Use delay de 2-5 segundos para evitar   │
│       banimento das instâncias QR Connect                    │
└─────────────────────────────────────────────────────────────┘
```

### **3. Configure os CPFs/CNPJs**

```
Lista de Documentos (um por linha):
┌─────────────────────────────────────┐
│ 03636570102                         │
│ 03769336151                         │
│ 49235419115                         │
│ 70011987134                         │
│ 43098754168                         │
└─────────────────────────────────────┘
```

### **4. Inicie a Consulta**

Clique em **"Iniciar Consulta em Massa"** e aguarde!

---

## 📊 Exemplo de Processamento

### **Cenário:**
- **5 CPFs** para consultar
- Cada CPF retorna **3 telefones** (média)
- Total: **15 telefones** para verificar WhatsApp
- **3 instâncias QR Connect** ativas
- Delay: **3 segundos** entre verificações

### **Processamento:**

```
📄 Processando documento 1/5: 03636570102
   📱 Verificando WhatsApp dos telefones retornados...
   
   🔍 [Instância 1] Verificando: 5562994440104
   ✅ 5562994440104 (via Instância 1)
   ⏳ Aguardando 3s...
   
   🔍 [Instância 2] Verificando: 5562992418111
   ❌ 5562992418111 (via Instância 2)
   ⏳ Aguardando 3s...
   
   🔍 [Instância 3] Verificando: 5562993204885
   ✅ 5562993204885 (via Instância 3)
   
   ✅ Verificação de WhatsApp concluída para documento 03636570102!

📄 Processando documento 2/5: 03769336151
   📱 Verificando WhatsApp dos telefones retornados...
   ...
```

### **Tempo Total Estimado:**
- 15 telefones × 3 segundos = **45 segundos** de delay
- 15 verificações ÷ 3 instâncias = **5 verificações por instância**
- Tempo total: **~1 minuto**

---

## 🔄 Rotação Inteligente - Como Funciona

### **Cenário 1: Instância fica inativa durante o processo**

```
Início:
🟢 Instância 1 (ativa)
🟢 Instância 2 (ativa)
🟢 Instância 3 (ativa)

Durante a verificação:
🟢 Instância 1 (ativa)  → Verifica tel. 1
🟢 Instância 2 (ativa)  → Verifica tel. 2
🔴 Instância 3 (INATIVA) → [REMOVIDA DA ROTAÇÃO]

Próximas verificações:
🟢 Instância 1 (ativa)  → Verifica tel. 4
🟢 Instância 2 (ativa)  → Verifica tel. 5
🟢 Instância 1 (ativa)  → Verifica tel. 6
...
```

### **Cenário 2: Instância volta a ficar ativa**

```
Durante a verificação:
🟢 Instância 1 (ativa)  → Verifica tel. 7
🟢 Instância 2 (ativa)  → Verifica tel. 8
🟢 Instância 3 (VOLTOU!) → [REINTEGRADA À ROTAÇÃO]

Próximas verificações:
🟢 Instância 1 (ativa)  → Verifica tel. 9
🟢 Instância 2 (ativa)  → Verifica tel. 10
🟢 Instância 3 (ativa)  → Verifica tel. 11
...
```

### **Cenário 3: Todas as instâncias ficam inativas**

```
Durante a verificação:
🔴 Instância 1 (INATIVA)
🔴 Instância 2 (INATIVA)
🔴 Instância 3 (INATIVA)

Sistema:
⚠️ Nenhuma instância QR Connect ativa no momento.
⚠️ Pulando verificação WhatsApp para os telefones restantes.
✅ Consulta continua normalmente (sem verificação de WhatsApp)
```

---

## 📱 Resultado no Excel/CSV

### **Com WhatsApp:**

| Documento | Telefone 1 | Telefone 2 | Telefone 3 | WhatsApp? | Verificado Por |
|-----------|------------|------------|------------|-----------|----------------|
| 03636570102 | (62) 99440104 | (62) 92418111 | (62) 93204885 | ✅ Tem | Instância 1 |
| 03769336151 | (62) 99440104 | (62) 92418111 | (62) 93204885 | ❌ Sem | Instância 2 |

### **Sem WhatsApp (checkbox desativado):**

| Documento | Telefone 1 | Telefone 2 | Telefone 3 |
|-----------|------------|------------|------------|
| 03636570102 | (62) 99440104 | (62) 92418111 | (62) 93204885 |
| 03769336151 | (62) 99440104 | (62) 92418111 | (62) 93204885 |

---

## ⚙️ Configurações Recomendadas

### **Para Consultas Pequenas (1-10 documentos):**
- ✅ Verificar WhatsApp: **ATIVO**
- ⏱️ Delay: **2-3 segundos**

### **Para Consultas Médias (10-50 documentos):**
- ✅ Verificar WhatsApp: **ATIVO**
- ⏱️ Delay: **3-4 segundos**

### **Para Consultas Grandes (50+ documentos):**
- ✅ Verificar WhatsApp: **ATIVO**
- ⏱️ Delay: **4-5 segundos**
- 📝 Certifique-se de ter **múltiplas instâncias** ativas

### **Para Testes Rápidos:**
- ❌ Verificar WhatsApp: **DESATIVADO**
- ⏱️ Delay: 0 segundos (consulta apenas Nova Vida)

---

## 🛡️ Proteção Contra Banimento

### **Fatores de Proteção:**

1. **Delay entre verificações**
   - Cada verificação espera o tempo configurado
   - Evita requisições muito rápidas

2. **Rotação de instâncias**
   - Distribui a carga entre múltiplas instâncias
   - Reduz o número de requisições por instância

3. **Detecção automática de inativas**
   - Remove instâncias inativas da rotação
   - Evita erros e timeout

4. **Reintegração automática**
   - Instâncias que voltam são reintegradas
   - Maximiza a distribuição da carga

---

## 📝 Logs do Sistema

### **Logs no Backend:**

```
📦 Criando job de consulta em massa: 5 documentos
📱 Verificar WhatsApp: SIM
⏱️ Delay entre verificações: 3s

📄 Processando documento 1/5: 03636570102
📱 Verificando WhatsApp dos telefones retornados...
🔄 3 instância(s) ativa(s) para rotação

🔍 [Instância 1] Verificando: 5562994440104
   ✅ 5562994440104 (via Instância 1)
   ⏳ Aguardando 3s antes da próxima verificação...

🔍 [Instância 2] Verificando: 5562992418111
   ❌ 5562992418111 (via Instância 2)
   ⏳ Aguardando 3s antes da próxima verificação...

✅ Verificação de WhatsApp concluída para documento 03636570102!
```

---

## ✅ Checklist de Implementação

- [x] Adicionar checkbox "Verificar WhatsApp" no frontend
- [x] Adicionar campo "Delay entre verificações" no frontend
- [x] Criar script SQL para atualizar tabela
- [x] Modificar backend para receber novos parâmetros
- [x] Implementar rotação inteligente de instâncias
- [x] Adicionar delay configurável entre verificações
- [x] Buscar instâncias ativas dinamicamente
- [x] Remover instâncias inativas automaticamente
- [x] Reintegrar instâncias que voltarem
- [x] Logs detalhados para monitoramento
- [x] Exibir resultados no Excel/CSV

---

## 🎉 Sistema Pronto para Uso!

Basta aplicar a atualização do banco de dados e reiniciar o sistema!

**Comando rápido:**
```bash
# 1. Aplicar atualização do banco
APLICAR-ATUALIZAR-TABELA-NOVAVIDA-WHATSAPP.bat

# 2. Reiniciar backend
cd backend
npm start

# 3. Reiniciar frontend (em outro terminal)
cd frontend
npm run dev
```

---

## 📞 Suporte

Em caso de dúvidas ou problemas, verifique:
1. Logs do backend (`backend/logs/`)
2. Console do navegador (F12)
3. Status das instâncias QR Connect
4. Configurações do banco de dados

---

**Desenvolvido por:** NettSistemas  
**Data:** Novembro 2025  
**Versão:** 2.0 - Verificação WhatsApp em Massa






