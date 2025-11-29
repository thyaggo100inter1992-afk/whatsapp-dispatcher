# 📸 Fotos de Perfil - Onde Aparecem no Sistema

## ✅ Implementação Concluída

Agora você pode puxar fotos de perfil de qualquer contato do WhatsApp!

---

## 🔧 O Que Foi Implementado

### 1️⃣ **Backend**

**Arquivo:** `backend/src/services/uazService.js`
- ✅ Método `getContactDetails()` adicionado
- ✅ Pega foto + nome + todos os dados do contato

**Arquivo:** `backend/src/routes/uaz.js`
- ✅ Rota `POST /api/uaz/contact/details`
- ✅ Endpoint pronto para uso

---

## 📍 ONDE AS FOTOS VÃO APARECER

### 🎯 1. **Lista de Contatos**

**Arquivo:** `frontend/src/pages/contatos.tsx` (se existir)

```tsx
┌─────────────────────────────────────────┐
│  CONTATOS                               │
├─────────────────────────────────────────┤
│                                         │
│  [👤] João Silva                        │
│   └─ +55 62 99999-9999                 │
│                                         │
│  [📷] Maria Santos                      │
│   └─ +55 62 98888-8888                 │
│                                         │
│  [👤] Pedro Oliveira                    │
│   └─ +55 62 97777-7777                 │
│                                         │
└─────────────────────────────────────────┘
```

**Como implementar:**
```tsx
const [contacts, setContacts] = useState([]);

// Buscar foto para cada contato
const loadContactWithPhoto = async (phoneNumber) => {
  const response = await api.post('/uaz/contact/details', {
    instance_id: instanceId,
    phone_number: phoneNumber,
    preview: true // true = foto pequena para lista
  });
  
  return {
    name: response.data.contact.name,
    phone: response.data.contact.phone,
    photo: response.data.contact.profilePicUrl
  };
};
```

---

### 🎯 2. **Dashboard de Mensagens**

**Arquivo:** `frontend/src/pages/mensagens.tsx`

```tsx
┌─────────────────────────────────────────┐
│  MENSAGENS RECENTES                     │
├─────────────────────────────────────────┤
│  [📷] João Silva                        │
│   └─ Olá, como vai?         12:30      │
│                                         │
│  [👤] Cliente Novo                      │
│   └─ Quero fazer um pedido  12:25      │
│                                         │
│  [📷] Maria Santos                      │
│   └─ Obrigada!              11:45      │
└─────────────────────────────────────────┘
```

**Onde exibir:**
- Ao lado do nome do contato
- Avatar circular 40x40px
- Fallback para ícone se não tiver foto

---

### 🎯 3. **Página de Configurações UAZ**

**Arquivo:** `frontend/src/pages/configuracoes-uaz.tsx`

```tsx
┌─────────────────────────────────────────┐
│  INSTÂNCIAS UAZ                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │ [📷] MinhaInstancia           │     │
│  │  └─ +55 62 99999-9999         │     │
│  │  └─ ✅ Conectada              │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ [👤] OutraInstancia           │     │
│  │  └─ +55 62 98888-8888         │     │
│  │  └─ 🔴 Desconectada           │     │
│  └───────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

**Como implementar:**
```tsx
// Quando conectar instância, buscar foto automaticamente
useEffect(() => {
  if (instance.is_connected && instance.phone_number) {
    fetchInstanceProfilePic(instance.id, instance.phone_number);
  }
}, [instance]);

