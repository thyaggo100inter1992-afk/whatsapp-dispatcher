# 🧪 Instruções para Testar o Salvamento de Carrossel

## 🚀 Passo a Passo:

### 1. Reiniciar o Backend

Primeiro, **pare o backend** se estiver rodando:
- No terminal do backend, pressione `Ctrl+C`

Depois, **inicie novamente**:
```bash
cd backend
npm run dev
```

### 2. Criar um NOVO Template

**IMPORTANTE:** Vamos criar um novo template para testar o salvamento completo.

1. **Vá para:** http://localhost:3000/qr-templates/criar
2. **Selecione tipo:** Mensagem Combinada
3. **Adicione um bloco:** Carrossel
4. **Adicione 2 cards** ao carrossel
5. **Faça upload de imagens** nos 2 cards
   - Espere aparecer "✅ Imagem do card enviada!"
6. **Preencha o nome:** "Teste Carrossel Novo"
7. **Clique em "Salvar como Template"**

### 3. Verificar os Logs

**Console do Frontend (F12 → Console):**
Deve mostrar:
```
📦 COLETANDO IMAGENS DE CARROSSEL DOS BLOCOS...
   ✅ Card 0 do Bloco 0: C:\...
   ✅ Card 1 do Bloco 0: C:\...
📦 Total de 2 imagem(ns) de carrossel coletadas
```

**Console do Backend (Terminal):**
Deve mostrar:
```
🚀 ============================================
🚀 CRIANDO TEMPLATE - Dados recebidos:
🚀 Carousel Images: SIM    ← ✅ DEVE SER "SIM"
🚀 Quantidade de imagens de carrossel: 2
🚀 ============================================

🎠 ============================================
🎠 PROCESSANDO IMAGENS DE CARROSSEL DOS BLOCOS
🎠 ============================================
   📸 Processando imagem do card 0...
      Block ID: ...
      Block Order: ...
      Card Index: 0
      Path: C:\...
      ✅ Imagem do card 0 associada!
   📸 Processando imagem do card 1...
      Block ID: ...
      Block Order: ...
      Card Index: 1
      Path: C:\...
      ✅ Imagem do card 1 associada!
🎠 ============================================
🎠 2 IMAGEM(NS) DE CARROSSEL PROCESSADAS!
🎠 ============================================
```

### 4. Verificar no Banco de Dados

Execute o script:
```bash
cd backend
node verificar-dados.js
```

Deve mostrar os dados salvos com `block_id` preenchido.

### 5. Testar Edição

1. Vá para lista de templates
2. Clique em "Editar" no template que você acabou de criar
3. **As imagens devem aparecer!**

**Console do Frontend:**
```
📦 Media files disponíveis: 2    ← ✅ DEVE SER 2!
   🖼️ Card 0 do bloco ...: Imagem carregada
   🖼️ Card 1 do bloco ...: Imagem carregada
```

---

## ❌ Se ainda não funcionar:

Se no **console do backend** aparecer:
```
🚀 Carousel Images: NÃO    ← ❌ PROBLEMA!
```

Isso significa que o **frontend não está enviando** os dados corretamente. Nesse caso, me avise com os logs completos.

---

## 📝 Checklist:

- [ ] Backend reiniciado
- [ ] Novo template criado
- [ ] Upload das imagens feito com sucesso
- [ ] Log do backend mostra "Carousel Images: SIM"
- [ ] Log do backend mostra "PROCESSANDO IMAGENS DE CARROSSEL"
- [ ] Template salvo com sucesso
- [ ] Verificação no banco mostra dados salvos
- [ ] Edição carrega as imagens corretamente

Se qualquer um desses itens falhar, **copie os logs completos** e me envie!







