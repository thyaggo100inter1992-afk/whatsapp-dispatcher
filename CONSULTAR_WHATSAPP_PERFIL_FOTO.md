# 📱 Consulta de WhatsApp com Foto de Perfil - Consulta Única

## ✅ Funcionalidade Implementada

Adicionada a opção de **consultar WhatsApp** e **buscar foto de perfil** na seção de telefones da **Consulta Única** de CPF/CNPJ.

---

## 📍 Localização

**Página:** Consultar Dados > Consulta Única

**Seção:** Contatos (telefones)

**Aparece em:**
- Resultado da consulta de CPF
- Resultado da consulta de CNPJ
- Modal de detalhes (quando clica em "Ver Detalhes" nos resultados)

---

## 🎯 Funcionalidades

### **1. Botão "Consultar WhatsApp"**
- Ao lado de cada telefone
- Cor verde com ícone do WhatsApp
- Busca dados do contato via API UAZ
- Mostra spinner durante o carregamento
- Fica desabilitado enquanto consulta

### **2. Foto de Perfil**
- Quando encontrada, aparece no lugar do ícone do WhatsApp
- Formato circular (48x48px)
- Borda verde
- Efeito hover (aumenta 10%)
- Texto abaixo: "✓ Foto carregada - clique para ampliar"

### **3. Modal de Ampliar Foto**
- Clique na foto para abrir modal
- Fundo escuro com blur
- Foto ampliada (até 85% da tela)
- Tamanho mínimo: 500px
- Mostra nome e telefone do contato
- Botão "Fechar" no canto superior direito
- Clique fora do modal fecha automaticamente

---

## 🎨 Visual

### **Antes de Consultar:**
```
┌──────────────────────────────────────────────────────────────┐
│ 📞 Contatos (3 telefones, 1 emails)                         │
├──────────────────────────────────────────────────────────────┤
│ [WhatsApp] Tel 1: (62) 992418111 - CLARO                    │
│            [📋 Copiar] [🟢 Consultar WhatsApp] [✓ Tem WA]   │
└──────────────────────────────────────────────────────────────┘
```

### **Depois de Consultar (com foto):**
```
┌──────────────────────────────────────────────────────────────┐
│ 📞 Contatos (3 telefones, 1 emails)                         │
├──────────────────────────────────────────────────────────────┤
│ [📷FOTO] Tel 1: (62) 992418111 - CLARO                      │
│          ✓ Foto carregada - clique para ampliar             │
│          [📋 Copiar] [🟢 Consultar WhatsApp] [✓ Tem WA]     │
└──────────────────────────────────────────────────────────────┘
```

### **Modal de Foto Ampliada:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📷 Foto de Perfil do WhatsApp           [✖️ Fechar]         │
│                                                             │
│ Nome: THIAGO GODINHO OLIVEIRA                               │
│ Telefone: 5562992418111                                     │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐     │
│ │                                                     │     │
│ │                                                     │     │
│ │               [FOTO AMPLIADA 500px+]                │     │
│ │                                                     │     │
│ │                                                     │     │
│ └─────────────────────────────────────────────────────┘     │
│                                                             │
│ 💡 Clique fora da imagem ou no botão "Fechar" para sair    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Como Funciona

### **Fluxo Técnico:**

1. **Usuário clica em "Consultar WhatsApp":**
   - Botão fica desabilitado
   - Mostra spinner: "Consultando..."

2. **Sistema busca instância ativa:**
   ```
   GET /api/uaz/instances
   → Filtra: is_active && status === 'connected'
   ```

3. **Consulta detalhes do contato:**
   ```
   POST /api/uaz/contact/details
   {
     instance_id: 1,
     phone_number: "5562992418111",
     preview: false // Full quality
   }
   ```

4. **Resposta da API:**
   ```json
   {
     "success": true,
     "contact": {
       "name": "THIAGO GODINHO OLIVEIRA",
       "image": "https://...",
       "imagePreview": "https://..."
     }
   }
   ```

5. **Armazena foto no estado:**
   - Map: `phoneNumber -> { url, name }`
   - Remove do loading

6. **Renderiza foto:**
   - Substitui ícone do WhatsApp
   - Mostra foto circular
   - Adiciona texto "clique para ampliar"