const fetchInstanceProfilePic = async (instanceId, phoneNumber) => {
  const response = await api.post('/uaz/contact/details', {
    instance_id: instanceId,
    phone_number: phoneNumber,
    preview: false // false = foto original
  });
  
  // Atualizar estado com foto
  setInstancePhoto(response.data.contact.profilePicUrl);
};
```

---

### 🎯 4. **Campanhas - Lista de Destinatários**

**Arquivo:** `frontend/src/pages/campanhas.tsx` ou `frontend/src/pages/qr-campanhas.tsx`

```tsx
┌─────────────────────────────────────────┐
│  CAMPANHA: Black Friday                 │
│  Destinatários: 1.500 contatos          │
├─────────────────────────────────────────┤
│                                         │
│  ✅ [📷] João Silva    +55 62 99999-999 │
│  ✅ [👤] Pedro Lima    +55 62 98888-888 │
│  ✅ [📷] Maria Santos  +55 62 97777-777 │
│  ⏳ [📷] Ana Costa     +55 62 96666-666 │
│  ❌ [👤] José Alves    +55 62 95555-555 │
│                                         │
│  ✅ Enviado  ⏳ Pendente  ❌ Erro       │
└─────────────────────────────────────────┘
```

**Benefício:**
- Visual mais profissional
- Fácil identificar contatos
- Mostra quem tem/não tem foto

---

### 🎯 5. **Verificar Números (Página de Verificação)**

**Arquivo:** `frontend/src/pages/uaz/verificar-numeros.tsx`

```tsx
┌─────────────────────────────────────────┐
│  VERIFICAR NÚMEROS NO WHATSAPP          │
├─────────────────────────────────────────┤
│  Números verificados:                   │
│                                         │
│  ✅ [📷] +55 62 99999-9999              │
│     └─ João Silva                       │
│     └─ WhatsApp Business                │
│                                         │
│  ✅ [👤] +55 62 98888-8888              │
│     └─ Pedro Lima                       │
│     └─ WhatsApp Normal                  │
│                                         │
│  ❌ [❓] +55 62 97777-7777              │
│     └─ Não está no WhatsApp             │
└─────────────────────────────────────────┘
```

**Como implementar:**
```tsx
const verifyNumbersWithPhotos = async (numbers) => {
  const results = [];
  
  for (const number of numbers) {
    // Verificar se existe no WhatsApp
    const checkResponse = await api.post('/uaz/chat/check', {
      numbers: [number]
    });
    
    if (checkResponse.data.exists) {
      // Buscar foto
      const detailsResponse = await api.post('/uaz/contact/details', {
        instance_id: instanceId,
        phone_number: number,
        preview: true
      });
      
      results.push({
        number,
        name: detailsResponse.data.contact.name,
        photo: detailsResponse.data.contact.profilePicUrl,
        exists: true
      });
    } else {
      results.push({
        number,
        exists: false
      });
    }
  }
  
  return results;
};
```

---

### 🎯 6. **Dashboard de Atendimento (Se Tiver)**

```tsx
┌─────────────────────────────────────────┐
│  ATENDIMENTOS ATIVOS                    │
├─────────────────────────────────────────┤
│  [📷] João Silva                        │
│   └─ Aguardando resposta...            │
│   └─ Última msg: 5 min atrás           │
│                                         │
│  [📷] Maria Santos                      │
│   └─ Em atendimento - Ana              │
│   └─ Última msg: 2 min atrás           │
└─────────────────────────────────────────┘
```

---

### 🎯 7. **Modal de Envio de Mensagem**

**Arquivo:** `frontend/src/pages/uaz/enviar-mensagem-unificado.tsx`

```tsx
┌─────────────────────────────────────────┐
│  ENVIAR MENSAGEM                        │
├─────────────────────────────────────────┤
│  Para:                                  │
│  ┌───────────────────────────────┐     │
│  │ [📷] +55 62 99999-9999        │     │
│  │  └─ João Silva                │     │
│  └───────────────────────────────┘     │
│                                         │
│  Mensagem:                              │
│  ┌───────────────────────────────┐     │
│  │ Olá, como vai?                │     │
│  └───────────────────────────────┘     │
│                                         │
│  [Enviar]                               │
└─────────────────────────────────────────┘
```

**Como implementar:**
```tsx
const [selectedContact, setSelectedContact] = useState(null);

const selectContact = async (phoneNumber) => {
  // Buscar dados + foto
  const response = await api.post('/uaz/contact/details', {
    instance_id: instanceId,
    phone_number: phoneNumber,
    preview: false
  });
  
  setSelectedContact({
    phone: phoneNumber,
    name: response.data.contact.name,
    photo: response.data.contact.profilePicUrl
  });
};
```

---

### 🎯 8. **Componente Reutilizável (RECOMENDADO!)**

**Criar:** `frontend/src/components/ContactAvatar.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import api from '@/services/api';

