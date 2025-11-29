# 📝 Exemplo de Migração para o Novo Sistema de Notificações

Este documento mostra como migrar um arquivo existente para o novo sistema de notificações.

## Arquivo: `admin/landing-page.tsx`

### ❌ ANTES (Código Antigo)

```typescript
import { useState, useEffect } from 'react';
// ... outros imports

export default function AdminLandingPage() {
  // ... states

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB');  // ❌ alert() nativo
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Apenas imagens são permitidas');  // ❌ alert() nativo
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      await api.post('/admin/system-settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Logo atualizada com sucesso!');  // ❌ alert() nativo
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      alert(error.response?.data?.message || 'Erro ao fazer upload da logo');  // ❌ alert() nativo
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Tem certeza que deseja remover a logo?')) return;  // ❌ confirm() nativo

    try {
      await api.delete('/admin/system-settings/logo');
      alert('Logo removida com sucesso!');  // ❌ alert() nativo
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      alert('Erro ao remover logo');  // ❌ alert() nativo
    }
  };

  const saveWhatsappNumber = async () => {
    if (!whatsappNumber) {
      alert('Digite um número de WhatsApp');  // ❌ alert() nativo
      return;
    }

    if (!whatsappMessage) {
      alert('Digite uma mensagem padrão');  // ❌ alert() nativo
      return;
    }

    // ... resto do código
  };

  return (
    // ... JSX
  );
}
```

---

### ✅ DEPOIS (Código Novo com Sistema Moderno)

```typescript
import { useState, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';  // ✅ Importar o hook
// ... outros imports

export default function AdminLandingPage() {
  const notify = useNotifications();  // ✅ Inicializar o hook
  // ... states

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      // ✅ Notificação moderna de erro
      notify.error(
        'Arquivo muito grande!',
        'O tamanho máximo permitido é 5MB.'
      );
      return;
    }

    if (!file.type.startsWith('image/')) {
      // ✅ Notificação moderna de erro
      notify.error(
        'Tipo de arquivo inválido',
        'Apenas imagens são permitidas (JPG, PNG, GIF, etc).'
      );
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      await api.post('/admin/system-settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // ✅ Notificação moderna de sucesso
      notify.success(
        'Logo atualizada!',
        'A logo do sistema foi atualizada com sucesso.'
      );
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      
      // ✅ Notificação moderna de erro com mensagem dinâmica
      notify.error(
        'Erro ao fazer upload',
        error.response?.data?.message || 'Não foi possível fazer upload da logo. Tente novamente.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    // ✅ Modal de confirmação moderno
    const confirmed = await notify.confirm({
      title: 'Remover logo do sistema?',
      message: 'Tem certeza que deseja remover a logo?\nEsta ação não pode ser desfeita.',
      type: 'warning',
      confirmText: 'Sim, remover',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    try {
      await api.delete('/admin/system-settings/logo');
      
      // ✅ Notificação moderna de sucesso
      notify.success(
        'Logo removida!',
        'A logo do sistema foi removida com sucesso.'
      );
      loadSystemLogo();
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      
      // ✅ Notificação moderna de erro
      notify.error(
        'Erro ao remover logo',
        'Não foi possível remover a logo. Tente novamente.'
      );
    }
  };

  const saveWhatsappNumber = async () => {
    // ✅ Validação com notificação moderna
    if (!whatsappNumber) {
      notify.warning(
        'Campo obrigatório',
        'Por favor, digite um número de WhatsApp.'
      );
      return;
    }

    if (!whatsappMessage) {
      notify.warning(
        'Campo obrigatório',
        'Por favor, digite uma mensagem padrão para o WhatsApp.'
      );
      return;
    }

    // ... resto do código
  };

  return (
    // ... JSX
  );
}
```

---

## 🎯 Resumo das Mudanças

### 1. Importação
```typescript
// ✅ Adicionar no topo do arquivo
import { useNotifications } from '@/contexts/NotificationContext';
```

### 2. Inicialização
```typescript
// ✅ Dentro do componente
const notify = useNotifications();
```

### 3. Substituir `alert()`

| Antes | Depois |
|-------|--------|
| `alert('Mensagem');` | `notify.error('Título', 'Mensagem');` |
| `alert('Sucesso!');` | `notify.success('Título', 'Mensagem');` |
| `alert('Aviso!');` | `notify.warning('Título', 'Mensagem');` |

### 4. Substituir `confirm()`

**Antes:**
```typescript
if (!confirm('Tem certeza?')) return;
// código...
```

**Depois:**
```typescript
const confirmed = await notify.confirm({
  title: 'Confirmação',
  message: 'Tem certeza?',
  type: 'warning'
});

if (!confirmed) return;
// código...
```

---

## 📋 Checklist de Migração

Para migrar um arquivo, siga este checklist:

- [ ] Importar `useNotifications` no topo do arquivo
- [ ] Inicializar `const notify = useNotifications()` no componente
- [ ] Substituir todos os `alert()` por `notify.success/error/warning/info()`
- [ ] Substituir todos os `confirm()` por `await notify.confirm()`
- [ ] Remover imports antigos de toast (se houver)
- [ ] Testar todas as notificações no navegador
- [ ] Verificar mensagens de erro com try/catch
- [ ] Garantir que títulos são claros e concisos
- [ ] Garantir que mensagens são descritivas

---

## 🎨 Escolhendo o Tipo Correto

### `success` (Verde) ✅
- Upload bem-sucedido
- Dados salvos
- Operação concluída
- Confirmação de ação

### `error` (Vermelho) ❌
- Erros de validação
- Falha em operação
- Arquivo inválido
- Erro de servidor

### `warning` (Amarelo) ⚠️
- Campos obrigatórios vazios
- Ação que requer atenção
- Limite próximo
- Confirmações importantes

### `info` (Azul) ℹ️
- Informações gerais
- Dicas
- Status de processos
- Notificações neutras

---

## 🚀 Benefícios do Novo Sistema

✅ **Visual moderno** com glassmorphism e gradientes  
✅ **Animações suaves** com spring physics  
✅ **Barra de progresso** para melhor UX  
✅ **Responsivo** para mobile e desktop  
✅ **Acessível** com suporte a teclado (ESC para fechar)  
✅ **Consistente** em todo o sistema  
✅ **Customizável** com duração e tipos  
✅ **Melhor UX** que alerts nativos  

---

## 📞 Suporte

Se tiver dúvidas sobre a migração, consulte:
- `GUIA_NOTIFICACOES.md` - Guia completo
- `examples/NotificationExamples.tsx` - Exemplos práticos
- `contexts/NotificationContext.tsx` - Código fonte


