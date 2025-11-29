# ⏱️ CONTADORES DE TEMPO EM TEMPO REAL

## ✨ **FUNCIONALIDADE ADICIONADA:**

Agora o card de **"Configurações"** mostra contadores em tempo real:

### **1. ⏳ Próxima mensagem em:**
- Mostra quanto tempo falta para enviar a próxima mensagem
- Atualiza a cada segundo (countdown)
- Aparece quando a campanha está **ENVIANDO**
- Cor: **Ciano** (`text-cyan-400`)

### **2. 💤 Tempo restante da pausa:**
- Mostra quanto tempo falta para sair da pausa automática
- Atualiza a cada segundo (countdown)
- Aparece quando a campanha está **EM PAUSA**
- Cor: **Laranja** (`text-orange-400`)

---

## 📊 **COMO FUNCIONA:**

### **Estados Adicionados:**
```typescript
const [nextMessageTime, setNextMessageTime] = useState<number | null>(null);
const [pauseEndTime, setPauseEndTime] = useState<number | null>(null);
```

### **Atualização Automática:**
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date());
    
    // Decrementar contadores
    if (nextMessageTime !== null && nextMessageTime > 0) {
      setNextMessageTime(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }
    
    if (pauseEndTime !== null && pauseEndTime > 0) {
      setPauseEndTime(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }
  }, 1000);
  return () => clearInterval(timer);
}, [nextMessageTime, pauseEndTime]);
```

### **Carregamento dos Dados:**
```typescript
const loadActivityLog = async () => {
  // ...
  if (data.success) {
    setActivityLog(data.data);
    
    // Calcular tempo para próxima mensagem (intervalo)
    if (data.data?.intervalInfo?.nextMessageIn !== undefined) {
      setNextMessageTime(data.data.intervalInfo.nextMessageIn);
    }
    
    // Calcular tempo restante da pausa
    if (data.data?.statusDetails?.pauseRemainingSeconds !== undefined) {
      setPauseEndTime(data.data.statusDetails.pauseRemainingSeconds);
    } else {
      setPauseEndTime(null);
    }
  }
};
```

---

## 🎨 **VISUAL:**

### **Card de Configurações - ANTES:**
```
⚙️ Configurações
🕐 Horário: 08:00 - 18:00
⏱️ Intervalo: 20s entre envios
💤 Pausa: A cada 1 envios por 1 min
```

### **Card de Configurações - DEPOIS:**
```
⚙️ Configurações
🕐 Horário: 08:00 - 18:00
⏱️ Intervalo: 20s entre envios
💤 Pausa: A cada 1 envios por 1 min

─────────────────────────────
⏳ Próxima mensagem em:
   18s  (← Animado, cor ciano)

─────────────────────────────
💤 Tempo restante da pausa:
   54s  (← Animado, cor laranja)
```

---

## 🔄 **COMPORTAMENTO:**

### **1. Quando está ENVIANDO:**
```
✅ Mostra: "Próxima mensagem em: 18s"
❌ Esconde: "Tempo restante da pausa"
```

### **2. Quando está EM PAUSA:**
```
❌ Esconde: "Próxima mensagem em"
✅ Mostra: "Tempo restante da pausa: 54s"
```

### **3. Quando NÃO está enviando:**
```
❌ Esconde: Ambos os contadores
✅ Mostra: Apenas as configurações estáticas
```

---

## 📋 **FORMATO DO TEMPO:**

A função `formatTimeRemaining()` formata automaticamente:

| Segundos | Exibição |
|----------|----------|
| 45s | `45s` |
| 90s | `1min 30s` |
| 3665s | `1h 1min 5s` |

---

## 🔍 **DADOS DO BACKEND:**

O backend deve retornar no `/activity-log`:

```json
{
  "success": true,
  "data": {
    "intervalInfo": {
      "nextMessageIn": 18,  // segundos até próxima mensagem
      "intervalSeconds": 20  // intervalo configurado
    },
    "statusDetails": {
      "pauseRemainingSeconds": 54  // segundos restantes da pausa
    },
    "currentStatus": "sending" // ou "pause_programmed"
  }
}
```

---

## ✨ **ANIMAÇÕES:**

- **`animate-pulse`**: Os números pulsam suavemente
- **Cor Ciano**: Próxima mensagem (ativo, enviando)
- **Cor Laranja**: Pausa (aguardando)

---

## 🎯 **RESULTADO FINAL:**

```
┌─────────────────────────────────────┐
│  ⚙️ Configurações                   │
├─────────────────────────────────────┤
│  🕐 Horário: 08:00 - 18:00          │
│  ⏱️ Intervalo: 20s entre envios      │
│  💤 Pausa: A cada 1 envios por 1min │
│                                      │
│  ──────────────────────────────     │
│  ⏳ Próxima mensagem em:             │
│       18s  💙 (pulsando)             │
│                                      │
│  ──────────────────────────────     │
│  💤 Tempo restante da pausa:         │
│       54s  🧡 (pulsando)             │
└─────────────────────────────────────┘
```

---

## 🚀 **ARQUIVOS MODIFICADOS:**

1. **`frontend/src/pages/qr-campanha/[id].tsx`**
   - Linha 136-137: Estados adicionados
   - Linha 155-169: Timer para decrementar contadores
   - Linha 172-181: Função `formatTimeRemaining()`
   - Linha 277-287: Carregamento dos dados do backend
   - Linha 719-741: Renderização dos contadores no card

---

## ✅ **FUNCIONALIDADE COMPLETA!**

Agora você pode acompanhar em tempo real:
- ⏳ **Quanto tempo falta** para a próxima mensagem
- 💤 **Quanto tempo resta** da pausa automática

**Tudo atualiza automaticamente a cada segundo!** 🎉✨







