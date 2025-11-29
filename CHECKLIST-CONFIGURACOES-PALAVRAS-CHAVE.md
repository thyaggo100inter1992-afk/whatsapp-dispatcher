# ✅ CHECKLIST DE TESTES - CONFIGURAÇÕES DE PALAVRAS-CHAVE

Use este checklist para garantir que tudo está funcionando:

---

## 🔐 PRÉ-REQUISITO
- [ ] Você está **LOGADO** no sistema (token válido)
- [ ] Backend está **RODANDO** e reiniciado com as novas rotas
- [ ] Frontend está **RODANDO**

---

## 📍 ACESSAR A PÁGINA
- [ ] Abrir `http://localhost:3000/listas-restricao`
- [ ] Clicar em "⚙️ CONFIGURAÇÕES" (botão no topo)
- [ ] OU acessar diretamente: `http://localhost:3000/listas-restricao/configuracoes`
- [ ] Página carregou sem erro 401
- [ ] Página carregou sem erro 404
- [ ] Cards das 3 listas apareceram:
  - [ ] NÃO ME PERTURBE (Permanente)
  - [ ] BLOQUEADO (365 dias)
  - [ ] SEM INTERESSE (7 dias)

---

## 📅 EDITAR DIAS DE RETENÇÃO

### Testar com lista "SEM INTERESSE":
- [ ] Clicar no ícone de relógio/editar da lista "SEM INTERESSE"
- [ ] Modal "Configurar Dias de Retenção" abriu
- [ ] Ver valor atual: 7 dias
- [ ] Mudar para: **14 dias**
- [ ] Clicar em "Salvar"
- [ ] Toast de sucesso apareceu
- [ ] Card atualizou mostrando "14 dias"
- [ ] **IMPORTANTE:** Se houver contatos existentes nessa lista, as datas de expiração foram recalculadas automaticamente

### Testar valor NULL (permanente):
- [ ] Editar novamente a lista "SEM INTERESSE"
- [ ] Limpar o campo (deixar vazio ou colocar 0)
- [ ] Salvar
- [ ] Toast de sucesso
- [ ] Card mostra "Permanente" ao invés de dias

---

## ➕ ADICIONAR PALAVRA-CHAVE INDIVIDUAL

### Cenário: Botão "SIM, QUERO SABER"
- [ ] Preencher campos:
  - **Lista:** Bloqueado
  - **Conta WhatsApp:** (selecionar uma)
  - **Palavra/Texto:** `SIM, QUERO SABER`
  - **Tipo:** Texto do Botão
  - **Match:** Exato
  - **Case Sensitive:** Não (desmarcado)
- [ ] Clicar em "ADICIONAR"
- [ ] Toast de sucesso apareceu
- [ ] Palavra-chave apareceu na lista abaixo
- [ ] Status está como "Ativo" (toggle verde)

---

## ➕ ADICIONAR MÚLTIPLAS PALAVRAS-CHAVE

### Preparar lista de palavras:
```
BLOQUEAR CONTATO
NÃO, TENHO INTERESSE
SIM, QUERO SABER MAIS
PARAR DE ENVIAR
REMOVER
```

### Importar:
- [ ] Clicar em "ADICIONAR MÚLTIPLAS"
- [ ] Modal abriu com campo de texto grande
- [ ] Colar as 5 palavras acima (uma por linha)
- [ ] Configurar:
  - **Lista:** Bloqueado
  - **Conta:** (selecionar uma)
  - **Tipo:** Texto do Botão
  - **Match:** Exato
- [ ] Clicar em "ADICIONAR TODAS"
- [ ] Toast mostra "5/5 palavras-chave adicionadas"
- [ ] Todas as 5 apareceram na lista

---

## 🔍 FILTRAR PALAVRAS-CHAVE

### Filtrar por tipo de lista:
- [ ] Selecionar "BLOQUEADO" no dropdown
- [ ] Lista filtrou automaticamente
- [ ] Apenas keywords de "Bloqueado" aparecem
- [ ] Trocar para "SEM INTERESSE"
- [ ] Lista mudou (se houver keywords)

### Filtrar por conta:
- [ ] Selecionar uma conta no dropdown
- [ ] Lista filtrou por conta
- [ ] Selecionar "Todas as contas"
- [ ] Lista voltou ao normal

---

## 🔄 ATIVAR/DESATIVAR PALAVRA-CHAVE

