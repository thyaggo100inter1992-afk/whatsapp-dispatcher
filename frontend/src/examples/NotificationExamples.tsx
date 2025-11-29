/**
 * 🎨 EXEMPLOS DE USO DO SISTEMA DE NOTIFICAÇÕES MODERNAS
 * 
 * Este arquivo contém exemplos práticos de como usar o novo sistema
 * de notificações em diferentes cenários.
 */

import { useNotifications } from '@/contexts/NotificationContext';
import { useState } from 'react';

export default function NotificationExamples() {
  const notify = useNotifications();
  const [loading, setLoading] = useState(false);

  // ✅ EXEMPLO 1: Notificação de Sucesso Simples
  const handleSimpleSuccess = () => {
    notify.success('Operação concluída!', 'Seus dados foram salvos com sucesso.');
  };

  // ❌ EXEMPLO 2: Notificação de Erro
  const handleError = () => {
    notify.error(
      'Erro ao processar',
      'Não foi possível completar a operação. Verifique sua conexão e tente novamente.'
    );
  };

  // ⚠️ EXEMPLO 3: Notificação de Aviso
  const handleWarning = () => {
    notify.warning(
      'Atenção!',
      'Você está prestes a exceder o limite de envios do seu plano.',
      7000 // duração personalizada
    );
  };

  // ℹ️ EXEMPLO 4: Notificação de Informação
  const handleInfo = () => {
    notify.info(
      'Nova atualização disponível',
      'Uma nova versão do sistema foi lançada. Atualize para aproveitar as novidades!'
    );
  };

  // 🔔 EXEMPLO 5: Alert (substitui alert() nativo)
  const handleAlert = () => {
    notify.alert(
      'Sessão expirada',
      'Sua sessão expirou. Por favor, faça login novamente.'
    );
  };

  // ✅ EXEMPLO 6: Confirmação Simples
  const handleSimpleConfirm = async () => {
    const confirmed = await notify.confirm({
      title: 'Confirmar ação',
      message: 'Tem certeza que deseja continuar?',
      type: 'info',
      confirmText: 'Sim, continuar',
      cancelText: 'Cancelar'
    });

    if (confirmed) {
      notify.success('Confirmado!', 'Ação confirmada com sucesso.');
    } else {
      notify.info('Cancelado', 'Operação cancelada pelo usuário.');
    }
  };

  // 🗑️ EXEMPLO 7: Confirmação de Exclusão (Danger)
  const handleDeleteConfirm = async () => {
    const confirmed = await notify.confirm({
      title: 'Excluir item',
      message: 'Tem certeza que deseja excluir este item?\nEsta ação não pode ser desfeita.',
      type: 'danger',
      confirmText: 'Sim, excluir',
      cancelText: 'Não, manter'
    });

    if (confirmed) {
      // Simula exclusão
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        notify.success('Item excluído!', 'O item foi removido permanentemente.');
      }, 1500);
    }
  };

  // 📤 EXEMPLO 8: Operação Assíncrona com Feedback
  const handleAsyncOperation = async () => {
    try {
      setLoading(true);
      notify.info('Processando...', 'Aguarde enquanto processamos sua solicitação.');

      // Simula operação async
      await new Promise(resolve => setTimeout(resolve, 2000));

      notify.success(
        'Sucesso!',
        'Sua solicitação foi processada com sucesso.'
      );
    } catch (error) {
      notify.error(
        'Erro!',
        'Ocorreu um erro ao processar sua solicitação.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 📋 EXEMPLO 9: Validação de Formulário
  const handleFormValidation = () => {
    const nome = '';
    const email = 'email-invalido';

    if (!nome) {
      notify.warning('Campo obrigatório', 'Por favor, preencha o campo Nome.');
      return;
    }

    if (!email.includes('@')) {
      notify.error('Email inválido', 'Por favor, insira um email válido.');
      return;
    }

    notify.success('Formulário válido!', 'Todos os campos estão corretos.');
  };

  // 💾 EXEMPLO 10: Salvar com Confirmação
  const handleSaveWithConfirm = async () => {
    const hasChanges = true;

    if (hasChanges) {
      const confirmed = await notify.confirm({
        title: 'Salvar alterações?',
        message: 'Você tem alterações não salvas. Deseja salvar antes de sair?',
        type: 'warning',
        confirmText: 'Salvar',
        cancelText: 'Descartar'
      });

      if (confirmed) {
        notify.success('Salvo!', 'Suas alterações foram salvas com sucesso.');
      } else {
        notify.info('Descartado', 'As alterações foram descartadas.');
      }
    }
  };

  // 🔐 EXEMPLO 11: Permissão negada
  const handlePermissionDenied = () => {
    notify.error(
      'Acesso negado',
      'Você não tem permissão para realizar esta ação. Entre em contato com o administrador.',
      8000
    );
  };

  // ⏰ EXEMPLO 12: Timeout
  const handleTimeout = () => {
    notify.warning(
      'Tempo esgotado',
      'A operação demorou muito tempo e foi cancelada. Tente novamente.',
      6000
    );
  };

  // 📊 EXEMPLO 13: Limite atingido
  const handleLimitReached = () => {
    notify.warning(
      'Limite atingido',
      'Você atingiu o limite de envios do seu plano. Faça upgrade para continuar.',
      10000
    );
  };

  // 🎉 EXEMPLO 14: Bem-vindo
  const handleWelcome = () => {
    notify.success(
      'Bem-vindo!',
      'É ótimo ter você aqui. Explore todas as funcionalidades do sistema.',
      5000
    );
  };

  // 📱 EXEMPLO 15: Múltiplas notificações
  const handleMultiple = () => {
    notify.info('Iniciando processo...', 'Etapa 1 de 3');
    
    setTimeout(() => {
      notify.info('Processando...', 'Etapa 2 de 3');
    }, 1000);

    setTimeout(() => {
      notify.success('Concluído!', 'Todas as etapas foram completadas.');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          🎨 Exemplos de Notificações Modernas
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Notificações Básicas */}
          <button
            onClick={handleSimpleSuccess}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ✅ Success
          </button>

          <button
            onClick={handleError}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ❌ Error
          </button>

          <button
            onClick={handleWarning}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ⚠️ Warning
          </button>

          <button
            onClick={handleInfo}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ℹ️ Info
          </button>

          <button
            onClick={handleAlert}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            🔔 Alert
          </button>

          {/* Confirmações */}
          <button
            onClick={handleSimpleConfirm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ✅ Confirmar Simples
          </button>

          <button
            onClick={handleDeleteConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
          >
            🗑️ {loading ? 'Excluindo...' : 'Excluir Item'}
          </button>

          {/* Operações */}
          <button
            onClick={handleAsyncOperation}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
          >
            📤 {loading ? 'Processando...' : 'Operação Async'}
          </button>

          <button
            onClick={handleFormValidation}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            📋 Validar Form
          </button>

          <button
            onClick={handleSaveWithConfirm}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            💾 Salvar
          </button>

          {/* Casos Especiais */}
          <button
            onClick={handlePermissionDenied}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            🔐 Sem Permissão
          </button>

          <button
            onClick={handleTimeout}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            ⏰ Timeout
          </button>

          <button
            onClick={handleLimitReached}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            📊 Limite
          </button>

          <button
            onClick={handleWelcome}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            🎉 Bem-vindo
          </button>

          <button
            onClick={handleMultiple}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            📱 Múltiplas
          </button>
        </div>

        <div className="mt-12 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">💡 Dicas de Uso</h2>
          <ul className="text-gray-300 space-y-2">
            <li>✅ Use <code className="bg-white/10 px-2 py-1 rounded">success</code> para operações bem-sucedidas</li>
            <li>❌ Use <code className="bg-white/10 px-2 py-1 rounded">error</code> para erros e falhas</li>
            <li>⚠️ Use <code className="bg-white/10 px-2 py-1 rounded">warning</code> para avisos importantes</li>
            <li>ℹ️ Use <code className="bg-white/10 px-2 py-1 rounded">info</code> para informações gerais</li>
            <li>🔔 Use <code className="bg-white/10 px-2 py-1 rounded">alert</code> para substituir alert() nativo</li>
            <li>✅ Use <code className="bg-white/10 px-2 py-1 rounded">confirm</code> para substituir confirm() nativo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


