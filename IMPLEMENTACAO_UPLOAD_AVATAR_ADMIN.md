# 📸 Implementação: Upload de Avatar pelo Admin

## ✅ Problema Resolvido

**Antes:** No modal de edição de usuário, havia apenas uma mensagem informativa dizendo "A foto de perfil só pode ser alterada pelo próprio usuário", sem nenhuma funcionalidade de upload implementada.

**Agora:** O administrador pode **alterar a foto de perfil de qualquer usuário** diretamente no painel de gestão!

---

## 🎉 O QUE FOI IMPLEMENTADO

### **Backend (Node.js + Express)**

#### **1. Nova Rota: Upload de Avatar**
- **POST** `/api/gestao/users/:userId/avatar`
- Permite que administradores façam upload de avatar para qualquer usuário
- Validações:
  - ✅ Apenas admins/super_admins podem usar
  - ✅ Formatos permitidos: JPG, PNG, GIF, WEBP
  - ✅ Tamanho máximo: 5MB
  - ✅ Verifica se o usuário pertence ao tenant do admin
- Funcionalidades:
  - 📁 Cria diretório `/uploads/avatars` automaticamente
  - 🔄 Substitui o avatar antigo pelo novo
  - 🗑️ Deleta o arquivo antigo automaticamente
  - ✅ Atualiza o banco de dados

#### **2. Nova Rota: Remover Avatar**
- **DELETE** `/api/gestao/users/:userId/avatar`
- Permite que administradores removam o avatar de qualquer usuário
- Validações:
  - ✅ Apenas admins/super_admins podem usar
  - ✅ Verifica se o usuário pertence ao tenant do admin
- Funcionalidades:
  - 🗑️ Deleta o arquivo físico do servidor
  - ✅ Atualiza o banco de dados (set avatar = NULL)

**Arquivo modificado:**
- `backend/src/routes/gestao.routes.js`

---

### **Frontend (Next.js + React + TypeScript)**

#### **1. Novos Estados**
```typescript
const [avatarFile, setAvatarFile] = useState<File | null>(null);
const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
const [uploadingAvatar, setUploadingAvatar] = useState(false);
```

#### **2. Novas Funções**

**`handleAvatarChange`**
- Processa a seleção de arquivo
- Valida tamanho (max 5MB) e formato
- Cria preview instantâneo usando FileReader

**`handleUploadAvatar`**
- Faz upload do arquivo via FormData
- Mostra feedback de sucesso/erro
- Atualiza a lista de usuários

**`handleRemoveAvatar`**
- Remove o avatar do usuário
- Pede confirmação antes de deletar
- Atualiza a interface

**`handleCloseEditModal`**
- Limpa todos os estados (incluindo avatar)
- Fecha o modal

#### **3. UI Melhorada no Modal de Edição**

**Antes:**
```tsx
<div className="flex items-center gap-6">
  {/* Foto de 20x20px */}
  <p>A foto de perfil só pode ser alterada pelo próprio usuário.</p>
</div>
```

**Agora:**
```tsx
<div className="flex items-start gap-6">
  {/* Foto de 32x32px com preview */}
  {avatarPreview ? (
    <img src={avatarPreview} className="w-32 h-32 border-4 border-blue-500" />
  ) : editingUser.avatar ? (
    <img src={avatarUrl} className="w-32 h-32 border-4 border-emerald-400" />
  ) : (
    <div className="w-32 h-32 bg-gradient..." />
  )}
  
  {/* Controles */}
  <div className="flex-1 space-y-3">
    <p>Como administrador, você pode alterar a foto de perfil de qualquer usuário.</p>
    
    {/* Botão Escolher Nova Foto */}
    <label>
      <input type="file" onChange={handleAvatarChange} />
      <div>📷 Escolher Nova Foto</div>
    </label>
    
    {/* Botão Confirmar Upload (só aparece se tiver arquivo selecionado) */}
    {avatarFile && (
      <button onClick={handleUploadAvatar}>
        ✅ Confirmar Upload
      </button>
    )}
    
    {/* Botão Remover (só aparece se tiver avatar) */}
    {editingUser.avatar && !avatarFile && (
      <button onClick={handleRemoveAvatar}>
        🗑️ Remover Foto
      </button>
    )}
  </div>
</div>
```

**Arquivo modificado:**
- `frontend/src/pages/gestao.tsx`

---

## 🎨 INTERFACE VISUAL

### **Estado 1: Usuário SEM Foto**
```
┌─────────────────────────────────────────────┐
│ 📷 Foto de Perfil                           │
├─────────────────────────────────────────────┤
│  ╭────╮  Como administrador, você pode      │
│  │ 👤 │  alterar a foto de perfil.          │
│  ╰────╯                                      │
│         [📷 Escolher Nova Foto]             │
│         Formatos: JPG, PNG, GIF, WEBP       │
│         Tamanho máximo: 5MB                 │
└─────────────────────────────────────────────┘
```

### **Estado 2: Usuário COM Foto**
```
┌─────────────────────────────────────────────┐
│ 📷 Foto de Perfil                           │
├─────────────────────────────────────────────┤
│  ╭────╮  Como administrador, você pode      │
│  │ 📸 │  alterar a foto de perfil.          │
│  ╰────╯                                      │
│         [📷 Escolher Nova Foto]             │
│         [🗑️ Remover Foto]                    │
│         Formatos: JPG, PNG, GIF, WEBP       │
│         Tamanho máximo: 5MB                 │
└─────────────────────────────────────────────┘
```

