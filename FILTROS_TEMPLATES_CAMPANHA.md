# 🔍 SISTEMA DE FILTROS AVANÇADOS PARA TEMPLATES

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### **1. 📎 Filtro "Apenas com Mídia"**
Permite visualizar **SOMENTE** templates que contenham arquivos de mídia (imagem, vídeo, documento ou áudio).

### **2. 🎨 Filtro por Tipo de Mídia**
Quando ativado "Apenas com Mídia", você pode escolher o **tipo específico** de mídia:
- **Todos os tipos** - Qualquer template com mídia
- **🖼️ Imagem** - Apenas templates com imagem
- **🎥 Vídeo** - Apenas templates com vídeo
- **📄 Documento** - Apenas templates com documento (PDF, etc)
- **🎵 Áudio** - Apenas templates com áudio

### **3. 📂 Filtro por Categoria**
Filtra templates pela categoria do WhatsApp:
- **Todas** - Mostra todos os templates
- **MARKETING** - Templates de marketing
- **UTILITY** - Templates utilitários
- **AUTHENTICATION** - Templates de autenticação

---

## 📋 COMO USAR

### **Passo 1: Acessar Filtros**
1. Vá em **Campanhas → Nova Campanha**
2. Selecione as contas (passo 2)
3. Na seção **"3. Selecionar Templates"** você verá os filtros

### **Passo 2: Usar Filtros**

#### **Exemplo 1: Buscar templates MARKETING com IMAGEM**
```
🔍 Buscar: (vazio)
❌ Excluir: (vazio)
☑️ Apenas com Mídia → Tipo: 🖼️ Imagem
📂 Categoria: MARKETING

RESULTADO: Apenas templates de MARKETING que tenham IMAGEM
```

#### **Exemplo 2: Buscar templates UTILITÁRIO com DOCUMENTO**
```
🔍 Buscar: (vazio)
❌ Excluir: (vazio)
☑️ Apenas com Mídia → Tipo: 📄 Documento
📂 Categoria: UTILITY

RESULTADO: Apenas templates UTILITÁRIO que tenham DOCUMENTO (PDF, etc)
```

#### **Exemplo 3: Buscar templates com VÍDEO (qualquer categoria)**
```
🔍 Buscar: (vazio)
❌ Excluir: (vazio)
☑️ Apenas com Mídia → Tipo: 🎥 Vídeo
📂 Categoria: Todas

RESULTADO: Todos os templates que tenham VÍDEO
```

#### **Exemplo 4: Buscar templates MARKETING com "promoção" e IMAGEM**
```
🔍 Buscar: promoção
❌ Excluir: (vazio)
☑️ Apenas com Mídia → Tipo: 🖼️ Imagem
📂 Categoria: MARKETING

RESULTADO: Templates MARKETING que contenham "promoção" no nome E tenham IMAGEM
```

#### **Exemplo 5: Buscar templates MARKETING, excluindo "black", com QUALQUER mídia**
```
🔍 Buscar: (vazio)
❌ Excluir: black
☑️ Apenas com Mídia → Tipo: Todos os tipos
📂 Categoria: MARKETING

RESULTADO: Templates MARKETING com qualquer mídia, excluindo os que tenham "black" no nome
```

---

## 🎨 INTERFACE

### **Layout dos Filtros:**

```
┌─────────────────────────────────────────────────────────────┐
│ 3. Selecionar Templates                                     │
│ [Selecionar Todos] [Desmarcar Todos]                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ FILTROS                                              │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │                                                       │   │
│ │ [Linha 1: Busca e Exclusão]                          │   │
│ │ 🔍 Buscar template...    ❌ Excluir que contenham... │   │
│ │ [Digite...]              [Digite...]                  │   │
│ │                                                       │   │
│ │ [Linha 2: Mídia e Categoria]                         │   │
│ │ ☑️ Apenas com Mídia      📂 Categoria                │   │
│ │ Tipo: [Imagem ▼]         [MARKETING ▼]              │   │
│ │                                                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [Lista de templates filtrados]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 COMBINAÇÃO DE FILTROS

**TODOS os filtros trabalham JUNTOS!**

Os filtros são aplicados na seguinte ordem:
1. **Busca** (inclui templates com o texto)
2. **Exclusão** (remove templates com o texto)
3. **Categoria** (filtra pela categoria)
4. **Apenas com Mídia** (remove templates sem mídia)
5. **Tipo de Mídia** (filtra pelo tipo específico)

### **Exemplo Completo:**

```
🔍 Buscar: saque
❌ Excluir: fgts
☑️ Apenas com Mídia → Tipo: 🖼️ Imagem
📂 Categoria: MARKETING

RESULTADO:
1. Busca templates com "saque" no nome
2. Remove os que têm "fgts"
3. Mantém apenas os MARKETING
4. Mantém apenas os que têm mídia
5. Mantém apenas os que têm IMAGEM

= Templates MARKETING, com "saque" no nome, sem "fgts", e com IMAGEM
```

---

## 💡 CASOS DE USO

### **Caso 1: Campanha de Imagens Promocionais**
```
Objetivo: Enviar apenas templates MARKETING com imagens

Configuração:
☑️ Apenas com Mídia → Tipo: Imagem
📂 Categoria: MARKETING

Resultado: Lista apenas templates marketing com imagens
```

### **Caso 2: Templates Utilitários com Documentos**
```
Objetivo: Enviar templates UTILITY com PDFs/documentos

Configuração:
☑️ Apenas com Mídia → Tipo: Documento
📂 Categoria: UTILITY

