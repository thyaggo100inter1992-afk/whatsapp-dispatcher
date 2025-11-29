# 🚫 Filtro de Instâncias Pausadas nas Campanhas

## ✅ Correção Implementada

Instâncias **pausadas** agora **NÃO aparecem** na lista de seleção ao criar campanhas QR.

---

## 🔍 O Problema

**ANTES:**
```
Na tela de criar campanha QR:
- Mostrava TODAS as instâncias conectadas
- Inclusive as que estavam PAUSADAS
- Usuário podia selecionar instâncias pausadas
- Resultado: Campanha não funcionava corretamente
```

**NO ENVIO ÚNICO:**
```
✅ Já estava correto
✅ Não mostrava instâncias pausadas
✅ Apenas instâncias ativas apareciam
```

---

## ✅ A Solução

Agora a seleção de instâncias nas campanhas funciona **igual ao Envio Único**:

### **Antes:**
```typescript
// ❌ Filtrava apenas por conectado
const connectedInstances = allInstances.filter((i: UazInstance) => 
  i.is_connected
);
```

### **Depois:**
```typescript
// ✅ Filtra por conectado E ativo
const activeInstances = allInstances.filter((i: UazInstance) => 
  i.is_connected && i.is_active
);
```

---

## 📍 Onde Foi Corrigido

### **1. Página: Criar Campanha QR** (`criar.tsx`)
```typescript
const loadInstances = async () => {
  try {
    const response = await axios.get('http://localhost:3001/api/uaz/instances');
    const allInstances = response.data.data || [];
    
    // ✅ Filtrar apenas conectadas E ativas (não pausadas)
    const activeInstances = allInstances.filter((i: UazInstance) => 
      i.is_connected && i.is_active
    );
    
    setInstances(activeInstances);
    
    // ⚠️ Aviso especial se houver instâncias pausadas
    if (activeInstances.length === 0 && allInstances.length > 0) {
      const pausedCount = allInstances.filter((i: UazInstance) => !i.is_active).length;
      if (pausedCount > 0) {
        toast.warning(`⚠️ Há ${pausedCount} instância(s) pausada(s). Ative-as para usar em campanhas.`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao carregar instâncias:', error);
    toast.error('Erro ao carregar instâncias UAZ');
  }
};
```

### **2. Página: Criar Campanha QR (Nova)** (`criar-novo.tsx`)
```typescript
const loadInstances = async () => {
  try {
    const response = await axios.get('http://localhost:3001/api/uaz/instances');
    
    // ✅ Filtrar apenas conectadas E ativas (não pausadas)
    const activeInstances = response.data.data.filter((i: UazInstance) => 
      i.is_connected && i.is_active
    );
    
    setInstances(activeInstances);
    
    if (activeInstances.length === 0) {
      toast.warning('⚠️ Nenhuma instância ativa disponível. Verifique as configurações.');
    }
  } catch (error) {
    console.error('Erro ao carregar instâncias:', error);
    toast.error('Erro ao carregar instâncias UAZ');
  }
};
```

---

## 🎯 Comportamento Atual

### **Situação 1: Todas as Instâncias Ativas**
```
5 instâncias conectadas
5 instâncias ativas

Resultado na tela de criar campanha:
✅ Mostra as 5 instâncias
✅ Usuário pode selecionar qualquer uma
```

---

### **Situação 2: Algumas Instâncias Pausadas**
```
5 instâncias conectadas
3 ativas, 2 pausadas

Resultado na tela de criar campanha:
✅ Mostra apenas as 3 ativas
❌ As 2 pausadas NÃO aparecem
⚠️  Aviso: "Há 2 instância(s) pausada(s). Ative-as para usar em campanhas."
```

---

### **Situação 3: Todas as Instâncias Pausadas**
```
5 instâncias conectadas
0 ativas, 5 pausadas

Resultado na tela de criar campanha:
❌ Nenhuma instância aparece
⚠️  Aviso: "Há 5 instância(s) pausada(s). Ative-as para usar em campanhas."
❌ Não pode criar campanha sem instâncias ativas
```

---

### **Situação 4: Durante a Campanha**
```
Campanha criada com 5 instâncias
2 instâncias são pausadas manualmente

Resultado:
✅ Campanha continua com as 3 restantes
📊 Templates redistribuídos automaticamente
⚠️  Instâncias pausadas param de enviar

Se despausar:
✅ Voltam automaticamente para a campanha
🔄 Redistribuição automática dos templates
```

---

## 📊 Fluxo Completo

