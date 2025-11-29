# ⏸️ Sistema de Pausar/Ativar Conexões

## 🎯 Funcionalidades Implementadas

### 1. **Backend - Novas Rotas API** ✅

Criadas 3 novas rotas em `backend/src/routes/uaz.js`:

#### a) **Pausar/Ativar Individual**
```
POST /api/uaz/instances/:id/toggle-active
```
- Alterna entre pausado/ativo
- Retorna o novo estado

#### b) **Pausar Todas**
```
POST /api/uaz/instances/pause-all
```
- Pausa todas as conexões ativas
- Retorna quantidade pausada

#### c) **Ativar Todas**
```
POST /api/uaz/instances/activate-all
```
- Ativa todas as conexões pausadas
- Retorna quantidade ativada

### 2. **Frontend - Botões Globais** ✅

No topo da página, adicionados 2 novos botões:

#### 🟠 **Botão "Pausar Todas"**
- Cor: Laranja
- Ícone: ⏸️
- Confirma antes de executar
- Pausa todas as conexões de uma vez

#### 🟢 **Botão "Ativar Todas"**
- Cor: Verde
- Ícone: ▶️
- Confirma antes de executar
- Ativa todas as conexões pausadas

### 3. **Frontend - Botões Individuais** ✅

Em cada card de conexão:

#### 🎮 **Botão Pausar/Ativar**
- **Se Ativa:** Botão laranja "⏸️ Pausar"
- **Se Pausada:** Botão verde "▶️ Ativar"
- Alterna entre os estados
- Mostra spinner durante a ação

### 4. **Indicadores Visuais** ✅

#### 📊 **Status Duplo**
Agora cada conexão mostra 2 status:
1. **Ativo/Pausado** (laranja ou verde)
2. **Conectado/Desconectado** (verde ou vermelho)

#### 🖼️ **Foto do Perfil**
Quando pausada:
- **Overlay escuro** sobre a foto
- **Ícone grande de pausa** no centro
- **Texto "PAUSADA"**
- Borda laranja
- Opacidade reduzida

#### 🔘 **Indicador no Avatar**
- **Verde pulsante:** Conectado e ativo
- **Vermelho:** Desconectado
- **Laranja:** Pausado (⏸️)

## 🎨 Visual da Conexão Pausada

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  [FOTO COM    ]  NOME DA CONEXÃO     [⏸️ Pausada]  │
│  [OVERLAY     ]  122522               [● Conectado] │
│  [  ⏸️  ]                                           │
│  [ PAUSADA  ]  NOME DO PERFIL                  [⏸️ Pausar]│
│  [ESCURECIDA  ]  👤 NettCred                   [📋 QR Code]│
│      ⏸️         📞 5511930284611               [🔄 Status] │
│                                                [✏️ Editar] │
│                                                [🗑️ Excluir]│
└──────────────────────────────────────────────────────┘
```

## 🔥 Quando Usar?

### **Pausar uma Conexão Individual:**
- Manutenção temporária
- Trocar de número
- Evitar envios temporariamente
- Testes

### **Pausar Todas:**
- Fim do expediente
- Manutenção geral do sistema
- Parar todas as campanhas rapidamente
- Emergências

### **Ativar Todas:**
- Início do expediente
- Após manutenção
- Retomar operações

## 📋 Como Funciona

### **Campo no Banco de Dados**
O campo `is_active` na tabela `uaz_instances` controla o estado:
- `true` = Ativa (funciona normalmente)
- `false` = Pausada (não envia mensagens)

### **Integração com Campanhas**
Conexões pausadas:
- ❌ Não processam campanhas
- ❌ Não enviam mensagens automáticas
- ✅ Continuam conectadas no WhatsApp
- ✅ Podem ser ativadas a qualquer momento

## 🚀 Como Usar

### **Pausar uma Conexão:**
1. Vá em **Gerenciar Conexões**
2. Clique em **"⏸️ Pausar"** na conexão desejada
3. Pronto! A conexão está pausada

### **Ativar uma Conexão:**
1. Vá em **Gerenciar Conexões**
2. Clique em **"▶️ Ativar"** na conexão pausada
3. Pronto! A conexão volta a funcionar

### **Pausar Todas:**
1. Clique em **"⏸️ Pausar Todas"** no topo
2. Confirme a ação
3. Todas as conexões são pausadas

### **Ativar Todas:**
1. Clique em **"▶️ Ativar Todas"** no topo
2. Confirme a ação
3. Todas as conexões voltam a funcionar

## ⚠️ Importante

- ✅ Conexões pausadas **permanecem conectadas** no WhatsApp
- ✅ Você pode **pausar e ativar quantas vezes quiser**
- ✅ O status é **salvo no banco de dados**
- ✅ Pausar é **diferente de desconectar**
- ✅ Conexões pausadas **não gastam recursos** de envio

## 🎯 Diferença: Pausar vs Desconectar

| Ação | Pausar ⏸️ | Desconectar ❌ |
|------|-----------|----------------|
| **WhatsApp** | Continua conectado | Desconecta |
| **Envio de mensagens** | Bloqueado | Impossível |
| **Reverter** | Instantâneo | Precisa reconectar |
| **Dados salvos** | Preservados | Preservados |
| **QR Code** | Não precisa | Precisa escanear de novo |

## 📝 Logs no Backend

Ao pausar/ativar, você verá no console:

```bash
⏸️ Instância 122522 (ID: 7) pausada
▶️ Instância 122522 (ID: 7) ativada
⏸️ 3 instância(s) pausada(s)
▶️ 3 instância(s) ativada(s)
```

## 🎉 Pronto!

Agora você tem controle total sobre suas conexões:
- ✅ Pausar/ativar individualmente
- ✅ Pausar/ativar todas de uma vez
- ✅ Visual claro do estado
- ✅ Indicadores em tempo real

**Recarregue a página e teste as novas funcionalidades!** 🚀