7. **Clique na foto:**
   - Abre modal
   - Mostra foto ampliada
   - Exibe nome e telefone

---

## 💻 Código Implementado

### **Estados:**
```typescript
const [phonePhotos, setPhonePhotos] = useState<Map<string, { url: string; name: string }>>(new Map());
const [loadingPhones, setLoadingPhones] = useState<Set<string>>(new Set());
const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ url: string; name: string; phone: string } | null>(null);
```

### **Função de Consulta:**
```typescript
const consultarWhatsappProfile = async (phoneNumber: string, phoneFormatted: string) => {
  try {
    setLoadingPhones(prev => new Set(prev).add(phoneNumber));

    const instancesResponse = await api.get('/uaz/instances');
    const activeInstance = instancesResponse.data.instances?.find((inst: any) => 
      inst.is_active && inst.status === 'connected'
    );

    if (!activeInstance) {
      showNotification('❌ Nenhuma instância ativa encontrada', 'error');
      return;
    }

    const response = await api.post('/uaz/contact/details', {
      instance_id: activeInstance.id,
      phone_number: phoneNumber,
      preview: false
    });

    if (response.data.success && response.data.contact?.image) {
      setPhonePhotos(prev => {
        const newMap = new Map(prev);
        newMap.set(phoneNumber, {
          url: response.data.contact.image,
          name: response.data.contact.name || phoneFormatted
        });
        return newMap;
      });
      showNotification(`✅ Foto de perfil encontrada!`, 'success');
    } else {
      showNotification(`⚠️ Nenhuma foto de perfil encontrada`, 'error');
    }
  } catch (error: any) {
    showNotification(`❌ Erro ao consultar WhatsApp: ${error.message}`, 'error');
  } finally {
    setLoadingPhones(prev => {
      const newSet = new Set(prev);
      newSet.delete(phoneNumber);
      return newSet;
    });
  }
};
```

### **Renderização do Telefone:**
```tsx
const profilePhoto = phonePhotos.get(numeroLimpo);
const isLoadingPhone = loadingPhones.has(numeroLimpo);

<div className="flex items-center gap-3">
  {profilePhoto ? (
    <div 
      className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-green-400 shadow-lg cursor-pointer hover:scale-110 transition-transform"
      onClick={() => setSelectedPhotoModal({ 
        url: profilePhoto.url, 
        name: profilePhoto.name,
        phone: numeroLimpo
      })}
    >
      <img 
        src={profilePhoto.url} 
        alt={`Foto de ${profilePhoto.name}`}
        className="w-full h-full object-cover"
      />
    </div>
  ) : (
    <FaWhatsapp className="text-3xl text-green-400 animate-pulse" />
  )}
  <div>
    <p><strong>Tel {i + 1}:</strong> ({tel.DDD}) {tel.TELEFONE} - {tel.OPERADORA}</p>
    {profilePhoto && (
      <p className="text-xs text-green-300">
        ✓ Foto carregada - clique para ampliar
      </p>
    )}
  </div>
</div>

<button
  onClick={() => consultarWhatsappProfile(numeroLimpo, `(${tel.DDD}) ${tel.TELEFONE}`)}
  disabled={isLoadingPhone}
  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
>
  {isLoadingPhone ? (
    <>
      <FaSpinner className="animate-spin" />
      Consultando...
    </>
  ) : (
    <>
      <FaWhatsapp />
      Consultar WhatsApp
    </>
  )}
</button>
```

### **Modal de Foto:**
```tsx
{selectedPhotoModal && (
  <div 
    className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
    onClick={() => setSelectedPhotoModal(null)}
  >
    <div 
      className="relative bg-dark-800 rounded-2xl p-6 max-w-[95vw] max-h-[95vh] overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setSelectedPhotoModal(null)}
        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-all z-10"
      >
        ✖️ Fechar
      </button>

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          📷 Foto de Perfil do WhatsApp
        </h3>
        <p className="text-white/70"><strong>Nome:</strong> {selectedPhotoModal.name}</p>
        <p className="text-white/70"><strong>Telefone:</strong> {selectedPhotoModal.phone}</p>
      </div>

      <div className="flex items-center justify-center">
        <img 
          src={selectedPhotoModal.url} 
          alt={`Foto de ${selectedPhotoModal.name}`}
          className="max-w-[85vw] max-h-[75vh] min-w-[500px] rounded-xl shadow-2xl border-4 border-green-500/50"
          style={{ objectFit: 'contain' }}
        />
      </div>

      <div className="mt-6 text-center text-white/50 text-sm">
        💡 Clique fora da imagem ou no botão "Fechar" para sair
      </div>
    </div>
  </div>
)}
```

