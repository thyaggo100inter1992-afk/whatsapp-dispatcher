# 🗑️ Funcionalidade: Excluir Todas as Conexões + Aviso de Política de 90 Dias

## 📋 Resumo

Implementação de sistema completo para excluir todas as conexões de uma vez e banner de aviso informando que conexões desconectadas há mais de 90 dias devem ser excluídas da plataforma.

---

## 🎯 Funcionalidades Implementadas

### 1️⃣ **Banner de Aviso - Política de 90 Dias** ✅

**Localização:** Tela "Gerenciar Conexões"

#### O que mostra:
- ⚠️ **Aviso destacado** sobre política de retenção de 90 dias
- 📅 Período de retenção claramente especificado (90 dias DESCONECTADA)
- 🗑️ Informação sobre exclusão permanente
- 🎨 Design visual com ícones e cores de alerta (amarelo/laranja)

#### Mensagem exibida:
```
🔔 Política de Retenção de Conexões

⏰ Conexões desconectadas há mais de 90 dias serão excluídas 
   da plataforma.

Para manter suas conexões ativas, certifique-se de usá-las 
regularmente. Conexões desconectadas por 90 dias ou mais 
devem ser removidas da plataforma.

📅 Período: 90 dias desconectada
🗑️ Exclusão Permanente
```

---

### 2️⃣ **Botão "Excluir Todas"** ✅

**Localização:** Cabeçalho da tela "Gerenciar Conexões"

#### Características:
- 🔴 Botão vermelho com ícone de lixeira
- 👁️ Visível apenas quando há instâncias criadas
- 🛡️ Confirmação rigorosa com senha de segurança
- ⚠️ Avisos claros sobre a ação irreversível

#### Fluxo de Confirmação:
```
1. Usuário clica em "Excluir Todas"
2. Sistema mostra prompt com aviso:
   
   ⚠️ ATENÇÃO: Você está prestes a excluir TODAS as X conexões!
   
   Isso irá:
   ✗ Deletar permanentemente da API UAZ (WhatsApp)
   ✗ Remover do banco de dados local
   ✗ Requerer novo QR code para reconectar
   
   Esta ação NÃO pode ser desfeita!
   
   Digite "EXCLUIR TUDO" para confirmar:

3. Usuário deve digitar EXATAMENTE "EXCLUIR TUDO"
4. Sistema executa a exclusão em massa
5. Mostra resultado: "✅ X conexão(ões) excluída(s) com sucesso!"
```

---

### 3️⃣ **API Endpoint - DELETE Todas as Instâncias** ✅

**Endpoint:** `DELETE /api/uaz/instances/delete-all`

#### O que faz:
1. 🔍 Busca todas as instâncias no banco de dados
2. 🗑️ Deleta cada uma permanentemente da API UAZ
3. 🗄️ Remove todas do banco de dados local
4. 📊 Retorna estatísticas da operação

#### Resposta da API:
```json
{
  "success": true,
  "message": "5 instância(s) removida(s) com sucesso",
  "deleted": 5,
  "deletedFromAPI": 4,
  "failedFromAPI": 1
}
```

#### Logs no Console:
```
🗑️ ========================================
🗑️ EXCLUINDO TODAS AS INSTÂNCIAS UAZ
🗑️ ========================================

📋 Total de instâncias encontradas: 5

🗑️ Deletando: Marketing Principal (ID: 1)
   ✅ Deletada com sucesso da API UAZ

🗑️ Deletando: Vendas Team (ID: 2)
   ✅ Deletada com sucesso da API UAZ

...

📊 ========================================
📊 RESUMO DA EXCLUSÃO:
   ├─ Total de instâncias: 5
   ├─ Deletadas da API UAZ: 4
   ├─ Falhas na API UAZ: 1
   └─ Removidas do banco local: 5
📊 ========================================
```

---

## 🔧 Arquivos Modificados

### 1. `frontend/src/pages/configuracoes-uaz.tsx`

#### Imports adicionados:
```typescript
import { 
  // ... imports existentes
  FaExclamationTriangle,
  FaTrashAlt, 
  FaInfoCircle 
} from 'react-icons/fa';
```

#### Função adicionada:
```typescript
const handleDeleteAll = async () => {
  // 1. Verifica se há instâncias
  // 2. Mostra prompt de confirmação
  // 3. Valida senha "EXCLUIR TUDO"
  // 4. Chama API DELETE /uaz/instances/delete-all
  // 5. Recarrega lista de instâncias
}
```

