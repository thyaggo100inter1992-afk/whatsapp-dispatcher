# 🔍 Sistema de Diagnóstico de Credenciais UAZAP Multi-Tenant

## 📋 O que é?

Sistema que ajuda a identificar e resolver problemas quando **cada tenant está usando uma conta UAZAP diferente**.

## 🎯 Problema Resolvido

Quando você tem:
- **Tenant 1** → Usando credencial UAZAP "A" (servidor X, token Y)
- **Tenant 2** → Usando credencial UAZAP "B" (servidor Z, token W)

E acontece o erro:
```
❌ Invalid token.
❌ Instância desconectada, envio cancelado
```

**Causa:** As instâncias foram criadas em UMA conta UAZAP, mas o tenant foi configurado para usar OUTRA conta UAZAP!

## 🛠️ Como Funciona

### 1️⃣ Backend - API de Diagnóstico

**Arquivo criado:** `backend/src/routes/diagnostic-credentials.js`

#### Endpoints disponíveis:

##### 🔍 GET `/api/diagnostic/credentials/tenant-info`
**Descrição:** Mostra informações detalhadas do tenant atual

**Retorna:**
- Informações do tenant
- Credencial UAZAP configurada
- Credencial UAZAP sendo usada em runtime
- Lista de instâncias
- Verificação se cada instância existe na conta UAZAP atual
- Diagnóstico de problemas

**Exemplo de resposta:**
```json
{
  "success": true,
  "diagnostic": {
    "tenant": {
      "id": 1,
      "nome": "Empresa ABC",
      "slug": "empresa-abc"
    },
    "credencial_configurada": {
      "id": 2,
      "nome": "UAZAP - Conta B",
      "url": "https://servidor-b.uazapi.com",
      "padrao": false,
      "ativa": true
    },
    "credencial_em_uso": {
      "serverUrl": "https://servidor-b.uazapi.com",
      "adminToken": "ABC123...",
      "credentialId": 2,
      "credentialName": "UAZAP - Conta B"
    },
    "instancias": {
      "total": 5,
      "conectadas": 2,
      "desconectadas": 1,
      "com_problema": 2
    },
    "verificacao_detalhada": [
      {
        "id": 10,
        "name": "WhatsApp 1",
        "token": "token123...",
        "is_connected": true,
        "status": "connected",
        "phone_number": "5511999999999",
        "existe_na_conta_atual": true,
        "problema": null
      },
      {
        "id": 11,
        "name": "WhatsApp 2",
        "token": "token456...",
        "is_connected": false,
        "status": "disconnected",
        "phone_number": null,
        "existe_na_conta_atual": false,
        "problema": "⚠️ INSTÂNCIA NÃO EXISTE NA CONTA UAZAP ATUAL!"
      }
    ],
    "status": "COM_PROBLEMAS",
    "recomendacao": "⚠️ ATENÇÃO: Algumas instâncias não existem na conta UAZAP atual! Você precisa deletar essas instâncias do banco de dados e recriá-las, OU mudar a credencial do tenant de volta para a conta correta."
  }
}
```

##### 📋 GET `/api/diagnostic/credentials/all-tenants`
**Descrição:** Lista TODOS os tenants e suas credenciais (apenas para visualização geral)

**Retorna:**
```json
{
  "success": true,
  "tenants": [
    {
      "id": 1,
      "nome": "Tenant A",
      "slug": "tenant-a",
      "uazap_credential_id": 1,
      "credencial_nome": "UAZAP Padrão",
      "credencial_url": "https://nettsistemas.uazapi.com",
      "total_instancias": 5,
      "instancias_conectadas": 3
    },
    {
      "id": 2,
      "nome": "Tenant B",
      "slug": "tenant-b",
      "uazap_credential_id": 2,
      "credencial_nome": "UAZAP - Conta 2",
      "credencial_url": "https://outra-conta.uazapi.com",
      "total_instancias": 2,
      "instancias_conectadas": 2
    }
  ]
}
```

##### 🔑 GET `/api/diagnostic/credentials/available`
**Descrição:** Lista todas as credenciais UAZAP disponíveis no sistema

**Retorna:**
```json
{
  "success": true,
  "credentials": [
    {
      "id": 1,
      "name": "UAZAP Padrão",
      "description": "Credencial padrão UAZAP para novos tenants",
      "server_url": "https://nettsistemas.uazapi.com",
      "is_default": true,
      "is_active": true,
      "tenants_usando": 5,
      "created_at": "2024-11-22T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "UAZAP - Conta 2",
      "description": "Conta alternativa para clientes premium",
      "server_url": "https://outra-conta.uazapi.com",
      "is_default": false,
      "is_active": true,
      "tenants_usando": 2,
      "created_at": "2024-11-22T11:00:00.000Z"
    }
  ]
}
```

### 2️⃣ Frontend - Página de Diagnóstico

**Arquivo criado:** `frontend/src/pages/diagnostic/credentials.tsx`

**Tela visual** que mostra:
- ✅ Status geral (OK ou COM_PROBLEMAS)
- 👤 Informações do tenant
- 🔑 Credencial configurada
- 🔐 Credencial sendo usada
- 📱 Estatísticas das instâncias
- 🔍 Tabela detalhada com verificação de cada instância
- 🛠️ Instruções de como corrigir problemas

## 📸 Como Usar

### Passo 1: Acessar a página de diagnóstico

No seu navegador, acesse:
```
http://localhost:3000/diagnostic/credentials
```

### Passo 2: Analisar o resultado

#### ✅ Se estiver tudo OK:
Você verá uma tela verde com a mensagem:
```
✅ TUDO OK
Tudo OK! Todas as instâncias existem na conta UAZAP configurada.
```

