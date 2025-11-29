import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  FaDesktop, FaTrash, FaSync, FaDownload
} from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';
import frontendLogger from '@/services/frontend-logger';
import AdminLayout from '@/components/admin/AdminLayout';
import { ToastContainer, useToast } from '@/components/Toast';

interface FrontendLog {
  timestamp: string;
  level: string;
  message: string;
}

export default function AdminLogsFrontend() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { notifications, showNotification, removeNotification } = useToast();
  const [logs, setLogs] = useState<FrontendLog[]>([]);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Função para carregar logs (definida primeiro, sem useCallback)
  const loadLogs = () => {
    try {
      const allLogs = frontendLogger.getLogs(1000); // Aumentado para 1000
      setLogs(allLogs);
      setError('');
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      console.error('Erro ao carregar logs do frontend:', err);
    }
  };

  // Carregar logs inicialmente
  useEffect(() => {
    loadLogs();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadLogs();
      }, 1000); // Atualiza a cada 1 segundo
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Detectar quando o usuário rola manualmente para cima
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    
    // Se usuário rolou para cima (não está no final), desabilita auto-scroll
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
    // Se usuário rolou de volta para o final, reabilita auto-scroll
    else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  const handleManualRefresh = () => {
    setAutoScroll(true); // Reativa auto-scroll ao clicar em atualizar
    loadLogs();
  };

  const handleClearLogs = () => {
    if (!confirm('Tem certeza que deseja limpar todos os logs do frontend?')) return;
    
    frontendLogger.clearLogs();
    setLogs([]);
    showNotification('✅ Logs limpos!', 'success');
  };

  const handleDownloadLogs = () => {
    const content = logs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frontend-logs-${new Date().toISOString()}.txt`;
    a.click();
  };

  const handleLogout = () => {
    signOut();
    router.push('/login');
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  if (error) {
    return (
      <AdminLayout
        title="Logs do Frontend"
        subtitle="Console do navegador em tempo real"
        icon={<FaDesktop className="text-3xl text-white" />}
        currentPage="frontend"
      >
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-red-400 mb-4">⚠️ Erro de Acesso</h2>
          <p className="text-white mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all"
          >
            Fazer Logout
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Logs do Frontend"
      subtitle="Console do navegador em tempo real"
      icon={<FaDesktop className="text-3xl text-white" />}
      currentPage="frontend"
    >

      {/* Content */}
      <div>
        {/* Controles */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl border-2 border-purple-500/30 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-purple-500 bg-gray-700 text-purple-500"
                />
                <span className="font-medium">Auto-Refresh (1s)</span>
              </label>
              <span className="text-gray-400 text-sm">
                {logs.length} logs
              </span>
              {lastUpdate && (
                <span className="text-green-400 text-sm">
                  Última atualização: {lastUpdate}
                </span>
              )}
              {!autoScroll && (
                <span className="text-yellow-400 text-sm animate-pulse flex items-center gap-1">
                  ⏸️ Auto-scroll pausado
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleManualRefresh}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
              >
                <FaSync /> Atualizar
              </button>
              <button
                onClick={handleDownloadLogs}
                disabled={logs.length === 0}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaDownload /> Download
              </button>
              <button
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTrash /> Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Terminal de Logs */}
        <div className="bg-black/90 backdrop-blur-sm rounded-xl shadow-2xl border-2 border-purple-500/30 p-6 font-mono text-sm overflow-hidden">
          <div 
            ref={logsContainerRef}
            onScroll={handleScroll}
            className="h-[600px] overflow-y-auto custom-scrollbar"
          >
            {logs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">Nenhum log disponível</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, index) => (
                  <div 
                    key={index} 
                    className="hover:bg-white/5 px-4 py-3 rounded-lg border-l-4 transition-all"
                    style={{
                      borderLeftColor: 
                        log.level === 'error' ? '#ef4444' : 
                        log.level === 'warn' ? '#f59e0b' : 
                        log.level === 'info' ? '#3b82f6' : 
                        '#10b981'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-gray-400 text-xs font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                      <span className={`font-bold text-xs px-2 py-1 rounded ${
                        log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                        log.level === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
                        log.level === 'info' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2 ml-2 text-gray-200 break-words leading-relaxed">
                      {log.message}
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
      
      {/* 🔔 NOTIFICAÇÕES TOAST */}
      <ToastContainer notifications={notifications} onRemove={removeNotification} />
    </AdminLayout>
  );
}