#### Componentes adicionados:
1. **Banner de Aviso (90 dias)** - Linha ~263
2. **Botão "Excluir Todas"** - Linha ~249

---

### 2. `backend/src/routes/uaz.js`

#### Rota adicionada:
**`DELETE /api/uaz/instances/delete-all`** - Linha 417

#### Lógica:
```javascript
1. Busca todas as instâncias (com dados de proxy)
2. Para cada instância:
   - Se tem token: deleta da API UAZ
   - Registra sucesso/falha
3. Deleta todas do banco local com: DELETE FROM uaz_instances
4. Retorna estatísticas completas
```

---

## 🎨 Interface Visual

### Banner de Aviso (90 dias)
```
┌─────────────────────────────────────────────────────┐
│ 🔔 Política de Retenção de Conexões                │
│                                                      │
│ ⏰ Conexões criadas há mais de 90 dias serão        │
│    automaticamente excluídas do sistema.            │
│                                                      │
│ Para manter suas conexões ativas, certifique-se...  │
│                                                      │
│ [📅 Período: 90 dias] [🗑️ Exclusão: Permanente]   │
└─────────────────────────────────────────────────────┘
```

### Botões no Cabeçalho
```
┌──────────────┐  ┌──────────────────┐
│ Nova Instância│  │ 🗑️ Excluir Todas│
└──────────────┘  └──────────────────┘
     (azul)            (vermelho)
```

---

## 🔄 Fluxo Completo

### Cenário 1: Usuário Quer Limpar Tudo
```
1. Usuário → Acessa "Gerenciar Conexões"
2. Usuário → Vê banner de aviso sobre 90 dias
3. Usuário → Clica em "Excluir Todas"
4. Sistema → Mostra prompt de confirmação
5. Usuário → Digite "EXCLUIR TUDO"
6. Sistema → Valida confirmação
7. Backend → DELETE /api/uaz/instances/delete-all
8. Backend → Deleta cada instância da API UAZ
9. Backend → Remove todas do banco local
10. Frontend → Mostra "✅ X conexões excluídas!"
11. Frontend → Recarrega lista (vazia)
```

### Cenário 2: Usuário Cancela
```
1. Usuário → Clica em "Excluir Todas"
2. Sistema → Mostra prompt
3. Usuário → Digita algo diferente de "EXCLUIR TUDO"
4. Sistema → "❌ Operação cancelada"
5. Nada é excluído
```

---

## 🛡️ Segurança

### Validação no Frontend:
1. ✅ Verifica se há instâncias antes de permitir exclusão
2. ✅ Requer confirmação via prompt
3. ✅ Valida senha exata: "EXCLUIR TUDO" (case-sensitive)
4. ✅ Mostra aviso claro sobre irreversibilidade

### Validação no Backend:
1. ✅ Verifica existência de instâncias
2. ✅ Trata erros ao deletar da API UAZ
3. ✅ Continua exclusão local mesmo se API falhar
4. ✅ Retorna estatísticas detalhadas

### Logs Detalhados:
- ✅ Log de início da operação
- ✅ Log para cada instância deletada
- ✅ Log de sucesso/erro na API UAZ
- ✅ Resumo final com estatísticas

---

## 📊 Estatísticas Retornadas

```json
{
  "success": true,
  "message": "5 instância(s) removida(s) com sucesso",
  "deleted": 5,           // Total removido do banco local
  "deletedFromAPI": 4,    // Total deletado da API UAZ
  "failedFromAPI": 1      // Total que falhou na API UAZ
}
```

---

## 🎯 Casos de Uso

### Caso 1: Limpeza Periódica
**Situação:** Empresa quer limpar todas as conexões antigas a cada trimestre

**Solução:**
1. Acessa "Gerenciar Conexões"
2. Vê aviso sobre 90 dias
3. Clica "Excluir Todas"
4. Confirma com "EXCLUIR TUDO"
5. Todas as conexões são removidas

---

### Caso 2: Migração de Sistema
**Situação:** Empresa vai migrar para nova API UAZ

**Solução:**
1. Clica "Excluir Todas" para limpar conexões antigas
2. Cria novas conexões com nova API
3. Escaneia novos QR codes

---

### Caso 3: Teste e Desenvolvimento
**Situação:** Desenvolvedor criou várias conexões de teste

**Solução:**
1. Clica "Excluir Todas"
2. Remove todas as conexões de teste de uma vez
3. Cria apenas as conexões de produção necessárias

---

