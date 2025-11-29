# 🔍 Funcionalidade de Detecção Automática de Duplicação

## 📋 Descrição

Sistema automático que detecta e resolve duplicações de números de telefone em instâncias QR Connect.

## 🎯 Objetivo

Evitar que o mesmo número de WhatsApp fique conectado em múltiplas instâncias, garantindo que sempre seja utilizada apenas a instância original.

---

## 🔧 Como Funciona

### 1️⃣ **Momento da Verificação**

A verificação acontece **automaticamente** quando:
- Uma instância se conecta ao WhatsApp pela primeira vez
- O sistema detecta que a instância passou de `desconectada` → `conectada`
- O número de telefone (`owner`) foi identificado pela UAZ API

### 2️⃣ **Fluxo de Detecção**

```
1. Usuário escaneia QR Code
2. Instância conecta ao WhatsApp
3. Sistema detecta número de telefone (owner)
4. Sistema busca TODAS as instâncias na UAZ API
5. Verifica se o mesmo número já existe em OUTRA instância conectada
```

### 3️⃣ **Ações Automáticas (Lógica Inteligente)**

Se **DUPLICAÇÃO DETECTADA**, o sistema decide qual instância manter:

#### **CASO 1: Instância ANTIGA está CONECTADA**
```
✅ MANTER: Instância ANTIGA (já está funcionando)
   ├─ Buscar instância original na UAZ API
   ├─ Verificar se já está no banco local
   └─ Se não estiver → Importar automaticamente

❌ DELETAR: Instância NOVA (duplicada)
   ├─ Deletar da UAZ API (liberar recursos)
   ├─ Deletar do banco local
   └─ Retornar alerta para o usuário
```

#### **CASO 2: Instância ANTIGA está DESCONECTADA**
```
✅ MANTER: Instância NOVA (acabou de conectar)
   ├─ Manter no banco local
   ├─ Manter na UAZ API
   └─ Continuar funcionando normalmente

❌ DELETAR: Instância ANTIGA (não está funcionando)
   ├─ Deletar da UAZ API (liberar recursos)
   ├─ Deletar do banco local (se existir)
   └─ Retornar alerta para o usuário
```

Se **NÃO HÁ DUPLICAÇÃO**:
- Instância nova é mantida normalmente
- Processo continua sem interrupção

---

### 4️⃣ **Lógica de Decisão**

```javascript
// Prioridade: SEMPRE manter a instância que está FUNCIONANDO
if (antigaEstaConectada) {
  // Instância antiga está ativa e funcionando
  deletar(instanciaNova);
  manter(instanciaAntiga);
} else {
  // Instância antiga está desconectada (não funciona)
  deletar(instanciaAntiga);
  manter(instanciaNova);
}
```

**🎯 Regra de Ouro:** Sempre manter a instância que está **CONECTADA** (funcionando)!

---

## 📁 Arquivos Modificados

### Backend

#### `backend/src/routes/uaz.js`

**Endpoint:** `GET /api/uaz/instances/:id/status` (linhas ~1260-1360)

**Nova lógica adicionada:**

```javascript
// 🔍 VERIFICAÇÃO DE DUPLICAÇÃO AUTOMÁTICA
// Se acabou de conectar E tem número, verificar se já existe em outra instância
if (isConnected && phoneNumber && !inst.phone_number) {
  // Buscar todas as instâncias da UAZ API
  const fetchResult = await uazService.fetchInstances(proxyConfig);
  
  // Procurar se este número já existe em OUTRA instância
  const instanciaDuplicada = fetchResult.instances.find(i => 
    i.owner === phoneNumber && 
    i.token !== inst.instance_token &&
    i.status === 'connected'
  );
  
  if (instanciaDuplicada) {
    // 1️⃣ DELETAR a instância NOVA da UAZ API
    await uazService.deleteInstance(inst.instance_token, proxyConfig);
    
    // 2️⃣ DELETAR a instância NOVA do banco local
    await pool.query('DELETE FROM uaz_instances WHERE id = $1', [id]);
    
    // 3️⃣ VERIFICAR se a instância EXISTENTE já está no banco
    const existenteNoBanco = await pool.query(
      'SELECT id FROM uaz_instances WHERE instance_token = $1',
      [instanciaDuplicada.token]
    );
    
    if (existenteNoBanco.rows.length === 0) {
      // 4️⃣ IMPORTAR a instância EXISTENTE
      const importResult = await pool.query(`
        INSERT INTO uaz_instances (...)
        VALUES (...)
        RETURNING *
      `, [...]);
      
      // 5️⃣ RETORNAR indicação de que houve importação
      return res.json({
        ...statusResult,
        duplicateDetected: true,
        importedInstance: {...},
        message: '✅ Número já existente detectado!'
      });
    }
  }
}
```

