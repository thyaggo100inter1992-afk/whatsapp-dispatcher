# 🧪 TESTE COM URL EXTERNA

## 📋 Payload de Teste

Use esse payload para testar via Postman ou curl:

```json
{
  "accountIds": [1],
  "templateData": {
    "name": "teste_url_externa",
    "category": "MARKETING",
    "language": "pt_BR",
    "components": [
      {
        "type": "HEADER",
        "format": "IMAGE",
        "example": {
          "header_url": ["https://studio-my-web-picoshare-thiago-zdg.aqqo9s.easypanel.host/-gjrigLN7iH/134003338237152539.jpg"]
        }
      },
      {
        "type": "BODY",
        "text": "Teste com URL externa"
      }
    ]
  },
  "useQueue": true
}
```

## 🚀 Como Testar:

### Via Postman:
1. POST → `http://localhost:3001/api/templates`
2. Headers → `Content-Type: application/json`
3. Body → Cole o JSON acima
4. Send

### Via curl:
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "accountIds": [1],
    "templateData": {
      "name": "teste_url_externa",
      "category": "MARKETING", 
      "language": "pt_BR",
      "components": [
        {
          "type": "HEADER",
          "format": "IMAGE",
          "example": {
            "header_url": ["https://studio-my-web-picoshare-thiago-zdg.aqqo9s.easypanel.host/-gjrigLN7iH/134003338237152539.jpg"]
          }
        },
        {
          "type": "BODY",
          "text": "Teste com URL externa"
        }
      ]
    },
    "useQueue": true
  }'
```

## ✅ Se Funcionar:

Você verá nos logs do backend:
```
✅ Template criado com sucesso!
   Template ID: xxxxx
   Status: PENDING
```

E depois (~30s):
```
🔔 WEBHOOK RECEBIDO
   Event: APPROVED
```

## 💡 Próximos Passos Se Funcionar:

1. **Para DESENVOLVIMENTO**: Continue usando esse serviço de hospedagem
2. **Para PRODUÇÃO**: Use seu próprio servidor (não precisa de serviço externo)




