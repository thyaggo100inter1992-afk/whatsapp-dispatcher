# 📄 Criar Templates em Múltiplas Contas

## 🎯 Funcionalidade

Esta funcionalidade permite criar **um template simultaneamente em várias contas WhatsApp**, economizando tempo e garantindo consistência.

---

## 🚀 Como Usar

### 1. Acessar a Funcionalidade

Há duas formas de acessar:

**Opção A:** Menu Principal
- Vá em **Configurações**
- Clique no botão **"Criar Template"**

**Opção B:** URL Direta
- Acesse: `http://localhost:3000/template/criar`

---

### 2. Preencher o Formulário

#### **Informações Básicas**

1. **Nome do Template*** (obrigatório)
   - Formato: apenas letras minúsculas, números e underscores
   - Exemplo: `boas_vindas_2024`, `promocao_natal`
   - ❌ Não usar: espaços, letras maiúsculas, caracteres especiais

2. **Categoria*** (obrigatório)
   - **MARKETING**: Promoções, ofertas, novidades
   - **UTILITY**: Confirmações, atualizações de pedidos, notificações
   - **AUTHENTICATION**: Códigos de verificação (OTP)
   - ⚠️ **IMPORTANTE**: O WhatsApp pode alterar a categoria automaticamente se considerar que o conteúdo não corresponde

3. **Idioma*** (obrigatório)
   - Português (Brasil) - `pt_BR`
   - Inglês (EUA) - `en_US`
   - Espanhol (Espanha) - `es_ES`

---

#### **Selecionar Contas**

- Marque todas as contas onde deseja criar o template
- O template será criado **simultaneamente** em todas as contas selecionadas
- Você pode selecionar quantas contas quiser

---

#### **Header (Opcional)**

Adiciona um cabeçalho ao template.

**Tipos disponíveis:**

- **Texto**: Título curto (até 60 caracteres)
- **Imagem**: Template aceita imagem (arquivo enviado depois)
- **Vídeo**: Template aceita vídeo (arquivo enviado depois)
- **Documento**: Template aceita documento PDF (arquivo enviado depois)

⚠️ **Nota**: Para mídia (imagem/vídeo/documento), o template apenas define que aceita esse tipo. O arquivo será enviado na hora de usar o template, não na criação.

---

#### **Conteúdo (Body)***

O texto principal da mensagem (obrigatório).

**Características:**
- Até 1024 caracteres
- Pode incluir variáveis dinâmicas

**Variáveis:**
- Use `{{1}}`, `{{2}}`, `{{3}}`, etc. para valores dinâmicos
- Clique em **"Adicionar Variável"** para cada variável
- Informe um **exemplo** para cada variável
- Exemplo:
  ```
  Olá {{1}}, sua compra de {{2}} foi aprovada!
  
  Variável 1 exemplo: João
  Variável 2 exemplo: R$ 150,00
  ```

---

#### **Footer (Opcional)**

Texto pequeno no final da mensagem (até 60 caracteres).

Exemplo: `Responda PARAR para cancelar`

---

#### **Botão de Resposta Rápida (Opcional)**

Adiciona um botão para o cliente responder.

- Texto do botão: até 20 caracteres
- Exemplo: `Quero saber mais`, `Confirmar`

---

### 3. Criar Template

Clique em **"Criar Template em N conta(s)"**

O sistema irá:
1. Enviar o template para a API do WhatsApp para cada conta
2. Salvar no banco de dados local
3. Exibir resultado individual por conta

---

## 📊 Resultado da Criação

Após enviar, você verá:

### **Estatísticas:**
- ✅ **Sucesso**: Quantos templates foram criados
- ❌ **Erro**: Quantas contas falharam
- 📋 **Total**: Total de contas processadas

### **Detalhes por Conta:**

Para cada conta, você verá:

**✅ SUCESSO:**
- Número da conta
- Status: `PENDING` (aguardando aprovação) ou `APPROVED`
- Categoria final (pode ser diferente da selecionada)
- ⚠️ Aviso se a categoria foi alterada pelo WhatsApp

