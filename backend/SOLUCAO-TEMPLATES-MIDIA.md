# ✅ SOLUÇÃO CORRETA PARA TEMPLATES COM MÍDIA

## 🐛 Problemas Identificados e Corrigidos

### 1. **ERRO: "Parâmetro de exemplo não fornecido" / "An unknown error has occurred"**
**Causa:** O WhatsApp **EXIGE** um `example` com `header_url` contendo uma **URL pública e acessível** na criação de templates com mídia. Não aceita Media ID, apenas URL. URLs via ngrok free são bloqueadas.

**Solução Implementada:**
- **Integração com Cloudinary** (serviço de hospedagem de imagens)
- Upload automático para Cloudinary
- Uso de `header_url` com URL pública do Cloudinary
- WhatsApp acessa a URL sem problemas ✅

### 2. **BUG: Array duplo em body_text**
**Causa:** O código estava criando `[["exemplo1", "exemplo2"]]` ao invés de `["exemplo1", "exemplo2"]`

**Código Errado:**
```typescript
body_text: [bodyVariables.map(v => v.example)]  // ❌
```

**Código Correto:**
```typescript
body_text: bodyVariables.map(v => v.example)  // ✅
```

## 📝 Formato Correto do Payload

### Template COM Imagem (CRIAÇÃO):
```json
{
  "name": "meu_template",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE"
      // ⚠️ NÃO incluir "example" na criação!
    },
    {
      "type": "BODY",
      "text": "Seu texto aqui"
    }
  ]
}
```

### Template COM Imagem (ENVIO de mensagem):
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "meu_template",
    "language": { "code": "pt_BR" },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": {
              "id": "1234567890"  // ✅ Media ID usado APENAS no envio!
            }
          }
        ]
      }
    ]
  }
}
```

### Template COM Variáveis:
```json
{
  "type": "BODY",
  "text": "Olá {{1}}, seu código é {{2}}",
  "example": {
    "body_text": ["João", "12345"]  // ✅ Array simples!
  }
}
```

## 🔄 Fluxo Correto (COM CLOUDINARY)

1. **Frontend:**
   - Usuário seleciona imagem
   - Faz upload via `/whatsapp-accounts/:accountId/upload-media`
   - Recebe URL pública do Cloudinary

2. **Backend:**
   - Salva arquivo temporariamente
   - Faz upload para Cloudinary
   - Obtém URL pública permanente (ex: `https://res.cloudinary.com/...`)
   - Remove arquivo temporário
   - Substitui placeholder pela URL do Cloudinary no `example.header_url`
   - Envia para WhatsApp

3. **WhatsApp:**
   - Acessa a URL do Cloudinary
   - Valida formato e tamanho da imagem
   - Aprova o template ✅

## ⚠️ Importante

- **Cloudinary é OBRIGATÓRIO para produção**: URLs locais/ngrok não funcionam
- **Plano gratuito é suficiente**: 25 GB grátis para sempre
- **URLs permanentes**: Não expiram, sempre acessíveis
- **Configuração simples**: Veja `CONFIGURAR-CLOUDINARY.md`

## ✅ Resultados Esperados

Após configurar o Cloudinary, templates com mídia devem ser:
- ✅ Criados com sucesso usando URL do Cloudinary
- ✅ Aparecer corretamente no Meta Business Manager
- ✅ Entrar em análise para aprovação (não mais "unknown error")
- ✅ Status atualizado corretamente no histórico
- ✅ Funcionando 100% em desenvolvimento e produção