### **Estado 3: Foto Selecionada (Preview)**
```
┌─────────────────────────────────────────────┐
│ 📷 Foto de Perfil                           │
├─────────────────────────────────────────────┤
│  ╭────╮  Como administrador, você pode      │
│  │ 🔵 │  alterar a foto de perfil.          │
│  ╰────╯  (borda azul = preview)             │
│         [📷 Escolher Nova Foto]             │
│         [✅ Confirmar Upload]               │
│         Formatos: JPG, PNG, GIF, WEBP       │
│         Tamanho máximo: 5MB                 │
└─────────────────────────────────────────────┘
```

---

## 🔐 SEGURANÇA

### **Validações Backend**
1. ✅ Apenas usuários com role `admin` ou `super_admin` podem acessar
2. ✅ Verifica se o usuário pertence ao mesmo tenant do admin
3. ✅ Valida tipo de arquivo (apenas imagens)
4. ✅ Valida tamanho do arquivo (max 5MB)
5. ✅ Gera nomes únicos para evitar conflitos
6. ✅ Deleta avatar antigo automaticamente

### **Validações Frontend**
1. ✅ Valida tamanho antes de enviar (max 5MB)
2. ✅ Valida formato antes de enviar
3. ✅ Mostra preview antes de confirmar
4. ✅ Desabilita botões durante upload
5. ✅ Pede confirmação antes de remover

---

## 🧪 COMO TESTAR

### **1. Fazer Upload de Avatar**
1. Acesse a página de **Gestão de Usuários** (`/gestao`)
2. Clique em **✏️ Editar** em qualquer usuário
3. Na seção **📷 Foto de Perfil**, clique em **"Escolher Nova Foto"**
4. Selecione uma imagem (JPG, PNG, GIF ou WEBP) de até 5MB
5. Um **preview** da imagem aparecerá com borda azul
6. Clique em **"✅ Confirmar Upload"**
7. Aguarde a mensagem de sucesso: **"✅ Foto atualizada com sucesso!"**

### **2. Remover Avatar**
1. Acesse a página de **Gestão de Usuários** (`/gestao`)
2. Clique em **✏️ Editar** em um usuário que **tem foto**
3. Na seção **📷 Foto de Perfil**, clique em **"🗑️ Remover Foto"**
4. Confirme a remoção no popup
5. Aguarde a mensagem de sucesso: **"✅ Foto removida com sucesso!"**

### **3. Testar Validações**
- Tente enviar arquivo maior que 5MB → **Erro: "A imagem deve ter no máximo 5MB"**
- Tente enviar arquivo não-imagem (PDF, TXT, etc.) → **Erro: "Formato inválido"**

---

## 📁 ESTRUTURA DE ARQUIVOS

```
backend/
├── uploads/
│   └── avatars/
│       └── avatar-{userId}-{timestamp}.{ext}
└── src/
    └── routes/
        └── gestao.routes.js  ← Novas rotas adicionadas

frontend/
└── src/
    └── pages/
        └── gestao.tsx  ← UI e lógica adicionadas
```

---

## 🔄 FLUXO COMPLETO

### **Upload de Avatar**
```
1. Admin seleciona arquivo
   ↓
2. Frontend valida (tamanho, formato)
   ↓
3. Cria preview local (FileReader)
   ↓
4. Admin confirma upload
   ↓
5. Envia FormData → POST /api/gestao/users/:userId/avatar
   ↓
6. Backend valida permissões (admin?)
   ↓
7. Backend valida arquivo (tipo, tamanho)
   ↓
8. Backend salva arquivo em /uploads/avatars/
   ↓
9. Backend deleta avatar antigo (se existir)
   ↓
10. Backend atualiza banco de dados
    ↓
11. Frontend recebe sucesso
    ↓
12. Frontend recarrega lista de usuários
    ↓
13. Modal mostra nova foto
```

### **Remover Avatar**
```
1. Admin clica "Remover Foto"
   ↓
2. Frontend pede confirmação
   ↓
3. Admin confirma
   ↓
4. Envia DELETE /api/gestao/users/:userId/avatar
   ↓
5. Backend valida permissões (admin?)
   ↓
6. Backend deleta arquivo físico
   ↓
7. Backend atualiza banco (avatar = NULL)
   ↓
8. Frontend recebe sucesso
   ↓
9. Frontend recarrega lista de usuários
   ↓
10. Modal mostra ícone de usuário padrão
```

---

## 🚀 PRÓXIMOS PASSOS (Opcionais)

### **Melhorias Futuras**
1. 📏 **Redimensionamento automático** de imagens grandes
2. ✂️ **Crop de imagem** antes do upload
3. 🎨 **Filtros e efeitos** na imagem
4. 📊 **Histórico de avatares** (guardar os últimos 3)
5. 🔄 **Sincronização com serviços externos** (Gravatar, etc.)

---

## ✅ CONCLUSÃO

Agora o administrador pode **alterar a foto de perfil de qualquer usuário** do seu tenant diretamente no painel de gestão!

**Benefícios:**
- ✅ Mais controle para o administrador
- ✅ Processo simples e intuitivo
- ✅ Validações robustas (frontend + backend)
- ✅ Segurança (apenas admins)
- ✅ Limpeza automática de arquivos antigos
- ✅ Feedback visual claro (preview, loading, etc.)

---

**Desenvolvido com ❤️ para resolver o problema do usuário!**