interface ContactAvatarProps {
  instanceId: number;
  phoneNumber: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export const ContactAvatar: React.FC<ContactAvatarProps> = ({
  instanceId,
  phoneNumber,
  size = 'md',
  showName = false
}) => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContactDetails();
  }, [phoneNumber]);

  const loadContactDetails = async () => {
    try {
      const response = await api.post('/uaz/contact/details', {
        instance_id: instanceId,
        phone_number: phoneNumber,
        preview: size === 'sm' // preview para tamanhos pequenos
      });

      setPhoto(response.data.contact.profilePicUrl);
      setName(response.data.contact.name);
    } catch (error) {
      console.error('Erro ao carregar foto:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className={`${sizeClasses[size]} rounded-full bg-gray-300 animate-pulse`} />
      ) : photo ? (
        <img
          src={photo}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-blue-500 flex items-center justify-center text-white font-bold`}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      
      {showName && (
        <span className="text-sm font-medium">{name || phoneNumber}</span>
      )}
    </div>
  );
};
```

**Usar em qualquer lugar:**
```tsx
<ContactAvatar 
  instanceId={1} 
  phoneNumber="5562999999999" 
  size="md"
  showName={true}
/>
```

---

## 🎨 Exemplo Visual Completo

### Lista de Contatos com Fotos:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📋 CONTATOS (150)                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                         ┃
┃  ┌──────────────────────────────────┐  ┃
┃  │  [📷]  João Silva                │  ┃
┃  │   ↑     +55 62 99999-9999         │  ┃
┃  │   │     💬 Última msg: 2h atrás   │  ┃
┃  │ Foto    [Ver Chat] [Enviar]      │  ┃
┃  └──────────────────────────────────┘  ┃
┃                                         ┃
┃  ┌──────────────────────────────────┐  ┃
┃  │  [👤]  Maria Santos              │  ┃
┃  │  Sem    +55 62 98888-8888         │  ┃
┃  │  foto   💬 Última msg: 1 dia      │  ┃
┃  │        [Ver Chat] [Enviar]       │  ┃
┃  └──────────────────────────────────┘  ┃
┃                                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 🚀 Como Usar (Frontend)

### Exemplo Completo:

```typescript
// Em qualquer componente
import api from '@/services/api';

const MyComponent = () => {
  const [contacts, setContacts] = useState([]);

  const loadContactsWithPhotos = async () => {
    const phoneNumbers = ['5562999999999', '5562988888888'];
    const instanceId = 1; // ID da instância conectada

    const contactsData = await Promise.all(
      phoneNumbers.map(async (phone) => {
        try {
          const response = await api.post('/uaz/contact/details', {
            instance_id: instanceId,
            phone_number: phone,
            preview: true // true = foto pequena
          });

          return {
            phone: phone,
            name: response.data.contact.name,
            photo: response.data.contact.profilePicUrl,
            isGroup: response.data.contact.isGroup
          };
        } catch (error) {
          console.error(`Erro ao carregar ${phone}:`, error);
          return {
            phone: phone,
            name: phone,
            photo: null,
            isGroup: false
          };
        }
      })
    );

    setContacts(contactsData);
  };

  return (
    <div>
      {contacts.map((contact) => (
        <div key={contact.phone} className="flex items-center gap-3 p-3">
          {contact.photo ? (
            <img
              src={contact.photo}
              alt={contact.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {contact.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold">{contact.name}</div>
            <div className="text-sm text-gray-500">{contact.phone}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 📊 Otimizações Recomendadas

### 1️⃣ **Cache de Fotos**
```tsx
const photoCache = new Map();

const getContactPhoto = async (instanceId, phone) => {
  const cacheKey = `${instanceId}-${phone}`;
  
  if (photoCache.has(cacheKey)) {
    return photoCache.get(cacheKey);
  }
  
  const response = await api.post('/uaz/contact/details', {
    instance_id: instanceId,
    phone_number: phone,
    preview: true
  });
  
  photoCache.set(cacheKey, response.data.contact.profilePicUrl);
  return response.data.contact.profilePicUrl;
};
```

### 2️⃣ **Lazy Loading**
```tsx
// Carregar fotos apenas quando visível na tela
import { useInView } from 'react-intersection-observer';

const ContactRow = ({ phone }) => {
  const { ref, inView } = useInView({ triggerOnce: true });
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    if (inView) {
      loadPhoto();
    }
  }, [inView]);

  return <div ref={ref}>...</div>;
};
```

### 3️⃣ **Salvar no Banco (Opcional)**
```sql
-- Adicionar campo na tabela contacts
ALTER TABLE contacts ADD COLUMN profile_pic_url TEXT;

-- Atualizar periodicamente
UPDATE contacts 
SET profile_pic_url = 'url_da_foto'
WHERE phone = '5562999999999';
```

---

## 🎯 Resumo - Onde Vão Aparecer

| Lugar | Arquivo | Tamanho Recomendado |
|-------|---------|---------------------|
| **Lista de Contatos** | `contatos.tsx` | Preview (pequeno) |
| **Mensagens** | `mensagens.tsx` | Preview (pequeno) |
| **Configurações UAZ** | `configuracoes-uaz.tsx` | Full (original) |
| **Campanhas** | `campanhas.tsx` | Preview (pequeno) |
| **Verificar Números** | `verificar-numeros.tsx` | Preview (pequeno) |
| **Dashboard** | `dashboard.tsx` | Preview (pequeno) |
| **Modal Envio** | `enviar-mensagem.tsx` | Full (original) |
| **Detalhes Contato** | `contato-detalhes.tsx` | Full (original) |

---

## 🔧 Endpoint Criado

```
POST /api/uaz/contact/details

Body:
{
  "instance_id": 1,
  "phone_number": "5562999999999",
  "preview": false
}

Response:
{
  "success": true,
  "contact": {
    "phone": "5562999999999",
    "name": "João Silva",
    "profilePicUrl": "https://pps.whatsapp.net/v/...",
    "isGroup": false,
    "fullDetails": { ... }
  }
}
```

---

## ✅ Status

**IMPLEMENTADO:**
- ✅ Método `getContactDetails()` no uazService
- ✅ Rota `POST /api/uaz/contact/details` no backend
- ✅ Suporte a fotos em 2 tamanhos (preview e full)
- ✅ Logs detalhados
- ✅ Tratamento de erros

**PRÓXIMO PASSO:**
- 📝 Criar componente `ContactAvatar` no frontend
- 🎨 Adicionar fotos nas páginas listadas acima
- 💾 (Opcional) Salvar fotos no banco para cache

---

**Arquivo modificado:**
- `backend/src/services/uazService.js`
- `backend/src/routes/uaz.js`

**Status:** 🎯 **PRONTO PARA USO!**

Reinicie o backend e comece a usar! 🚀





