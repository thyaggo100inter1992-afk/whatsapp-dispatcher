/**
 * Serviço para capturar logs do console do navegador
 */

interface FrontendLog {
  timestamp: string;
  level: string;
  message: string;
}

class FrontendLoggerService {
  private logs: FrontendLog[] = [];
  private maxLogs = 2000; // Aumentado para 2000 logs
  private originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
  };
  private isInitialized = false;

  constructor() {
    // Inicializar imediatamente
    if (typeof window !== 'undefined' && !this.isInitialized) {
      this.startCapture();
      this.isInitialized = true;
    }
  }

  private startCapture() {
    const self = this;

    // Interceptar console.log
    console.log = function(...args: any[]) {
      self.addLog('log', args);
      self.originalConsole.log(...args);
    };

    // Interceptar console.error
    console.error = function(...args: any[]) {
      self.addLog('error', args);
      self.originalConsole.error(...args);
    };

    // Interceptar console.warn
    console.warn = function(...args: any[]) {
      self.addLog('warn', args);
      self.originalConsole.warn(...args);
    };

    // Interceptar console.info
    console.info = function(...args: any[]) {
      self.addLog('info', args);
      self.originalConsole.info(...args);
    };

    // Interceptar console.debug
    if (console.debug) {
      console.debug = function(...args: any[]) {
        self.addLog('log', args);
        self.originalConsole.debug(...args);
      };
    }

    // Capturar erros não tratados
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        self.addLog('error', [`Uncaught Error: ${event.message}`, `at ${event.filename}:${event.lineno}:${event.colno}`]);
      });

      // Capturar promises rejeitadas
      window.addEventListener('unhandledrejection', (event) => {
        self.addLog('error', [`Unhandled Promise Rejection: ${event.reason}`]);
      });
    }

    // Log de inicialização
    this.originalConsole.log('🎯 Frontend Logger iniciado - capturando logs do navegador');
    self.addLog('info', ['🎯 Frontend Logger iniciado - capturando logs do navegador']);
  }

  private addLog(level: string, args: any[]) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    this.logs.push({
      timestamp,
      level,
      message
    });

    // Manter apenas os últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  public getLogs(limit = 100): FrontendLog[] {
    return this.logs.slice(-limit);
  }

  public clearLogs() {
    this.logs = [];
  }
}

// Singleton
const frontendLogger = new FrontendLoggerService();

// Tornar disponível globalmente para debug (apenas em desenvolvimento)
if (typeof window !== 'undefined') {
  (window as any).frontendLogger = frontendLogger;
}

export default frontendLogger;