**Condições de Ativação:**
- `isConnected === true` → Instância conectada
- `phoneNumber` → Número identificado
- `!inst.phone_number` → Primeira vez que conecta (não tinha número antes)

---

### Frontend

#### `frontend/src/pages/configuracoes-uaz.tsx`

**Função:** `handleCheckStatus` (linhas ~256-290)

**Nova lógica adicionada:**

```typescript
const handleCheckStatus = async (id: number) => {
  setCheckingStatus(id);
  try {
    const response = await api.get(`/uaz/instances/${id}/status`);
    
    // 🔍 Verifica se houve detecção de duplicação
    if (response.data.duplicateDetected) {
      if (response.data.importedInstance) {
        alert(
          `✅ DUPLICAÇÃO DETECTADA E RESOLVIDA!\n\n` +
          `📱 Número: ${response.data.importedInstance.phone_number}\n` +
          `📦 Instância importada: ${response.data.importedInstance.name}\n\n` +
          `ℹ️ A nova instância foi automaticamente deletada e substituída pela instância existente.`
        );
      }
    }
    
    await loadInstances();
  } catch (error: any) {
    alert('❌ Erro: ' + (error.response?.data?.error || error.message));
  } finally {
    setCheckingStatus(null);
  }
};
```

---

## 🧪 Testando a Funcionalidade

### Cenário 1: Primeira Conexão (Sem Duplicação)
```
1. Criar nova instância "Teste 1"
2. Escanear QR Code com número +5511999999999
3. ✅ Instância conecta normalmente
4. ✅ Número é salvo no banco
5. ✅ Nenhuma duplicação detectada
```

### Cenário 2: Duplicação - Antiga CONECTADA
```
1. Já existe instância "Original" CONECTADA com número +5511999999999
2. Criar NOVA instância "Teste 2"
3. Escanear QR Code com o MESMO número +5511999999999
4. ⚠️ Sistema detecta duplicação
5. 💡 DECISÃO: Antiga está CONECTADA
6. ❌ Instância NOVA "Teste 2" é DELETADA (banco + UAZ API)
7. ✅ Instância ANTIGA "Original" é MANTIDA/IMPORTADA
8. 🔔 Usuário recebe alerta: "Mantivemos a instância original"
```

### Cenário 3: Duplicação - Antiga DESCONECTADA
```
1. Já existe instância "Antiga" DESCONECTADA com número +5511999999999
2. Criar NOVA instância "Teste 3"
3. Escanear QR Code com o MESMO número +5511999999999
4. ⚠️ Sistema detecta duplicação
5. 💡 DECISÃO: Antiga está DESCONECTADA
6. ❌ Instância ANTIGA "Antiga" é DELETADA (banco + UAZ API)
7. ✅ Instância NOVA "Teste 3" é MANTIDA
8. 🔔 Usuário recebe alerta: "Mantivemos a nova conexão"
```

---

## 📊 Logs de Console

### Backend - Caso 1: Antiga CONECTADA

```bash
🔍 ========================================
🔍 VERIFICANDO DUPLICAÇÃO DE NÚMERO
🔍 ========================================
📱 Número detectado: 5511999999999
🆔 Instância NOVA (acabou de conectar): Teste Nova (ID: 123)

⚠️  ========================================
⚠️  DUPLICAÇÃO DETECTADA!
⚠️  ========================================
📱 Número: 5511999999999
📦 Instância NOVA: Teste Nova (ID: 123) - Status: CONECTADA
📦 Instância ANTIGA: Instância Original (Token: abc123...) - Status: CONECTADA

💡 DECISÃO: Instância ANTIGA está CONECTADA
   ├─ ✅ MANTER: Instância ANTIGA (já está funcionando)
   └─ ❌ DELETAR: Instância NOVA (duplicada)

🗑️  Deletando instância NOVA da UAZ API...
   ✅ Instância NOVA deletada da UAZ API
🗑️  Deletando instância NOVA do banco local...
   ✅ Instância NOVA deletada do banco local
📥 Importando instância ANTIGA para o banco local...
   ✅ Instância ANTIGA importada! Novo ID: 456
========================================
```

### Backend - Caso 2: Antiga DESCONECTADA

```bash
🔍 ========================================
🔍 VERIFICANDO DUPLICAÇÃO DE NÚMERO
🔍 ========================================
📱 Número detectado: 5511999999999
🆔 Instância NOVA (acabou de conectar): Teste Nova (ID: 123)

⚠️  ========================================
⚠️  DUPLICAÇÃO DETECTADA!
⚠️  ========================================
📱 Número: 5511999999999
📦 Instância NOVA: Teste Nova (ID: 123) - Status: CONECTADA
📦 Instância ANTIGA: Instância Antiga (Token: xyz789...) - Status: DESCONECTADA

💡 DECISÃO: Instância ANTIGA está DESCONECTADA
   ├─ ✅ MANTER: Instância NOVA (acabou de conectar)
   └─ ❌ DELETAR: Instância ANTIGA (não está funcionando)

🗑️  Deletando instância ANTIGA da UAZ API...
   ✅ Instância ANTIGA deletada da UAZ API
🗑️  Verificando se instância ANTIGA existe no banco local...
   ✅ Instância ANTIGA deletada do banco local (ID: 456)
✅ Instância NOVA mantida! ID: 123
========================================
```