**❌ ERRO:**
- Número da conta
- Mensagem de erro
- Possíveis causas:
  - Nome do template já existe
  - Formato inválido
  - Token expirado
  - Conteúdo viola políticas do WhatsApp

---

## ⚠️ Avisos Importantes

### **Categorias Automáticas**

O WhatsApp pode **alterar a categoria automaticamente** se considerar que o conteúdo não corresponde.

**Exemplo:**
- Você escolhe: `UTILITY`
- Conteúdo: "Aproveite 50% de desconto!"
- WhatsApp altera para: `MARKETING`

**Via API você NÃO recebe aviso prévio**, apenas o resultado após a criação.

---

### **Aprovação de Templates**

Após criar, o template fica com status:

- **PENDING**: Aguardando aprovação do WhatsApp (pode levar minutos ou horas)
- **APPROVED**: Aprovado e pronto para uso
- **REJECTED**: Rejeitado (viola políticas)

Para usar o template em campanhas ou mensagens imediatas, ele deve estar **APPROVED**.

---

### **Sincronização**

Se você criar/editar templates diretamente no **Business Manager**, precisará:

1. Ir em **Configurações**
2. Clicar em **"Sincronizar Templates"** (se implementado)
3. Ou aguardar a sincronização automática

---

## 🔄 Criar Outro Template

Após ver o resultado:
- Clique em **"Criar Outro Template"** para criar um novo
- Ou **"Voltar para Configurações"** para voltar

---

## 📋 Exemplo Completo

### Criando um Template de Boas-Vindas em 3 Contas

**Informações:**
- Nome: `boas_vindas_loja`
- Categoria: `MARKETING`
- Idioma: `pt_BR`
- Contas: 3 selecionadas

**Header:**
- Tipo: Texto
- Texto: `Bem-vindo(a) à Nossa Loja! 🎉`

**Conteúdo:**
```
Olá {{1}}! 👋

Que bom ter você aqui! Sua conta foi criada com sucesso.

Use o código {{2}} para ganhar 10% de desconto na primeira compra!

Aproveite! 🛍️
```

**Variáveis:**
- `{{1}}` exemplo: Maria
- `{{2}}` exemplo: BEM10

**Footer:**
```
Não quer receber? Responda PARAR
```

**Botão:**
```
Ver Produtos
```

---

## 🎉 Resultado Esperado

```
✅ Conta 1 (556299xxxxx): Template criado com sucesso!
   Status: PENDING
   Categoria: MARKETING

✅ Conta 2 (556291xxxxx): Template criado com sucesso!
   Status: PENDING
   Categoria: MARKETING

❌ Conta 3 (556293xxxxx): Erro
   Nome já existe
```

**Estatísticas:**
- Sucesso: 2
- Erro: 1
- Total: 3

---

## 🛠️ Solução de Problemas

### **Erro: "Nome do template já existe"**
- Este nome já foi usado nesta conta
- Escolha outro nome ou delete o antigo no Business Manager

### **Erro: "Template name does not exist"**
- Formato de nome inválido
- Use apenas: `a-z`, `0-9`, `_`

### **Erro: "Token expirado"**
- Atualize o `access_token` da conta em Configurações

### **Categoria alterada automaticamente**
- Esperado se o conteúdo for promocional
- Não afeta funcionamento, apenas classificação

---

## 📚 Próximos Passos

Após criar templates:

1. **Aguardar aprovação** no WhatsApp Business Manager
2. **Sincronizar templates** no sistema (se necessário)
3. **Usar em campanhas** ou mensagens imediatas
4. **Monitorar desempenho** no painel

---

## ✅ Vantagens desta Funcionalidade

✅ **Economia de tempo**: Crie uma vez, aplique em todas as contas
✅ **Consistência**: Mesmo template em todas as contas
✅ **Visibilidade**: Veja resultado individual por conta
✅ **Praticidade**: Interface simples e intuitiva
✅ **Feedback imediato**: Saiba na hora se foi criado ou não

---

**🎯 Pronto para criar templates em massa!**

