/**
 * Serviço para capturar e armazenar logs do backend em memória
 */

class LoggerService {
  constructor() {
    this.logs = [];
    this.maxLogs = 5000; // Aumentado para 5000 logs
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.originalConsoleInfo = console.info.bind(console);
    this.originalConsoleDebug = console.debug ? console.debug.bind(console) : console.log.bind(console);
    
    this.startCapture();
  }

  startCapture() {
    const self = this;

    // Interceptar console.log
    console.log = function(...args) {
      self.addLog('log', args);
      self.originalConsoleLog(...args);
    };

    // Interceptar console.error
    console.error = function(...args) {
      self.addLog('error', args);
      self.originalConsoleError(...args);
    };

    // Interceptar console.warn
    console.warn = function(...args) {
      self.addLog('warn', args);
      self.originalConsoleWarn(...args);
    };

    // Interceptar console.info
    console.info = function(...args) {
      self.addLog('info', args);
      self.originalConsoleInfo(...args);
    };

    // Interceptar console.debug
    if (console.debug) {
      console.debug = function(...args) {
        self.addLog('log', args);
        self.originalConsoleDebug(...args);
      };
    }

    console.log('🎯 Logger Service iniciado - capturando logs do backend');
  }

  addLog(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Para objetos, tentar usar inspect do Node.js se disponível
          if (typeof require !== 'undefined') {
            const util = require('util');
            return util.inspect(arg, { depth: null, colors: false, compact: false });
          }
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

  getLogs(limit = 500) {
    // Retornar mais logs por padrão
    return this.logs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }
}

// Singleton
const loggerService = new LoggerService();

module.exports = loggerService;