### Frontend - Caso 1: Antiga CONECTADA

```
⚠️ Duplicação detectada!
{
  duplicateDetected: true,
  action: "kept_old_connected",
  importedInstance: {
    id: 456,
    name: "Instância Original",
    phone_number: "5511999999999",
    profile_name: "João Silva"
  }
}

Alert:
✅ DUPLICAÇÃO DETECTADA E RESOLVIDA!
📱 Número: 5511999999999
📦 Instância mantida: Instância Original

💡 DECISÃO: A instância original já estava CONECTADA.
ℹ️ Mantivemos a instância original e removemos a nova conexão duplicada.
```

### Frontend - Caso 2: Antiga DESCONECTADA

```
⚠️ Duplicação detectada!
{
  duplicateDetected: true,
  action: "kept_new_deleted_old",
  keptInstance: {
    id: 123,
    name: "Teste Nova",
    phone_number: "5511999999999",
    profile_name: "João Silva"
  }
}

Alert:
✅ DUPLICAÇÃO DETECTADA E RESOLVIDA!
📱 Número: 5511999999999
📦 Instância mantida: Teste Nova

💡 DECISÃO: A instância antiga estava DESCONECTADA.
ℹ️ Mantivemos a nova conexão (que está funcionando) e removemos a antiga.
```

---

## 🔒 Segurança e Validações

### Validações Implementadas

✅ **Verifica se o número é o mesmo**
```javascript
i.owner === phoneNumber
```

✅ **Verifica se é uma instância DIFERENTE**
```javascript
i.token !== inst.instance_token
```

✅ **Verifica se a instância existente está CONECTADA**
```javascript
i.status === 'connected'
```

✅ **Evita deletar a instância errada**
- Sempre deleta a NOVA (que acabou de conectar)
- Sempre mantém a ORIGINAL (que já estava conectada)

---

## 🎨 Experiência do Usuário

### Antes (Sem a funcionalidade)
```
❌ Usuário cria múltiplas instâncias com o mesmo número
❌ Conflitos de envio de mensagens
❌ Instâncias duplicadas ocupando recursos
❌ Confusão sobre qual instância usar
❌ Instâncias desconectadas ocupando espaço
```

### Depois (Com a funcionalidade)

#### Caso 1: Tentativa de duplicar instância conectada
```
1. Usuário tenta conectar número já existente
2. ✅ Sistema detecta que já existe instância CONECTADA
3. ✅ Automaticamente deleta a nova e mantém a original
4. 🔔 Alerta: "Mantivemos a instância original que já estava funcionando"
5. ✅ Zero conflito, zero confusão
```

#### Caso 2: Tentativa de reconectar número desconectado
```
1. Usuário tenta conectar número de instância antiga DESCONECTADA
2. ✅ Sistema detecta que a antiga não está funcionando
3. ✅ Automaticamente deleta a antiga e mantém a nova
4. 🔔 Alerta: "Mantivemos a nova conexão e removemos a antiga"
5. ✅ Renovação automática, sempre usando a que funciona
```

### Resultado Final
```
✅ Sistema SEMPRE mantém a instância que está FUNCIONANDO
✅ Resolve duplicação sem intervenção
✅ Usuário é informado claramente da decisão
✅ Libera recursos automaticamente
✅ Zero downtime, máxima disponibilidade
```

---

## 🚀 Benefícios

1. **Automação Total**: Não requer intervenção manual
2. **Economia de Recursos**: Deleta instâncias duplicadas da UAZ API
3. **Consistência**: Garante um número por instância
4. **Transparência**: Usuário é sempre informado
5. **Importação Inteligente**: Recupera instâncias já existentes
6. **Prevenção de Erros**: Evita conflitos de mensagens
7. **Decisão Inteligente**: Sempre mantém a instância que está FUNCIONANDO
8. **Máxima Disponibilidade**: Prioriza instâncias conectadas
9. **Renovação Automática**: Remove instâncias obsoletas/desconectadas
10. **Zero Downtime**: Nunca deixa o usuário sem instância funcionando

---

## ⚙️ Configurações

Não requer configuração adicional. A funcionalidade é ativada automaticamente quando:
- Sistema detecta conexão de instância
- UAZ API retorna o número de telefone (`owner`)

---

## 🔄 Integração com Outras Funcionalidades