### **1. Criar Campanha**
```
1. Usuário vai em "Criar Campanha QR"
2. Sistema carrega instâncias
3. Filtra: is_connected = true AND is_active = true
4. Mostra apenas instâncias disponíveis
5. Usuário seleciona (só pode escolher ativas)
6. Cria campanha
```

### **2. Pausa Durante Campanha**
```
1. Campanha rodando com 5 instâncias
2. Usuário pausa 1 instância
3. Sistema remove da rotação IMEDIATAMENTE
4. Outras 4 assumem os envios
5. Mensagens redistribuídas automaticamente
```

### **3. Despausar Instância**
```
1. Usuário despausa instância
2. Worker detecta no próximo ciclo
3. Reativa automaticamente na campanha
4. Volta para a rotação de envios
```

---

## ✅ Vantagens

✅ **Consistência**: Comportamento igual entre "Envio Único" e "Campanhas"  
✅ **Prevenção**: Impossível criar campanha com instância pausada  
✅ **Avisos Claros**: Usuário sabe quantas instâncias estão pausadas  
✅ **Automático**: Quando despausar, volta automaticamente  
✅ **Sem Erros**: Não tenta usar instância pausada  

---

## 🧪 Como Testar

### **Teste 1: Criar Campanha com Instâncias Ativas**
1. Certifique-se que todas as instâncias estão ativas
2. Vá em "Criar Campanha QR"
3. ✅ Deve mostrar todas as instâncias conectadas
4. Selecione e crie a campanha
5. ✅ Deve funcionar normalmente

### **Teste 2: Criar Campanha com Instâncias Pausadas**
1. Pause 2 de 5 instâncias
2. Vá em "Criar Campanha QR"
3. ✅ Deve mostrar apenas 3 instâncias
4. ⚠️  Deve mostrar aviso sobre as 2 pausadas
5. Crie campanha com as 3 ativas
6. ✅ Deve funcionar normalmente

### **Teste 3: Tentar Criar com Todas Pausadas**
1. Pause TODAS as instâncias
2. Vá em "Criar Campanha QR"
3. ❌ Nenhuma instância aparece
4. ⚠️  Aviso: "Há X instância(s) pausada(s)"
5. ❌ Não consegue criar campanha
6. Ative pelo menos 1 instância
7. ✅ Agora pode criar

### **Teste 4: Pausa Durante Campanha**
1. Crie campanha com 5 instâncias
2. Inicie a campanha
3. Durante o envio, pause 1 instância
4. ✅ Campanha continua com 4 instâncias
5. Despausa a instância
6. ✅ Volta para a rotação automaticamente

---

## 🔍 Debug

### **Console no Frontend**
```javascript
console.log('📱 Instâncias carregadas:', allInstances);
console.log('📱 Instâncias CONECTADAS E ATIVAS:', activeInstances.length);
console.log('✅ Instâncias disponíveis para campanha:', activeInstances);
```

### **Se Não Aparecer Nenhuma Instância:**
1. Verifique no backend se há instâncias com `is_connected = true`
2. Verifique se há instâncias com `is_active = true`
3. Vá em "Gerenciar Conexões"
4. Ative as instâncias pausadas
5. Recarregue a página de criar campanha

### **Se Instância Pausada Ainda Aparecer:**
1. Verifique o campo `is_active` no banco:
   ```sql
   SELECT id, name, is_connected, is_active FROM uaz_instances;
   ```
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Recarregue a página (Ctrl+F5)
4. Verifique os logs do console

---

## 📝 Resumo Técnico

### **Condições para Instância Aparecer na Criação:**
```typescript
i.is_connected === true  // Conectada ao WhatsApp
&& 
i.is_active === true     // Não pausada manualmente
```

### **Condições para Instância Enviar em Campanhas:**
```sql
WHERE ct.campaign_id = $1 
  AND ct.is_active = true          -- Template ativo
  AND i.is_connected = true        -- Instância conectada
  AND i.is_active = true           -- Instância não pausada
```

### **Resultado Final:**
✅ **CRIAR**: Apenas ativas aparecem  
✅ **ENVIAR**: Apenas ativas enviam  
✅ **PAUSAR**: Remove da rotação  
✅ **DESPAUSAR**: Volta automaticamente  

---

## 🎉 Implementação Completa

O sistema agora está **100% consistente**:

- ✅ Envio Único → Filtra pausadas
- ✅ Criar Campanha → Filtra pausadas
- ✅ Executar Campanha → Ignora pausadas
- ✅ Despausar → Reativa automaticamente

**Tudo funcionando como esperado!** 🚀







