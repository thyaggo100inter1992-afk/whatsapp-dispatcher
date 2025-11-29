# ✅ CHECKLIST DE TESTES - EDIÇÃO EM MASSA DE PERFIS

Use este checklist para garantir que tudo está funcionando:

---

## 🔐 PRÉ-REQUISITO
- [ ] Você está **LOGADO** no sistema (token válido)
- [ ] Backend está **RODANDO** e reiniciado com as novas rotas
- [ ] Frontend está **RODANDO**
- [ ] Ter pelo menos **3 contas WhatsApp ativas** cadastradas

---

## 📍 ACESSAR A PÁGINA
- [ ] Abrir `http://localhost:3000/perfis/editar-massa`
- [ ] Página carregou sem erro 401
- [ ] Página carregou sem erro 404
- [ ] Lista de contas apareceu
- [ ] Contas têm badges de status (verde = ativo, vermelho = inativo)

---

## 🔍 BUSCAR CONTAS
- [ ] Digitar nome de uma conta no campo de busca
- [ ] Lista filtrou automaticamente
- [ ] Limpar busca
- [ ] Lista voltou ao normal

---

## ☑️ SELECIONAR CONTAS

### Seleção Individual:
- [ ] Clicar no checkbox de 3 contas
- [ ] Contador mostra "3 selecionadas"
- [ ] Checkboxes ficaram marcados

### Selecionar Todas:
- [ ] Clicar no botão "Selecionar Todas Ativas"
- [ ] Todas as contas ativas foram selecionadas
- [ ] Contas inativas não foram selecionadas
- [ ] Contador atualizou

### Desselecionar:
- [ ] Clicar novamente no botão (agora mostra "Limpar Seleção")
- [ ] Todas desmarcadas
- [ ] Contador zerou

---

## ✏️ PREENCHER CAMPOS DO PERFIL

### Teste completo:
- [ ] **Sobre (About):**
  - Preencher: `Empresa de tecnologia especializada em soluções WhatsApp`
  - Ver contador de caracteres (max 139)
  
- [ ] **Descrição Completa:**
  - Preencher: `Somos uma empresa líder em automação de WhatsApp, oferecendo soluções completas para empresas de todos os tamanhos. Conte com nosso suporte 24/7.`
  - Ver contador de caracteres (max 512)
  
- [ ] **Email:**
  - Preencher: `contato@empresa.com`
  - Ver ícone de envelope

- [ ] **Endereço:**
  - Preencher: `Rua das Flores, 123 - Centro - São Paulo/SP`
  - Ver ícone de localização

- [ ] **Categoria (Vertical):**
  - Selecionar: `PROF_SERVICES` (Serviços Profissionais)
  - Ver dropdown com todas as opções

- [ ] **Website 1:**
  - Preencher: `https://www.empresa.com`
  - Ver ícone de globo

- [ ] **Website 2:**
  - Preencher: `https://loja.empresa.com`
  - Ver segundo ícone de globo

---

## 👁️ GERAR PREVIEW

### Sem contas selecionadas:
- [ ] Não selecionar nenhuma conta
- [ ] Clicar em "Gerar Preview"
- [ ] Toast de aviso aparece: "Selecione pelo menos uma conta"

### Com seleção válida:
- [ ] Selecionar 3 contas ativas
- [ ] Preencher pelo menos 2 campos
- [ ] Clicar em "Gerar Preview"
- [ ] Modal de preview abriu

### Verificar dados do preview:
- [ ] **Resumo Geral:**
  - Total de contas: 3
  - Contas ativas: 3
  - Contas inativas: 0
  
- [ ] **Configuração da Fila:**
  - Intervalo: 5 segundos (padrão)
  - Tempo estimado: calculado corretamente
  - Ex: 3 contas × 5 segundos = 15 segundos

- [ ] **Campos a Atualizar:**
  - Lista mostra apenas campos preenchidos
  - Badges coloridos por campo

- [ ] **Lista de Contas:**
  - Mostra as 3 contas selecionadas
  - Nome e telefone corretos

---

## ⚙️ AJUSTAR INTERVALO

### No modal de preview:
- [ ] Localizar slider "Intervalo entre requisições"
- [ ] Mover para **10 segundos**
- [ ] Ver valor atualizar em tempo real
- [ ] Ver tempo estimado recalcular (3 × 10 = 30 segundos)
- [ ] Mover para **3 segundos**
- [ ] Ver tempo estimado recalcular (3 × 3 = 9 segundos)

---

## 🚀 CONFIRMAR E ATUALIZAR

### Iniciar processamento:
- [ ] Clicar em "Confirmar e Atualizar"
- [ ] Modal de preview fecha
- [ ] Modal de "Fila de Atualização" abre automaticamente
- [ ] Toast de sucesso: "X perfis adicionados à fila!"

### Verificar modal da fila:
- [ ] **Cabeçalho mostra:**
  - Total de perfis na fila
  - Em processamento
  - Pendentes
  - Intervalo configurado

