# 🎨 Sistema de Notificações Modernas

Sistema completo de notificações com design glassmorphism, animações suaves e experiência de usuário premium.

## ✨ Recursos

- 🎯 **Toasts modernos** com animações suaves
- 🎨 **Design glassmorphism** com gradientes e blur
- ⚡ **Barra de progresso** animada
- 🔔 **4 tipos de notificação**: success, error, warning, info
- ✅ **Modal de confirmação** bonito (substitui `confirm()` nativo)
- 📱 **Responsivo** e otimizado para mobile
- 🎭 **Animações** com spring physics

## 🚀 Como Usar

### 1. Importar o Hook

```typescript
import { useNotifications } from '@/contexts/NotificationContext';
```

### 2. Usar no Componente

```typescript
function MeuComponente() {
  const notify = useNotifications();

  // Notificação de sucesso
  const handleSuccess = () => {
    notify.success(
      'Ação realizada!',
      'A operação foi concluída com sucesso.',
      5000 // duração em ms (opcional)
    );
  };

  // Notificação de erro
  const handleError = () => {
    notify.error(
      'Erro ao processar',
      'Não foi possível completar a operação. Tente novamente.'
    );
  };

  // Notificação de aviso
  const handleWarning = () => {
    notify.warning(
      'Atenção!',
      'Esta ação pode ter consequências.'
    );
  };

  // Notificação de informação
  const handleInfo = () => {
    notify.info(
      'Informação',
      'Aqui está uma dica útil para você.'
    );
  };

  // Substituir alert() nativo
  const handleAlert = () => {
    notify.alert('Importante!', 'Esta é uma mensagem importante.');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
      <button onClick={handleWarning}>Warning</button>
      <button onClick={handleInfo}>Info</button>
      <button onClick={handleAlert}>Alert</button>
    </div>
  );
}
```

### 3. Modal de Confirmação (substitui `confirm()`)

```typescript
function MeuComponente() {
  const notify = useNotifications();

  const handleDelete = async () => {
    const confirmed = await notify.confirm({
      title: 'Confirmar exclusão',
      message: 'Tem certeza que deseja excluir este item?\nEsta ação não pode ser desfeita.',
      type: 'danger', // 'warning' | 'danger' | 'info' | 'success'
      confirmText: 'Sim, excluir',
      cancelText: 'Cancelar'
    });

    if (confirmed) {
      // Usuário confirmou
      await deleteItem();
      notify.success('Item excluído!', 'O item foi removido com sucesso.');
    }
  };

  return (
    <button onClick={handleDelete}>Excluir</button>
  );
}
```

## 🎯 Migração do Sistema Antigo

### Substituir `alert()` nativo:

**Antes:**
```typescript
alert('Mensagem de aviso');
```

**Depois:**
```typescript
const notify = useNotifications();
notify.alert('Mensagem de aviso');
// ou
notify.info('Título', 'Mensagem de aviso');
```

### Substituir `confirm()` nativo:

**Antes:**
```typescript
if (confirm('Tem certeza?')) {
  // fazer algo
}
```

**Depois:**
```typescript
const notify = useNotifications();
const confirmed = await notify.confirm({
  title: 'Confirmação',
  message: 'Tem certeza?',
  type: 'warning'
});

if (confirmed) {
  // fazer algo
}
```

### Substituir toasts antigos:

**Antes:**
```typescript
const { success, error } = useToast();
success('Mensagem');
```

**Depois:**
```typescript
const notify = useNotifications();
notify.success('Título', 'Mensagem');
```

## 🎨 Tipos de Notificação

### Success (Verde/Esmeralda)
- Operações bem-sucedidas
- Confirmações de ações
- Salvamento de dados

### Error (Vermelho)
- Erros de validação
- Falhas de operação
- Problemas técnicos

### Warning (Amarelo)
- Avisos importantes
- Ações que requerem atenção
- Limites ou restrições

### Info (Azul)
- Informações gerais
- Dicas e sugestões
- Status de processos

## 🎭 Animações

Todas as notificações incluem:
- ✅ Entrada suave com spring animation
- ✅ Saída animada ao fechar
- ✅ Bounce no ícone ao aparecer
- ✅ Barra de progresso animada
- ✅ Efeitos glassmorphism
- ✅ Sombras e glows coloridos

## 📱 Responsividade

O sistema é totalmente responsivo e se adapta a:
- 📱 Mobile (max-width: 768px)
- 💻 Tablet (max-width: 1024px)
- 🖥️ Desktop (1024px+)

## ⚙️ Configurações

### Duração Padrão
- Padrão: 5000ms (5 segundos)
- Personalizável por notificação

### Posicionamento
- Canto superior direito (desktop)
- Top center (mobile)

### Empilhamento
- Máximo recomendado: 5 notificações simultâneas
- Auto-remove notificações antigas

## 🎯 Boas Práticas

1. **Títulos curtos e claros** (máx. 50 caracteres)
2. **Mensagens descritivas** (máx. 200 caracteres)
3. **Use o tipo correto** de notificação
4. **Evite spam** de notificações
5. **Feedback imediato** para ações do usuário

## 🐛 Troubleshooting

### Notificações não aparecem
- Verifique se o `NotificationProvider` está no `_app.tsx`
- Confirme que está usando o hook dentro de um componente React

### Z-index issues
- As notificações usam `z-index: 99999`
- Ajuste se necessário no arquivo de estilos

### Animações não funcionam
- Verifique se o `globals.css` está importado
- Confirme suporte a Tailwind CSS