#### ⚠️ Se houver problemas:
Você verá uma tela vermelha com a mensagem:
```
⚠️ PROBLEMAS DETECTADOS
ATENÇÃO: Algumas instâncias não existem na conta UAZAP atual!
```

E uma tabela mostrando **exatamente quais instâncias** têm problema.

### Passo 3: Corrigir o problema

Você tem **2 opções**:

#### 🔧 Opção 1: Deletar e Recriar as Instâncias (Recomendado)
1. Vá em "Gerenciar Conexões"
2. Delete as instâncias com problema (marcadas em vermelho)
3. Crie novas conexões
4. Leia o QR Code novamente

#### 🔄 Opção 2: Alterar a Credencial do Tenant
1. Contate o administrador do sistema (super_admin)
2. Peça para alterar a credencial UAZAP do seu tenant
3. O admin deve ir em "Administração" → "Tenants" → Editar Tenant
4. Selecionar a credencial correta (onde as instâncias foram criadas)
5. Aguarde alguns segundos e atualize a página de diagnóstico

## 🔧 Para Administradores (Super Admin)

### Como alterar a credencial de um tenant:

1. Faça login como super_admin
2. Vá em "Administração" → "Tenants"
3. Clique em "Editar" no tenant desejado
4. Na seção "Credenciais", selecione a credencial UAZAP correta
5. Salve as alterações

### Como criar uma nova credencial UAZAP:

1. Faça login como super_admin
2. Vá em "Administração" → "Credenciais"
3. Clique em "Nova Credencial UAZAP"
4. Preencha:
   - **Nome:** Ex: "UAZAP - Conta Premium"
   - **URL do Servidor:** Ex: `https://meu-servidor.uazapi.com`
   - **Admin Token:** Token de administrador da conta UAZAP
   - **Padrão:** Marque se esta será a credencial padrão para novos tenants
5. Salve

### Como visualizar todos os tenants e suas credenciais:

Faça uma requisição para:
```
GET /api/diagnostic/credentials/all-tenants
```

## 🔍 Testes Via API

### Teste 1: Verificar credenciais do seu tenant
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:4000/api/diagnostic/credentials/tenant-info
```

### Teste 2: Listar todas as credenciais disponíveis
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:4000/api/diagnostic/credentials/available
```

### Teste 3: Listar todos os tenants (apenas super_admin)
```bash
curl -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  http://localhost:4000/api/diagnostic/credentials/all-tenants
```

## 📊 Logs de Diagnóstico

No console do backend, você verá logs detalhados:

```
🔍 Buscando credenciais UAZAP para tenant 1...
✅ Usando credencial específica do tenant: "UAZAP - Conta 2"
   URL: https://outra-conta.uazapi.com
```

Quando há problemas:
```
⚠️ Instância ID 11 não existe na conta UAZAP atual!
   Nome: WhatsApp 2
   Token: token456...
   Status: disconnected
```

## ⚡ Melhorias Implementadas

### 1. Frontend - Detecção de "Invalid Token"
Todos os arquivos de envio de mensagens agora detectam e mostram mensagem clara:
- ✅ `frontend/src/pages/uaz/enviar-mensagem-unificado.tsx`
- ✅ `frontend/src/pages/uaz/enviar-mensagem.tsx`
- ✅ `frontend/src/pages/uaz/enviar-carrossel.tsx`
- ✅ `frontend/src/pages/uaz/enviar-menu.tsx`

### 2. Backend - Marcação Automática
Quando detecta "Invalid token", o sistema automaticamente marca a instância como desconectada.

### 3. Sistema Multi-Tenant de Credenciais
Já existe no sistema (desde a migration 027):
- Tabela `uazap_credentials` - Armazena múltiplas credenciais UAZAP
- Campo `tenants.uazap_credential_id` - Link do tenant para sua credencial
- Helper `getTenantUazapCredentials()` - Busca a credencial correta do tenant

## 🚀 Próximos Passos Recomendados

1. **Acessar a página de diagnóstico** para ver o status atual
2. **Corrigir as instâncias com problema** seguindo as instruções
3. **Testar o envio de mensagens** novamente
4. **Configurar corretamente** a credencial de cada tenant

## ❓ Dúvidas Frequentes

### P: Por que algumas instâncias não existem na conta UAZAP?
**R:** Porque as instâncias foram criadas quando o tenant estava configurado com OUTRA credencial. Ao alterar a credencial do tenant, as instâncias antigas ficam "órfãs".

### P: Posso ter múltiplas contas UAZAP no mesmo sistema?
**R:** Sim! Você pode criar quantas credenciais UAZAP quiser e atribuir diferentes credenciais para diferentes tenants.

### P: Como saber qual credencial cada tenant está usando?
**R:** Use a página de diagnóstico ou o endpoint `/api/diagnostic/credentials/tenant-info`

### P: O que acontece se eu mudar a credencial de um tenant que já tem instâncias?
**R:** As instâncias antigas NÃO serão movidas automaticamente. Você precisará:
1. Deletar as instâncias antigas
2. OU mudar a credencial de volta
3. OU mover as instâncias manualmente na API UAZAP

---

## 📝 Resumo

Este sistema de diagnóstico foi criado para ajudar você a:
1. ✅ Ver claramente qual credencial UAZAP cada tenant está usando
2. ✅ Identificar instâncias que estão na conta errada
3. ✅ Receber instruções claras de como corrigir
4. ✅ Evitar o erro "Invalid token" no futuro

**Agora você tem controle total sobre as credenciais multi-tenant do seu sistema!** 🎉