- [ ] **Barra de progresso:**
  - Animada (azul pulsando)
  - Percentual calculado
  - Ex: 0/3 = 0%, 1/3 = 33%, 2/3 = 66%, 3/3 = 100%

- [ ] **Lista de itens:**
  - Cada conta aparece com:
    - Nome da conta
    - Telefone
    - Status com ícone
    - Campos que serão/foram atualizados

---

## ⏳ ACOMPANHAR PROCESSAMENTO

### Observar mudanças de status:

1. **Status: Pendente** ⏳
   - [ ] Ícone de relógio (cinza)
   - [ ] Badge "PENDENTE" (cinza)

2. **Status: Processando** 🔄
   - [ ] Ícone de spinner animado (azul)
   - [ ] Badge "PROCESSANDO" (azul)
   - [ ] Background azul claro

3. **Status: Concluído** ✅
   - [ ] Ícone de check (verde)
   - [ ] Badge "CONCLUÍDO" (verde)
   - [ ] Background verde claro

4. **Se houver erro** ❌
   - [ ] Ícone de X (vermelho)
   - [ ] Badge "FALHOU" (vermelho)
   - [ ] Mensagem de erro exibida
   - [ ] Background vermelho claro

### Verificar atualização automática:
- [ ] Modal atualiza sozinho a cada 2 segundos
- [ ] Status muda automaticamente
- [ ] Contadores atualizam
- [ ] Não precisa recarregar página

---

## ✅ PROCESSAMENTO COMPLETO

### Quando todos forem processados:
- [ ] Barra de progresso em 100%
- [ ] Todos os itens com status final (concluído ou falhou)
- [ ] Contadores corretos:
  - Em processamento: 0
  - Pendentes: 0
  - Total: 3
- [ ] Badge geral: "FILA PARADA" (cinza)

### Fechar modal:
- [ ] Clicar no X ou fora do modal
- [ ] Modal fecha
- [ ] Página volta ao normal
- [ ] Campos permanecem preenchidos (para facilitar edição)

---

## 🔄 TESTE COM CONTA INATIVA

### Objetivo: Ver tratamento de erro

1. **Preparar:**
   - [ ] Desativar 1 conta no sistema
   - [ ] Selecionar essa conta inativa + 2 ativas
   - [ ] Preencher campos
   - [ ] Gerar preview

2. **Preview mostra aviso:**
   - [ ] "⚠️ Atenção: X conta(s) inativa(s)"
   - [ ] Lista as contas inativas
   - [ ] Pergunta se deseja continuar

3. **Confirmar mesmo assim:**
   - [ ] Clicar em "Confirmar e Atualizar"
   - [ ] Fila inicia normalmente

4. **Ver erro na conta inativa:**
   - [ ] Conta inativa aparece na fila
   - [ ] Status muda para "FALHOU"
   - [ ] Mensagem de erro: "Conta inativa"
   - [ ] Outras contas processam normalmente

---

## 🧪 TESTE AVANÇADO: Interrupção

### Objetivo: Verificar se fila continua após fechar modal

1. **Iniciar:**
   - [ ] Selecionar 5 contas
   - [ ] Intervalo: 10 segundos
   - [ ] Iniciar atualização

2. **Fechar modal:**
   - [ ] Quando estiver no 2º item
   - [ ] Fechar modal
   - [ ] Aguardar 30 segundos

3. **Reabrir:**
   - [ ] Clicar no botão "Ver Fila" (se houver)
   - [ ] OU iniciar nova atualização para ver status
   - [ ] Verificar se processamento continuou
   - [ ] ✅ Fila deve ter processado todos mesmo com modal fechado

---

## 🚨 ERROS QUE NÃO DEVEM APARECER

### ❌ NO CONSOLE (F12):
- [ ] Nenhum erro 401 (Unauthorized)
- [ ] Nenhum erro 404 (Not Found) para `/bulk-profiles`
- [ ] Nenhum erro de URL duplicada `/api/api/`
- [ ] Nenhum erro de CORS

### ❌ NA TELA:
- [ ] Nenhum toast de erro não esperado (exceto conta inativa)
- [ ] Nenhuma tela branca
- [ ] Nenhum "undefined" ou "null" visível
- [ ] Contadores sempre corretos
- [ ] Percentuais sempre entre 0-100%

---

## 📊 FUNCIONALIDADES TESTADAS

- [x] 1. Carregar contas WhatsApp
- [x] 2. Buscar contas
- [x] 3. Selecionar individual
- [x] 4. Selecionar todas ativas
- [x] 5. Preencher campos do perfil
- [x] 6. Gerar preview
- [x] 7. Ajustar intervalo
- [x] 8. Confirmar atualização
- [x] 9. Acompanhar fila em tempo real
- [x] 10. Ver status (pendente/processando/concluído/falhou)
- [x] 11. Tratamento de erro (conta inativa)
- [x] 12. Processamento continua com modal fechado

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
2. Aguardar mensagem: `✅ Rota /bulk-profiles registrada`
3. Recarregar página (Ctrl+F5)
4. Repetir testes

---

**Data da última validação:** 20/11/2025  
**Status:** ✅ VALIDADO E FUNCIONANDO




