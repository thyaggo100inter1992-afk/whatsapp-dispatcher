# 🧹 Limpeza Automática de Arquivos

## ✅ **CONFIGURADO COM SUCESSO!**

### **Arquivos são removidos automaticamente após 15 dias**

---

## 🎯 **COMO FUNCIONA:**

### **1. Limpeza Automática Diária**
- ⏰ **Horário:** Todos os dias às **2h da manhã**
- 🗑️ **Ação:** Remove arquivos com mais de **15 dias**
- 📁 **Local:** `backend/uploads/media/`

### **2. Limpeza ao Iniciar o Servidor**
- 🚀 Sempre que o backend inicia, verifica e limpa arquivos antigos
- 📊 Mostra relatório no console

### **3. Limpeza Manual (API)**
- 🔗 **Endpoint:** `POST http://localhost:3001/api/storage/cleanup`
- ✅ Remove arquivos antigos instantaneamente
- 📊 Retorna relatório de arquivos removidos

---

## 📊 **ESTATÍSTICAS DE ARMAZENAMENTO:**

### **Ver Estatísticas Atuais:**
```bash
GET http://localhost:3001/api/storage/stats
```

**Retorna:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 15,           // Total de arquivos
    "totalSizeBytes": 20231055, // Tamanho total em bytes
    "totalSizeMB": 19.29,       // Tamanho total em MB
    "oldestFileAge": 0,         // Idade do arquivo mais antigo (dias)
    "newestFileAge": 0,         // Idade do arquivo mais novo (dias)
    "maxAgeInDays": 15,         // Limite de idade
    "message": "Arquivos são removidos automaticamente após 15 dias"
  }
}
```

---

## 🛠️ **EXECUTAR LIMPEZA MANUAL:**

### **Via API (Recomendado):**
```bash
POST http://localhost:3001/api/storage/cleanup
```

**Retorna:**
```json
{
  "success": true,
  "data": {
    "deleted": 3,              // Arquivos removidos
    "errors": 0,               // Erros encontrados
    "files": [                 // Lista de arquivos removidos
      "old-file-1.jpg",
      "old-file-2.mp4",
      "old-file-3.png"
    ]
  },
  "message": "Limpeza concluída. 3 arquivo(s) removido(s)."
}
```

### **Via PowerShell (Emergência):**
```powershell
# ⚠️ CUIDADO: Remove TODOS os arquivos!
Remove-Item "C:\Users\thyag\Videos\NOVO DISPARADOR DE API OFICIAL\backend\uploads\media\*" -Force
```

---

## 📝 **LOGS NO CONSOLE:**

### **Ao Iniciar o Servidor:**
```
🧹 Executando limpeza inicial de arquivos antigos...
📁 Diretório: C:\...\backend\uploads\media
⏰ Removendo arquivos com mais de 15 dias
📊 Encontrados 15 arquivos para verificar

✅ Limpeza concluída!
   📊 Total verificado: 15
   🗑️  Arquivos removidos: 0
   ❌ Erros: 0

✅ Limpeza automática configurada (todos os dias às 2h)
🗑️  Arquivos com mais de 15 dias serão removidos automaticamente
```

### **Durante a Limpeza Automática:**
```
⏰ Executando limpeza agendada de arquivos antigos...
🗑️  Removido: old-image.jpg (16 dias)
🗑️  Removido: old-video.mp4 (17 dias)
✅ Limpeza concluída!
   📊 Total verificado: 50
   🗑️  Arquivos removidos: 2
   ❌ Erros: 0
```

---

## ⚙️ **CONFIGURAÇÃO:**

### **Alterar o Período de Limpeza:**

Edite o arquivo: `backend/src/services/cleanup.service.ts`

```typescript
export class CleanupService {
  private maxAgeInDays = 15; // ← Altere aqui (dias)
  // ...
}
```

### **Alterar o Horário da Limpeza:**

Edite o arquivo: `backend/src/server.ts`

```typescript
// Formato: minuto hora dia mês dia-da-semana
cron.schedule('0 2 * * *', async () => { // ← Altere aqui
  // 0 2 * * * = Todos os dias às 2h
  // 0 3 * * * = Todos os dias às 3h
  // 0 */6 * * * = A cada 6 horas
  // 0 0 * * 0 = Todo domingo à meia-noite
  await cleanupService.cleanOldMediaFiles();
});
```

---

## 🎯 **VANTAGENS:**

✅ **Economia de Espaço:** Servidor sempre limpo
✅ **Automático:** Não precisa lembrar de limpar
✅ **Flexível:** Pode executar manualmente quando quiser
✅ **Transparente:** Logs detalhados de tudo que foi removido
✅ **Seguro:** Só remove arquivos antigos, nunca arquivos recentes

---

## 📦 **ARQUIVOS CRIADOS:**

```
backend/
  ├── src/
  │   ├── services/
  │   │   └── cleanup.service.ts       ← Serviço de limpeza
  │   ├── controllers/
  │   │   └── storage.controller.ts    ← Controller da API
  │   ├── routes/
  │   │   └── index.ts                 ← Rotas da API (modificado)
  │   └── server.ts                    ← Servidor (modificado)
  └── package.json                     ← node-cron adicionado
```

---

## 🧪 **TESTE AGORA:**

### **1. Ver Estatísticas:**
Abra o navegador:
```
http://localhost:3001/api/storage/stats
```

### **2. Executar Limpeza Manual:**
Use Postman, Insomnia ou curl:
```bash
curl -X POST http://localhost:3001/api/storage/cleanup
```

---

## 🎉 **PRONTO!**

Seu sistema agora:
- ✅ Remove arquivos antigos automaticamente
- ✅ Libera espaço no servidor
- ✅ Mantém apenas arquivos recentes (últimos 15 dias)
- ✅ Você pode verificar estatísticas a qualquer momento
- ✅ Pode executar limpeza manual quando quiser

---

## ❓ **DÚVIDAS FREQUENTES:**

**Q: Os arquivos são removidos imediatamente após 15 dias?**
A: Não. A limpeza roda às 2h da manhã, então um arquivo de 15 dias pode ser removido às 2h do 16º dia.

**Q: Posso recuperar arquivos removidos?**
A: Não. A remoção é permanente. Os arquivos são deletados do servidor.

**Q: E se eu quiser manter um arquivo por mais tempo?**
A: Você pode movê-lo para outra pasta fora de `uploads/media/` ou fazer download antes dele ser removido.

**Q: A limpeza afeta mensagens já enviadas?**
A: Não. Após a mensagem ser enviada, a mídia já está no WhatsApp. O arquivo local é apenas uma cópia.

**Q: Quanto espaço eu economizo?**
A: Depende do seu uso. Você pode ver o espaço ocupado em: `http://localhost:3001/api/storage/stats`

---

**🎯 Configuração completa e funcionando!**


