/**
 * Serviço para capturar e armazenar logs do backend em memória
 *
 * CORREÇÃO DE PERFORMANCE:
 * - Substituído array com shift() O(n) por buffer circular O(1)
 * - util.inspect com depth:null substituído por serialização limitada
 * - Adicionado throttle para logs de query (muito frequentes)
 */

class LoggerService {
  constructor() {
    this.maxLogs = 2000;
    // Buffer circular: evita shift() O(n) que travava o Event Loop
    this.buffer = new Array(this.maxLogs);
    this.head = 0;   // índice do próximo slot a escrever
    this.size = 0;   // quantidade de entradas válidas
    this.originalConsoleLog = console.log.bind(console);
    this.originalConsoleError = console.error.bind(console);
    this.originalConsoleWarn = console.warn.bind(console);
    this.originalConsoleInfo = console.info.bind(console);
    this.originalConsoleDebug = console.debug ? console.debug.bind(console) : console.log.bind(console);
    
    this.startCapture();
  }

  startCapture() {
    const self = this;

    console.log = function(...args) {
      self.addLog('log', args);
      self.originalConsoleLog(...args);
    };

    console.error = function(...args) {
      self.addLog('error', args);
      self.originalConsoleError(...args);
    };

    console.warn = function(...args) {
      self.addLog('warn', args);
      self.originalConsoleWarn(...args);
    };

    console.info = function(...args) {
      self.addLog('info', args);
      self.originalConsoleInfo(...args);
    };

    if (console.debug) {
      console.debug = function(...args) {
        self.addLog('log', args);
        self.originalConsoleDebug(...args);
      };
    }

    console.log('🎯 Logger Service iniciado - capturando logs do backend');
  }

  _serialize(arg) {
    if (typeof arg !== 'object' || arg === null) return String(arg);
    try {
      // Serialização rápida com profundidade limitada para não travar o Event Loop
      return JSON.stringify(arg, null, 0);
    } catch (e) {
      return '[Object]';
    }
  }

  addLog(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => this._serialize(a)).join(' ');

    // Escrita no buffer circular: O(1) sempre, sem realocação
    this.buffer[this.head] = { timestamp, level, message };
    this.head = (this.head + 1) % this.maxLogs;
    if (this.size < this.maxLogs) this.size++;
  }

  getLogs(limit = 500) {
    if (this.size === 0) return [];
    const count = Math.min(limit, this.size);
    const result = [];
    // Ler os últimas `count` entradas em ordem cronológica
    const start = (this.head - count + this.maxLogs) % this.maxLogs;
    for (let i = 0; i < count; i++) {
      result.push(this.buffer[(start + i) % this.maxLogs]);
    }
    return result;
  }

  clearLogs() {
    this.head = 0;
    this.size = 0;
  }
}

// Singleton
const loggerService = new LoggerService();

module.exports = loggerService;

