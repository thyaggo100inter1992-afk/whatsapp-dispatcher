# 🎉 TODAS AS FUNCIONALIDADES DE TEMPLATES IMPLEMENTADAS

## 📋 Índice
1. [Criar Templates](#criar-templates)
2. [Gerenciar Templates](#gerenciar-templates)
3. [Tipos de Botões](#tipos-de-botões)
4. [Upload de Mídia](#upload-de-mídia)
5. [Preview](#preview)
6. [Copiar Templates](#copiar-templates)
7. [Sincronizar](#sincronizar)

---

## 1. ✅ CRIAR TEMPLATES

### 📍 Acesso
- **Configurações** → Botão **"Criar Template"**
- URL: `http://localhost:3000/template/criar`

### 🎯 Funcionalidades

#### **1.1 Formatação Automática do Nome**
- ✅ Converte **automaticamente** para minúsculas
- ✅ Substitui **espaços** por `_`
- ✅ Remove **caracteres especiais**
- ✅ Apenas `a-z`, `0-9` e `_` são permitidos

**Exemplo:**
```
Digite: Boas Vindas 2024!
Resultado: boas_vindas_2024
```

#### **1.2 Informações Básicas**
- **Nome do Template** (obrigatório, formatação automática)
- **Categoria**:
  - MARKETING - Promoções, ofertas
  - UTILITY - Confirmações, atualizações
  - AUTHENTICATION - Códigos de verificação
- **Idioma**:
  - Português (Brasil) - `pt_BR`
  - Inglês (EUA) - `en_US`
  - Espanhol (Espanha) - `es_ES`

⚠️ **Aviso**: O WhatsApp pode alterar a categoria automaticamente

#### **1.3 Seleção de Múltiplas Contas**
- ✅ Selecione quantas contas quiser
- ✅ Crie o template em **todas simultaneamente**
- ✅ Resultado individual por conta

#### **1.4 Header (Opcional)**

**Tipos:**
1. **Texto** (até 60 caracteres)
   - Título do template
   - Exemplo: "Bem-vindo! 🎉"

2. **Imagem**
   - Upload opcional de exemplo
   - Máximo: 5MB
   - Formatos: JPG, PNG, GIF

3. **Vídeo**
   - Upload opcional de exemplo
   - Máximo: 16MB
   - Formatos: MP4, 3GP

4. **Documento**
   - Upload opcional de exemplo
   - Máximo: 100MB
   - Formato: PDF

**💡 Importante:** Para mídia, o arquivo pode ser anexado como exemplo, mas será enviado na hora de usar o template, não na criação.

#### **1.5 Conteúdo (Body)** - OBRIGATÓRIO

**Características:**
- Até 1024 caracteres
- Suporta **variáveis dinâmicas**

**Variáveis:**
- Use `{{1}}`, `{{2}}`, `{{3}}`, etc.
- Clique em "Adicionar Variável"
- Informe um exemplo para cada

**Exemplo:**
```
Olá {{1}}! 👋

Sua compra de {{2}} foi aprovada!
Número do pedido: {{3}}

Agradecemos pela preferência! 🎉
```

Variáveis:
- `{{1}}` exemplo: João
- `{{2}}` exemplo: R$ 150,00
- `{{3}}` exemplo: #12345

#### **1.6 Footer (Opcional)**
- Texto pequeno no final
- Até 60 caracteres
- Exemplo: "Responda PARAR para cancelar"

---

## 2. 🔘 TIPOS DE BOTÕES

O sistema suporta **3 tipos de botões**:

### **2.1 Botões de Resposta Rápida**
- **Máximo**: 3 botões
- **Caracteres**: 20 por botão
- **Uso**: Cliente responde rapidamente
- **Exemplo**:
  ```
  [Quero saber mais]
  [Confirmar pedido]
  [Falar com atendente]
  ```

### **2.2 Botões de Telefone**
- **Máximo**: 1 botão
- **Campos**:
  - Texto do botão (até 20 caracteres)
  - Número de telefone (formato internacional)
- **Uso**: Cliente liga diretamente
- **Exemplo**:
  ```
  Texto: Ligar agora
  Telefone: +5562999999999
  ```

### **2.3 Botões de URL**
- **Máximo**: 2 botões
- **Campos**:
  - Texto do botão (até 20 caracteres)
  - URL completa
- **Uso**: Cliente abre link
- **Exemplo**:
  ```
  Botão 1:
    Texto: Ver site
    URL: https://www.meusite.com

  Botão 2:
    Texto: Acompanhar pedido
    URL: https://www.meusite.com/pedidos
  ```

---

## 3. 📤 UPLOAD DE MÍDIA

### **3.1 Upload para Header**

Quando o header for do tipo **IMAGE**, **VIDEO**, **AUDIO** ou **DOCUMENT**:

1. ✅ **Upload opcional** de arquivo de exemplo
2. ✅ **Preview** automático (imagens e vídeos)
3. ✅ **Validação** de tamanho:
   - Imagens: máx. 5MB
   - Vídeos/Áudios: máx. 16MB
   - Documentos: máx. 100MB
4. ✅ **Formatos aceitos**:
   - Imagem: JPG, PNG, GIF, WEBP
   - Vídeo: MP4, 3GP
   - Áudio: MP3, AAC, OGG
   - Documento: PDF

**💡 Importante:** O arquivo serve apenas como **referência** e não é enviado ao WhatsApp no momento da criação do template.

---

## 4. 👁️ PREVIEW DO TEMPLATE

### **4.1 Preview em Tempo Real**

Antes de criar, veja como o template ficará:

- ✅ **Header** (texto ou indicador de mídia)
- ✅ **Body** com variáveis substituídas
- ✅ **Footer**
- ✅ **Botões** (resposta rápida, telefone ou URL)

**Aparência:** Simula a visualização no WhatsApp

---

## 5. 📊 GERENCIAR TEMPLATES

### 📍 Acesso
- **Configurações** → Botão **"Gerenciar Templates"**
- URL: `http://localhost:3000/template/gerenciar`

### 🎯 Funcionalidades

#### **5.1 Listar Templates**
- ✅ Selecione uma conta
- ✅ Veja todos os templates da conta
- ✅ Informações exibidas:
  - Nome do template
  - Status (APPROVED, PENDING, REJECTED)
  - Categoria (MARKETING, UTILITY, AUTHENTICATION)
  - Idioma
  - Número de componentes
  - Preview dos componentes

#### **5.2 Buscar Templates**
- ✅ Busca por **nome**
- ✅ Busca por **categoria**
- ✅ Resultado em tempo real

#### **5.3 Status dos Templates**

**Badges coloridas:**
- 🟢 **APPROVED** (verde) - Pronto para uso
- 🟡 **PENDING** (amarelo) - Aguardando aprovação
- 🔴 **REJECTED** (vermelho) - Rejeitado

---

## 6. ✏️ EDITAR TEMPLATES

### **6.1 Como Funciona a Edição**

⚠️ **IMPORTANTE**: O WhatsApp **NÃO permite editar templates** diretamente via API.

**Solução do Sistema:**
- Ao clicar em **"Editar"**, o sistema:
  1. Carrega os dados do template
  2. Preenche o formulário de criação
  3. Adiciona `_editado` ao nome
  4. Você modifica o que quiser
  5. Cria como **novo template**

### **6.2 Editar Template - Passo a Passo**

1. **Gerenciar Templates** → Selecione a conta
2. Clique no botão **✏️ Editar** do template
3. Sistema abre formulário **preenchido** com:
   - Nome: `template_original_editado`
   - Categoria
   - Idioma
   - Header
   - Conteúdo com variáveis
   - Footer
   - Botões
4. **Modifique** o que desejar
5. Clique em **"Criar"**

**✅ Vantagens:**
- Reaproveita estrutura existente
- Modifica apenas o necessário
- Cria versão atualizada
- Mantém template original

**💡 Dica:** Depois de criar o novo, você pode **deletar** o antigo.

---

## 7. 🗑️ DELETAR TEMPLATES

### **7.1 Deletar Template**

**Passos:**
1. Acesse **Gerenciar Templates**
2. Selecione a conta
3. Clique no botão **🗑️ Deletar** do template
4. Confirme a exclusão

**⚠️ ATENÇÃO:**
- Esta ação **NÃO pode ser desfeita**
- Template será removido do **WhatsApp Business Manager**
- Template será removido do **banco de dados local**
- Campanhas existentes que usam este template **podem falhar**

**Modal de Confirmação:**
```
🗑️ Deletar Template

Tem certeza que deseja deletar este template?

⚠️ ATENÇÃO: Esta ação não pode ser desfeita!

Template: boas_vindas_2024
Conta: 556299xxxxx

[Cancelar]  [Deletar]
```

**Resultado:**
- ✅ Template deletado com sucesso!
- Lista é atualizada automaticamente

---

## 8. 📋 COPIAR TEMPLATES

### **8.1 Copiar para Outras Contas**

**Passos:**
1. Acesse **Gerenciar Templates**
2. Selecione a conta de origem
3. Clique no botão **📋 Copiar** do template
4. Selecione as contas de destino
5. Clique em **"Copiar para X conta(s)"**

**✅ Vantagens:**
- Copia um template já aprovado
- Evita reescrever o mesmo template
- Mantém a mesma estrutura
- Cria em múltiplas contas simultaneamente

**Resultado:**
- Exibe quantas contas receberam o template
- Mostra se houve algum erro

---

## 9. 🔄 SINCRONIZAR TEMPLATES

### **7.1 Sincronização Manual**

**Quando usar:**
- Criou/editou templates no **Business Manager**
- Quer atualizar a lista local

**Como fazer:**
1. Acesse **Gerenciar Templates**
2. Clique em **"Sincronizar Todos"**
3. Aguarde a sincronização
4. Veja quantos templates foram sincronizados

**O que é sincronizado:**
- Todos os templates de todas as contas ativas
- Status atualizado (APPROVED, PENDING, REJECTED)
- Categoria
- Componentes

---

## 10. 🎨 EXEMPLO COMPLETO

### **Criar Template de Promoção**

**Informações:**
- Nome: `promocao_black_friday`
- Categoria: MARKETING
- Idioma: pt_BR
- Contas: 3 selecionadas

**Header:**
- Tipo: Imagem
- Upload: banner_black_friday.jpg (2.5MB)

**Conteúdo:**
```
🔥 BLACK FRIDAY! 🔥

Olá {{1}}! Temos uma oferta EXCLUSIVA para você:

{{2}} com {{3}} de desconto!

Válido HOJE até às 23:59h. Não perca! ⏰
```

**Variáveis:**
- `{{1}}` exemplo: Maria
- `{{2}}` exemplo: Notebook Dell
- `{{3}}` exemplo: 50%

**Footer:**
```
Promoção válida enquanto durarem os estoques
```

**Botões:**
- Tipo: URL
- Botão 1:
  - Texto: Ver produtos
  - URL: https://www.loja.com/black-friday
- Botão 2:
  - Texto: Cupom de desconto
  - URL: https://www.loja.com/cupom/BF2024

---

## 11. 📝 RESULTADO DA CRIAÇÃO

Após criar, você verá:

### **Estatísticas:**
```
✅ Sucesso: 3
❌ Erro: 0
📋 Total: 3
```

### **Detalhes por Conta:**

**Conta 1 (556299xxxxx):**
- ✅ Template criado com sucesso!
- Status: PENDING
- Categoria: MARKETING

**Conta 2 (556291xxxxx):**
- ✅ Template criado com sucesso!
- Status: PENDING
- Categoria: MARKETING

**Conta 3 (556293xxxxx):**
- ✅ Template criado com sucesso!
- Status: PENDING
- Categoria: MARKETING

⚠️ **Se a categoria foi alterada:**
```
⚠️ Categoria foi alterada automaticamente pelo WhatsApp
   De: UTILITY → Para: MARKETING
```

---

## 12. ⚠️ AVISOS IMPORTANTES

### **10.1 Aprovação de Templates**
- Templates ficam em status **PENDING** após criação
- WhatsApp leva **minutos ou horas** para aprovar
- Apenas templates **APPROVED** podem ser usados

### **10.2 Categorias Automáticas**
- WhatsApp pode **alterar** a categoria
- Se o conteúdo for promocional → MARKETING
- Você é notificado se houver mudança

### **10.3 Limites de Botões**
- Resposta Rápida: máx. 3
- Telefone: máx. 1
- URL: máx. 2

### **10.4 Upload de Mídia**
- Arquivos são **opcionais** na criação
- Servem como **referência**
- Arquivos reais são enviados **na campanha**

---

## 13. 🔧 SOLUÇÃO DE PROBLEMAS

### **Erro: "Nome do template já existe"**
**Causa:** Nome duplicado na conta
**Solução:** Use outro nome ou delete o antigo

### **Erro: "Template name does not exist"**
**Causa:** Nome inválido
**Solução:** Use apenas `a-z`, `0-9` e `_`

### **Erro: "Token expirado"**
**Causa:** Access token inválido
**Solução:** Atualize o token em Configurações

### **Categoria alterada automaticamente**
**Causa:** Conteúdo promocional em template UTILITY
**Solução:** Normal, não afeta funcionamento

### **Template não aparece na lista**
**Causa:** Não sincronizado
**Solução:** Clique em "Sincronizar Todos"

### **Erro ao deletar template**
**Causa:** Template sendo usado em campanha ativa
**Solução:** Pause/cancele campanhas que usam este template

### **Não consigo editar template**
**Causa:** WhatsApp não permite edição direta
**Solução:** Use botão "Editar" (cria cópia editável)

---

## 14. 📚 FLUXO COMPLETO

```
1. Criar Template
   ↓
2. Aguardar aprovação (WhatsApp)
   ↓
3. Sincronizar templates (se necessário)
   ↓
4. Usar em campanhas ou envio imediato
   ↓
5. Editar template (se necessário)
   ↓
6. Copiar para outras contas (se necessário)
   ↓
7. Deletar templates obsoletos
```

---

## 15. 🎉 TODAS AS FUNCIONALIDADES

✅ **Criar template** em múltiplas contas
✅ **Formatação automática** de nome
✅ **3 categorias** (Marketing, Utility, Authentication)
✅ **Header** com texto ou mídia
✅ **Variáveis dinâmicas** ilimitadas
✅ **Footer** opcional
✅ **3 tipos de botões** (Resposta, Telefone, URL)
✅ **Upload de mídia** com preview
✅ **Preview do template** antes de criar
✅ **Resultado detalhado** por conta
✅ **Listar templates** por conta
✅ **Buscar templates** por nome/categoria
✅ **Editar templates** (duplicar e modificar)
✅ **Deletar templates** (com confirmação)
✅ **Copiar templates** entre contas
✅ **Sincronizar** com WhatsApp
✅ **Status visual** (Approved, Pending, Rejected)
✅ **Validação completa** de formulário
✅ **Tema escuro** integrado

---

**🎯 SISTEMA COMPLETO DE GERENCIAMENTO DE TEMPLATES!**