- [ ] Localizar uma palavra-chave ativa (toggle verde)
- [ ] Clicar no toggle
- [ ] Toast de sucesso
- [ ] Toggle mudou para vermelho (inativo)
- [ ] Badge mudou de "ATIVO" para "INATIVO"
- [ ] Clicar novamente
- [ ] Toggle voltou ao verde (ativo)

---

## 🗑️ EXCLUIR PALAVRA-CHAVE

- [ ] Clicar no ícone de lixeira de uma palavra-chave
- [ ] Modal de confirmação apareceu
- [ ] Confirmar exclusão
- [ ] Toast de sucesso
- [ ] Palavra-chave sumiu da lista

---

## 🎨 VERIFICAÇÕES VISUAIS

### Cards das Listas:
- [ ] **NÃO ME PERTURBE** - Ícone 🔕
- [ ] **BLOQUEADO** - Ícone 🚫  
- [ ] **SEM INTERESSE** - Ícone ⛔

### Tabela de Keywords:
- [ ] Colunas estão organizadas
- [ ] Status com badges coloridos
- [ ] Tipo com ícones:
  - 💬 Texto Digitado
  - 🔘 Texto do Botão
  - 📦 Payload do Botão

### Badges de Match Type:
- [ ] "EXATO" - Badge azul
- [ ] "CONTÉM" - Badge verde
- [ ] "COMEÇA COM" - Badge amarelo
- [ ] "TERMINA COM" - Badge roxo

---

## 🚨 ERROS QUE NÃO DEVEM APARECER

### ❌ NO CONSOLE (F12):
- [ ] Nenhum erro 401 (Unauthorized)
- [ ] Nenhum erro 404 (Not Found) para `/restriction-lists/list-types`
- [ ] Nenhum erro 404 (Not Found) para `/restriction-lists/keywords`
- [ ] Nenhum erro de CORS

### ❌ NA TELA:
- [ ] Nenhum toast de erro não esperado
- [ ] Nenhuma tela branca
- [ ] Nenhum "undefined" ou "null" visível
- [ ] Cards das listas carregaram
- [ ] Dropdowns funcionando

---

## 🧪 TESTE AVANÇADO: Recálculo Automático

### Objetivo: Verificar se mudar dias de retenção afeta contatos existentes

1. **Preparar:**
   - [ ] Ir para página principal de Listas de Restrição
   - [ ] Adicionar 3 contatos na lista "SEM INTERESSE"
   - [ ] Anotar as datas de expiração (devem ser: hoje + 7 dias)

2. **Mudar configuração:**
   - [ ] Voltar para Configurações
   - [ ] Editar "SEM INTERESSE"
   - [ ] Mudar de 7 para **30 dias**
   - [ ] Salvar

3. **Verificar:**
   - [ ] Voltar para página principal
   - [ ] Ver lista "SEM INTERESSE"
   - [ ] Datas de expiração dos 3 contatos mudaram para: hoje + 30 dias
   - [ ] ✅ **SUCESSO!** O recálculo automático funcionou

---

## ✅ RESULTADO ESPERADO

Se **TODOS** os itens acima funcionaram:
- **🎉 PÁGINA 100% FUNCIONAL!**

Se **ALGUM** item falhou:
- Anotar qual item falhou
- Verificar console (F12) para erros
- Reportar erro com detalhes

---

## 🔄 REINICIAR SE NECESSÁRIO

### Se encontrar erro 401:
1. Fazer **LOGOUT**
2. Fazer **LOGIN** novamente
3. Repetir testes

### Se encontrar erro 404:
1. **REINICIAR O BACKEND** (Ctrl+C e `npm run dev`)
2. Aguardar mensagem: `✅ Rota /restriction-lists registrada`
3. Recarregar página (Ctrl+F5)
4. Repetir testes

---

## 📊 FUNCIONALIDADES TESTADAS

- [x] 1. Visualizar configurações das listas
- [x] 2. Editar dias de retenção
- [x] 3. Carregar palavras-chave
- [x] 4. Adicionar palavra-chave individual
- [x] 5. Adicionar múltiplas palavras-chave
- [x] 6. Filtrar por tipo de lista
- [x] 7. Filtrar por conta WhatsApp
- [x] 8. Ativar/Desativar palavra-chave
- [x] 9. Excluir palavra-chave
- [x] 10. Recálculo automático de datas

---

**Data da última validação:** 20/11/2025  
**Status:** ✅ VALIDADO E FUNCIONANDO