Resultado: Lista apenas templates utilitários com documentos
```

### **Caso 3: Videos de Marketing Específicos**
```
Objetivo: Encontrar vídeos de "promoção" mas não de "black"

Configuração:
🔍 Buscar: promoção
❌ Excluir: black
☑️ Apenas com Mídia → Tipo: Vídeo
📂 Categoria: MARKETING

Resultado: Videos marketing com "promoção", sem "black"
```

### **Caso 4: Templates com Áudio**
```
Objetivo: Encontrar todos os templates com áudio

Configuração:
☑️ Apenas com Mídia → Tipo: Áudio
📂 Categoria: Todas

Resultado: Todos os templates que têm áudio
```

---

## ⚙️ DETALHES TÉCNICOS

### **Como o Sistema Detecta o Tipo de Mídia:**

O sistema analisa o componente `HEADER` de cada template:
```typescript
// Verifica se tem HEADER com formato de mídia
HEADER.format = 'IMAGE'    → Template tem IMAGEM
HEADER.format = 'VIDEO'    → Template tem VÍDEO
HEADER.format = 'DOCUMENT' → Template tem DOCUMENTO
HEADER.format = 'AUDIO'    → Template tem ÁUDIO
HEADER.format = 'TEXT'     → Template SEM mídia (apenas texto)
```

### **Lógica de Filtro:**

```typescript
1. Se "Apenas com Mídia" está DESMARCADO:
   → Mostra todos os templates (com e sem mídia)

2. Se "Apenas com Mídia" está MARCADO:
   → Remove templates sem mídia
   
   2.1. Se Tipo = "Todos":
        → Aceita qualquer tipo de mídia
   
   2.2. Se Tipo = "Imagem":
        → Aceita apenas templates com IMAGEM
   
   2.3. Se Tipo = "Vídeo":
        → Aceita apenas templates com VÍDEO
   
   (e assim por diante...)
```

---

## 🎯 BENEFÍCIOS

### **1. Economia de Tempo**
- Encontre rapidamente templates específicos
- Não precisa rolar a lista inteira

### **2. Campanhas Organizadas**
- Separe templates por tipo de mídia
- Organize por categoria

### **3. Flexibilidade**
- Combine múltiplos filtros
- Crie buscas muito específicas

### **4. Eficiência**
- Selecione apenas o que precisa
- Evite erros de seleção

---

## 📊 ESTATÍSTICAS DE FILTRO

O sistema mostra em tempo real:
```
Templates encontrados: 12
3 selecionado(s)
```

Assim você sabe:
- Quantos templates correspondem aos filtros
- Quantos você já selecionou

---

## 🔄 RESETAR FILTROS

Para limpar todos os filtros:
1. Limpe os campos de busca e exclusão
2. Desmarque "Apenas com Mídia"
3. Selecione "Todas" em Categoria

---

## 💡 DICAS E TRUQUES

### **Dica 1: Combine Busca com Categoria**
```
🔍 Buscar: natal
📂 Categoria: MARKETING

= Encontra templates MARKETING de natal
```

### **Dica 2: Use Exclusão para Refinar**
```
🔍 Buscar: saque
❌ Excluir: fgts, complementar

= Templates com "saque", mas sem "fgts" ou "complementar"
```

### **Dica 3: Encontre Templates com Mídia Rapidamente**
```
☑️ Apenas com Mídia → Tipo: Todos

= Lista TODOS os templates que têm algum tipo de mídia
```

### **Dica 4: Filtro por Tipo Específico**
```
☑️ Apenas com Mídia → Tipo: Vídeo

= Apenas templates com vídeo (útil para campanhas de vídeo)
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### **1. Filtros São Cumulativos**
Todos os filtros aplicados trabalham juntos. Se você ativar muitos filtros, pode não encontrar nenhum template.

### **2. "Apenas com Mídia" Tem Prioridade**
Se você marcar "Apenas com Mídia", **SOMENTE** templates com mídia aparecerão, mesmo que atendam aos outros critérios.

### **3. Categoria é Baseada no WhatsApp**
As categorias são definidas pelo WhatsApp ao aprovar o template:
- MARKETING: Conteúdo promocional
- UTILITY: Informações úteis, transações
- AUTHENTICATION: Códigos de verificação

### **4. Tipo de Mídia é Detectado Automaticamente**
O sistema lê a estrutura do template para detectar o tipo de mídia. Não é baseado no arquivo que você vai fazer upload.

---

## 🎯 RESUMO

| Filtro | Função | Opções |
|--------|--------|--------|
| **Buscar** | Inclui templates com o texto | Texto livre |
| **Excluir** | Remove templates com o texto | Texto livre |
| **Apenas com Mídia** | Mostra só templates com mídia | Checkbox |
| **Tipo de Mídia** | Filtra por tipo específico | Todos/Imagem/Vídeo/Documento/Áudio |
| **Categoria** | Filtra por categoria WhatsApp | Todas/MARKETING/UTILITY/AUTHENTICATION |

---

## 🚀 RESULTADO FINAL

Com esses filtros, você pode:
- ✅ Encontrar templates específicos em segundos
- ✅ Organizar campanhas por tipo de conteúdo
- ✅ Separar templates com mídia dos sem mídia
- ✅ Filtrar por categoria e tipo de arquivo
- ✅ Combinar múltiplos critérios de busca

---

**🎉 FILTROS AVANÇADOS IMPLEMENTADOS COM SUCESSO!**

**Agora você tem controle total sobre a seleção de templates!** 🚀

