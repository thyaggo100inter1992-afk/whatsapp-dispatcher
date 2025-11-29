import api from './api';

interface LogData {
  acao: string;
  entidade?: string;
  entidade_id?: number;
  dados_antes?: any;
  dados_depois?: any;
  metodo_http?: string;
  url_path?: string;
  erro_mensagem?: string;
  metadata?: any;
}

class Logger {
  private queue: LogData[] = [];
  private isProcessing = false;

  /**
   * Log de navegação entre páginas
   */
  logPageView(path: string) {
    this.log({
      acao: 'page_view',
      entidade: 'navegacao',
      url_path: path,
      metodo_http: 'GET',
      metadata: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    });
  }

  /**
   * Log de atualização de página
   */
  logPageRefresh(path: string) {
    this.log({
      acao: 'page_refresh',
      entidade: 'navegacao',
      url_path: path,
      metodo_http: 'GET',
      metadata: {
        timestamp: new Date().toISOString(),
        referrer: document.referrer
      }
    });
  }

  /**
   * Log de clique em botão
   */
  logButtonClick(buttonName: string, context?: string) {
    this.log({
      acao: 'button_click',
      entidade: 'interacao',
      metadata: {
        button: buttonName,
        context: context,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log de erro
   */
  logError(error: Error | string, context?: string) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    this.log({
      acao: 'error',
      entidade: 'sistema',
      erro_mensagem: errorMessage,
      metadata: {
        context: context,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  /**
   * Log de requisição à API
   */
  logApiRequest(method: string, url: string, status: number, data?: any) {
    this.log({
      acao: 'api_request',
      entidade: 'api',
      metodo_http: method,
      url_path: url,
      metadata: {
        status: status,
        data: data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log de ação CRUD
   */
  logCrudAction(acao: 'create' | 'update' | 'delete', entidade: string, entidade_id?: number, dados?: any) {
    this.log({
      acao: acao,
      entidade: entidade,
      entidade_id: entidade_id,
      dados_depois: dados,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log de formulário submetido
   */
  logFormSubmit(formName: string, data?: any) {
    this.log({
      acao: 'form_submit',
      entidade: 'formulario',
      metadata: {
        form: formName,
        data: data,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log de login
   */
  logLogin(email: string, success: boolean) {
    this.log({
      acao: 'login',
      entidade: 'usuario',
      metadata: {
        email: email,
        success: success,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log de logout
   */
  logLogout() {
    this.log({
      acao: 'logout',
      entidade: 'usuario',
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Método privado para enviar log ao backend
   */
  private async log(data: LogData) {
    this.queue.push(data);
    
    // Processar a fila se não estiver processando
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Processar a fila de logs
   */
  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const logData = this.queue.shift();
      
      try {
        await api.post('/logs/activity', logData);
      } catch (error) {
        // Se falhar, não registra no log para evitar loop infinito
        console.error('Erro ao enviar log:', error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Limpar a fila (útil para testes)
   */
  clearQueue() {
    this.queue = [];
  }
}

// Singleton
const logger = new Logger();

// Capturar erros globais
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.logError(event.error || event.message, 'Global Error Handler');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.logError(event.reason, 'Unhandled Promise Rejection');
  });
}

export default logger;