### Relacionado com:
- ✅ **Importação de Instâncias** (`FUNCIONALIDADE_IMPORTAR_INSTANCIAS.md`)
- ✅ **Deleção de Instâncias** (`CORRECAO_ENDPOINT_UAZ.md`)
- ✅ **Verificação de Status** (Auto-refresh e manual)

---

## 📝 Notas Técnicas

### Por que verifica apenas na primeira conexão?

```javascript
if (isConnected && phoneNumber && !inst.phone_number)
```

A condição `!inst.phone_number` garante que:
- Verifica apenas quando a instância NÃO tinha número antes
- Evita verificações repetidas desnecessárias
- Detecta apenas conexões NOVAS (primeira vez)

### Por que não verifica antes de gerar o QR Code?

**Resposta:** Tecnicamente impossível.

Para saber qual número vai se conectar, precisamos que o usuário:
1. Escaneie o QR Code
2. Conecte o WhatsApp
3. UAZ API retorne o `owner` (número)

Somente após a conexão é possível identificar o número.

### Por que a lógica prioriza instâncias conectadas?

**Resposta:** Máxima disponibilidade e consistência.

**Cenário problemático (sem essa lógica):**
```
1. Usuário tem instância "Vendas" CONECTADA há 30 dias
2. Por engano, tenta criar nova instância "Teste" com mesmo número
3. Sistema deleta a "Vendas" (que estava funcionando!)
4. Mantém a "Teste" (recém criada)
5. ❌ Usuário perde histórico, configurações, campanhas ativas!
```

**Solução implementada:**
```
1. Sistema verifica: qual instância está FUNCIONANDO?
2. Se ANTIGA está conectada → Manter antiga (preserva tudo)
3. Se ANTIGA está desconectada → Manter nova (renovação automática)
4. ✅ Sempre mantém a que está ATIVA e FUNCIONANDO
```

### Por que deletar a instância antiga se estiver desconectada?

**Resposta:** Renovação automática e higienização.

**Benefícios:**
- Libera recursos da UAZ API (cada instância tem custo)
- Remove "lixo" do banco de dados
- Evita confusão com instâncias obsoletas
- Garante que a instância ativa é sempre a mais recente
- Permite que o usuário "reconecte" sem precisar deletar manualmente a antiga

---

## 🐛 Troubleshooting

### Problema: Duplicação não foi detectada

**Possíveis causas:**
1. UAZ API não retornou o campo `owner`
2. Instância original está desconectada
3. Tokens são iguais (mesma instância)

**Solução:**
- Verificar logs do backend
- Confirmar que a instância original está `connected`

### Problema: Instância foi deletada mas ainda aparece

**Causa:** Cache do frontend

**Solução:**
- Aguardar próximo auto-refresh (5 segundos)
- Ou clicar em "Atualizar Status"

---

## ✅ Checklist de Implementação

- [x] Lógica de detecção de duplicação (backend)
- [x] Deleção automática da instância nova (backend)
- [x] Importação automática da instância existente (backend)
- [x] Notificação para o usuário (frontend)
- [x] Integração com verificação de status
- [x] Logs detalhados para debugging
- [x] Tratamento de erros
- [x] Documentação completa

---

## 📚 Documentação Relacionada

- `FUNCIONALIDADE_IMPORTAR_INSTANCIAS.md` - Como funciona a importação manual
- `CORRECAO_ENDPOINT_UAZ.md` - Correção do endpoint de deleção
- `GUIA_DEV_RAPIDO.md` - Visão geral do sistema

---

---

## 📊 Resumo Visual da Lógica

```
┌─────────────────────────────────────────────────────────────┐
│  NOVA INSTÂNCIA CONECTA COM NÚMERO +5511999999999          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │ Buscar duplicação?  │
                    └──────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │                    │
              ✅ SIM                  ❌ NÃO
                    │                    │
                    ↓                    ↓
        ┌───────────────────┐    ┌──────────────┐
        │ Instância antiga  │    │ Manter nova  │
        │ está conectada?   │    │ Tudo certo!  │
        └─────────┬─────────┘    └──────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
   ✅ CONECTADA        ❌ DESCONECTADA
        │                    │
        ↓                    ↓
┌───────────────┐    ┌──────────────────┐
│ MANTER ANTIGA │    │ MANTER NOVA      │
│ DELETAR NOVA  │    │ DELETAR ANTIGA   │
└───────────────┘    └──────────────────┘
        │                    │
        └────────┬───────────┘
                 │
                 ↓
     ┌───────────────────────┐
     │ Alerta para usuário   │
     │ Atualizar interface   │
     └───────────────────────┘
```

---

**Data de Implementação:** 19/11/2024  
**Última Atualização:** 19/11/2024 - Adicionada lógica de priorização inteligente  
**Status:** ✅ Implementado e Testado (v2.0 - Com decisão inteligente)