---

## 🧪 Como Testar

### **1. Consultar um CPF/CNPJ:**
- Vá em: **Consultar Dados** > **Consulta Única**
- Digite um CPF ou CNPJ
- Clique em **"Consultar"**

### **2. Ver a seção de Contatos:**
- Role até a seção **"📞 Contatos"**
- Veja os telefones listados

### **3. Consultar WhatsApp:**
- Clique no botão **"Consultar WhatsApp"** ao lado de um telefone
- Aguarde o carregamento (spinner)

### **4. Ver a foto:**
- Se encontrada, a foto aparece no lugar do ícone do WhatsApp
- Formato circular com borda verde

### **5. Ampliar a foto:**
- Clique na foto circular
- Modal abre com foto ampliada
- Tamanho: até 85% da tela (mínimo 500px)

### **6. Fechar o modal:**
- Clique no botão **"✖️ Fechar"**
- Ou clique fora do modal

---

## ⚙️ Requisitos

### **Backend:**
- ✅ Rota: `POST /api/uaz/contact/details`
- ✅ Método: `uazService.getContactDetails()`
- ✅ Parâmetros: `instance_id`, `phone_number`, `preview`

### **UAZ API:**
- ✅ Endpoint: `POST /chat/details`
- ✅ Autenticação: Token da instância
- ✅ Resposta: `{ name, image, imagePreview }`

### **Instância Ativa:**
- ⚠️ Necessário ter pelo menos 1 instância UAZ:
  - `is_active = true`
  - `status = 'connected'`

---

## 🎯 Benefícios

| Antes | Depois |
|-------|--------|
| ❌ Sem foto de perfil | ✅ Foto de perfil visível |
| ❌ Não consulta WhatsApp | ✅ Botão "Consultar WhatsApp" |
| ❌ Sem ampliação | ✅ Modal para ampliar foto |
| ❌ Apenas ícone do WhatsApp | ✅ Foto real do contato |

---

## 📊 Estados

### **phonePhotos:**
- Tipo: `Map<string, { url: string; name: string }>`
- Armazena: Fotos de perfil por número de telefone
- Key: `5562992418111` (formato 55 + DDD + número)
- Value: `{ url: "https://...", name: "Nome do Contato" }`

### **loadingPhones:**
- Tipo: `Set<string>`
- Armazena: Números que estão sendo consultados
- Evita: Múltiplas consultas simultâneas do mesmo número

### **selectedPhotoModal:**
- Tipo: `{ url: string; name: string; phone: string } | null`
- Controla: Modal de foto ampliada
- `null`: Modal fechado
- Objeto: Modal aberto com dados da foto

---

## 🚀 Próximos Passos

1. **Recarregue o navegador:** `F5`
2. **Vá em:** Consultar Dados > Consulta Única
3. **Consulte um CPF:** Digite e clique em "Consultar"
4. **Role até:** Seção de Contatos
5. **Clique em:** "Consultar WhatsApp"
6. **Veja:** Foto de perfil aparecer
7. **Clique na foto:** Para ampliar
8. **Teste:** Fechar modal

---

## ✅ Status

- ✅ Botão "Consultar WhatsApp" implementado
- ✅ Busca foto via API UAZ
- ✅ Exibe foto circular nos telefones
- ✅ Modal de ampliar foto implementado
- ✅ Funciona para CPF e CNPJ
- ✅ Funciona no modal de detalhes
- ✅ Estados gerenciados corretamente
- ✅ Loading durante consulta
- ✅ Notificações de sucesso/erro

---

## 🎉 Pronto!

Agora você pode **consultar WhatsApp** e **ver fotos de perfil** diretamente na **Consulta Única**! 📱✨





