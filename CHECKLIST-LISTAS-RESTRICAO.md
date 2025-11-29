# ✅ CHECKLIST DE TESTES - LISTAS DE RESTRIÇÃO

Use este checklist para garantir que tudo está funcionando:

---

## 🔐 PRÉ-REQUISITO
- [ ] Você está **LOGADO** no sistema (token válido)
- [ ] Backend está **RODANDO** (`npm run dev`)
- [ ] Frontend está **RODANDO** (`npm run dev`)

---

## 📍 ACESSAR A PÁGINA
- [ ] Abrir `http://localhost:3000/listas-restricao`
- [ ] Página carregou sem erro 401
- [ ] Estatísticas apareceram no topo
- [ ] As 3 abas estão visíveis (BLOQUEADO, NÃO ME PERTURBE, SEM INTERESSE)

---

## ➕ ADICIONAR CONTATO INDIVIDUAL

### Na aba BLOQUEADO:
- [ ] Preencher Nome: "Teste Manual"
- [ ] Preencher Telefone: "5511999998888"
- [ ] Preencher CPF: "12345678900"
- [ ] Clicar em "ADICIONAR"
- [ ] Toast de sucesso apareceu
- [ ] Contato apareceu na lista
- [ ] Estatísticas foram atualizadas

---

## 🔍 BUSCAR CONTATOS
- [ ] Digitar "Teste" no campo de busca
- [ ] Lista filtrou automaticamente
- [ ] Apenas contatos com "Teste" no nome aparecem

---

## 🎛️ FILTRAR POR CONTA
- [ ] Selecionar uma conta WhatsApp no dropdown
- [ ] Lista filtrou por conta
- [ ] Limpar filtro (selecionar "Todas as contas")
- [ ] Lista voltou ao normal

---

## 🔄 TROCAR ENTRE ABAS
- [ ] Clicar na aba "NÃO ME PERTURBE"
- [ ] Lista carregou com contatos dessa aba
- [ ] Clicar na aba "SEM INTERESSE"
- [ ] Lista carregou com contatos dessa aba
- [ ] Voltar para "BLOQUEADO"

---

## 🗑️ EXCLUIR UM CONTATO
- [ ] Clicar no ícone de lixeira de um contato
- [ ] Modal de confirmação apareceu
- [ ] Confirmar exclusão
- [ ] Toast de sucesso apareceu
- [ ] Contato sumiu da lista
- [ ] Estatísticas foram atualizadas

---

## ☑️ EXCLUIR MÚLTIPLOS CONTATOS
- [ ] Selecionar 3+ contatos (checkboxes)
- [ ] Botão "EXCLUIR SELECIONADOS" ficou visível
- [ ] Clicar no botão
- [ ] Modal de confirmação apareceu mostrando quantidade
- [ ] Confirmar exclusão
- [ ] Toast de sucesso apareceu
- [ ] Contatos sumiram da lista
- [ ] Estatísticas foram atualizadas

---

## 🧹 EXCLUIR TODOS OS CONTATOS
- [ ] Clicar no botão "EXCLUIR TODOS (X)"
- [ ] Modal de confirmação apareceu com AVISO VERMELHO
- [ ] Digitar "EXCLUIR TUDO" no campo
- [ ] Botão de confirmação habilitou
- [ ] Confirmar exclusão
- [ ] Toast de sucesso apareceu
- [ ] Lista ficou vazia
- [ ] Estatísticas foram zeradas

---

## 📥 IMPORTAR EXCEL

### Preparar arquivo Excel:
```
| Nome          | Telefone      | CPF         |
|---------------|---------------|-------------|
| João Silva    | 5511988887777 | 11122233344 |
| Maria Santos  | 5511977776666 | 22233344455 |
| Pedro Costa   | 5511966665555 | 33344455566 |
```

### Importar:
- [ ] Clicar em "IMPORTAR EXCEL"
- [ ] Modal de seleção de arquivo abriu
- [ ] Selecionar arquivo .xlsx
- [ ] Modal de confirmação apareceu
- [ ] Confirmar importação
- [ ] Toast de sucesso apareceu
- [ ] Contatos apareceram na lista
- [ ] Estatísticas foram atualizadas

---

## 📤 EXPORTAR EXCEL
- [ ] Clicar em "EXPORTAR EXCEL"
- [ ] Arquivo .xlsx baixou automaticamente
- [ ] Abrir arquivo no Excel
- [ ] Verificar colunas estão corretas
- [ ] **IMPORTANTE:** Telefones estão SEM formatação (apenas números)
  - ✅ Correto: `5511999998888`
  - ❌ Errado: `+55 (11) 99999-8888`

---

## 🎨 VERIFICAÇÕES VISUAIS

### Aba BLOQUEADO:
- [ ] Cor laranja/vermelha
- [ ] Ícone 🚫

### Aba NÃO ME PERTURBE:
- [ ] Cor cinza
- [ ] Ícone 🔕

### Aba SEM INTERESSE:
- [ ] Cor cinza
- [ ] Ícone ⛔

### Estatísticas:
- [ ] Card mostra total de contatos
- [ ] Card mostra adicionados hoje
- [ ] Números atualizam em tempo real

---

## 🚨 ERROS QUE NÃO DEVEM APARECER

### ❌ NO CONSOLE (F12):
- [ ] Nenhum erro 401 (Unauthorized)
- [ ] Nenhum erro 404 (Not Found)
- [ ] Nenhum erro 400 (Bad Request)
- [ ] Nenhum erro de CORS

### ❌ NA TELA:
- [ ] Nenhum toast de erro não esperado
- [ ] Nenhuma tela branca
- [ ] Nenhum "undefined" ou "null" visível

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

Se encontrar erro 401:
1. Fazer **LOGOUT**
2. Fazer **LOGIN** novamente
3. Repetir testes

Se encontrar erro 404:
1. **REINICIAR O BACKEND**
2. Aguardar mensagem: `✅ Rota /restriction-lists registrada`
3. Repetir testes

---

**Data da última validação:** 20/11/2025
**Status:** ✅ VALIDADO E FUNCIONANDO