## ⚙️ Configurações da Política de 90 Dias

### Atualmente:
- ⏰ **Período:** 90 dias DESCONECTADA (fixo)
- 🔔 **Notificação:** Banner sempre visível
- 🗑️ **Exclusão:** Manual - o usuário decide quando excluir

### Sugestão Futura (Opcional):
Se quiser adicionar exclusão automática no futuro, pode usar cron job:
```javascript
// Executar diariamente às 3h da manhã
cron.schedule('0 3 * * *', async () => {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  // Deletar instâncias DESCONECTADAS há mais de 90 dias
  await pool.query(`
    DELETE FROM uaz_instances 
    WHERE is_connected = false 
    AND updated_at < $1
  `, [ninetyDaysAgo]);
});
```

---

## ✅ Checklist de Implementação

- ✅ Banner de aviso sobre 90 dias
- ✅ Botão "Excluir Todas" visível
- ✅ Confirmação rigorosa com senha
- ✅ API endpoint DELETE /instances/delete-all
- ✅ Exclusão da API UAZ implementada
- ✅ Exclusão do banco local implementada
- ✅ Logs detalhados no console
- ✅ Estatísticas retornadas
- ✅ Tratamento de erros
- ✅ Feedback visual ao usuário
- ✅ Banner de aviso sobre 90 dias (desconectada)

---

## 🚀 Como Testar

### Teste 1: Banner de Aviso
1. Acesse "Gerenciar Conexões"
2. ✅ Banner amarelo/laranja deve estar visível
3. ✅ Mensagem sobre 90 dias deve aparecer
4. ✅ Tags "90 dias" e "Automática" devem estar visíveis

### Teste 2: Botão "Excluir Todas"
1. Crie pelo menos 2 conexões
2. ✅ Botão vermelho "Excluir Todas" deve aparecer
3. Clique no botão
4. ✅ Prompt de confirmação deve aparecer
5. Digite "EXCLUIR TUDO"
6. ✅ Todas as conexões devem ser excluídas
7. ✅ Mensagem de sucesso deve aparecer

### Teste 3: Cancelamento
1. Clique em "Excluir Todas"
2. Digite qualquer coisa diferente de "EXCLUIR TUDO"
3. ✅ Operação deve ser cancelada
4. ✅ Nenhuma conexão deve ser excluída

### Teste 4: Logs do Backend
1. Abra console do backend
2. Clique "Excluir Todas" e confirme
3. ✅ Logs detalhados devem aparecer
4. ✅ Resumo com estatísticas deve ser exibido

---

## 🎉 Benefícios

1. ✅ **Limpeza Rápida**: Remove todas as conexões em um clique
2. ✅ **Transparência**: Usuário sabe sobre a política de 90 dias
3. ✅ **Segurança**: Confirmação rigorosa previne exclusões acidentais
4. ✅ **Sincronia**: Deleta tanto da API UAZ quanto do banco local
5. ✅ **Rastreabilidade**: Logs detalhados de toda a operação
6. ✅ **Feedback Claro**: Estatísticas de quantas foram deletadas
7. ✅ **Manutenção**: Facilita limpeza periódica do sistema

---

## 📝 Notas Importantes

### ⚠️ Ação Irreversível
- A exclusão **NÃO PODE SER DESFEITA**
- Todas as conexões são deletadas permanentemente
- Usuário deve criar novas conexões e escanear novos QR codes

### 🔒 Senha de Confirmação
- Deve digitar **exatamente** "EXCLUIR TUDO"
- Case-sensitive (diferencia maiúsculas/minúsculas)
- Qualquer variação cancela a operação

### 📊 Estatísticas
- `deleted`: Total removido do banco local
- `deletedFromAPI`: Quantas foram deletadas da API UAZ com sucesso
- `failedFromAPI`: Quantas falharam ao deletar da API UAZ

### 🔧 Tratamento de Falhas
- Se falhar ao deletar da API UAZ, ainda remove do banco local
- Garante limpeza mesmo em caso de problemas de rede
- Logs mostram quais falharam para troubleshooting

---

## 🎊 Conclusão

Sistema completo implementado com sucesso! Agora os usuários:

- ✅ **Sabem** sobre a política de 90 dias (banner sempre visível)
- ✅ **Podem** excluir todas as conexões de uma vez
- ✅ **Têm** confirmação rigorosa para evitar erros
- ✅ **Recebem** feedback claro sobre o resultado

**Tudo sincronizado entre sua plataforma e a API UAZ!** 🚀

