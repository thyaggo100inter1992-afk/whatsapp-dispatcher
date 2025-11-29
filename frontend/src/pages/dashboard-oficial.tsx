import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { 
  FaCalendarAlt, FaPaperPlane, FaRocket, FaSync, FaChartBar, FaChartPie,
  FaEnvelope, FaBan, FaMousePointer, FaUser, FaVideo
} from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function Dashboard() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);

  return (
    <ProtectedRoute requiredPermission="whatsapp_api" fallbackPath="/">
    {/* Conteúdo protegido */}
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HERO SECTION - CABEÇALHO PRINCIPAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary-600/30 via-primary-500/20 to-primary-600/30 backdrop-blur-xl border-2 border-primary-500/40 rounded-3xl p-10 shadow-2xl shadow-primary-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-2xl shadow-lg shadow-primary-500/50">
              <FaRocket className="text-6xl text-white" />
            </div>
            <div>
              <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                  WhatsApp API OFICIAL
              </h1>
              <p className="text-2xl text-white/80 font-medium">
                Gerencie suas campanhas de WhatsApp com facilidade
              </p>
            </div>
            </div>

            {/* Atualização Automática */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl text-lg font-bold transition-all duration-200 ${
                autoRefresh 
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/40' 
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border-2 border-white/20'
              }`}
            >
              <FaSync className={`text-xl ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          </div>
        </div>

        {/* MAIN ACTION CARDS - 3 CARDS PRINCIPAIS */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* CRIAR CAMPANHA */}
          <button
            onClick={() => router.push('/campanha/criar')}
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-emerald-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaCalendarAlt className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Criar Campanha</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Crie campanhas programadas para envio em massa
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Acessar agora
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* ENVIAR MENSAGEM IMEDIATA */}
          <button
            onClick={() => router.push('/mensagem/enviar-v2')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-blue-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaPaperPlane className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Enviar Mensagem</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Envie mensagens individuais instantaneamente
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Acessar agora
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* DASHBOARD */}
          <button
            onClick={() => router.push('/oficial/dashboard-stats')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-purple-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaChartPie className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Dashboard</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Visualize estatísticas e métricas completas
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                    Visualizar
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>
        </div>

        {/* CARDS DE NAVEGAÇÃO MENORES - 6 OPÇÕES */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* CAMPANHAS */}
          <button
            onClick={() => router.push('/campanhas')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-blue-500/20 p-4 rounded-xl">
                <FaChartBar className="text-4xl text-blue-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Campanhas</h3>
              <p className="text-sm text-white/70 text-center">Gerencie campanhas</p>
            </div>
          </button>

          {/* MENSAGENS */}
          <button
            onClick={() => router.push('/mensagens')}
            className="group relative overflow-hidden bg-gradient-to-br from-green-500/20 to-green-600/10 hover:from-green-500/30 hover:to-green-600/20 border-2 border-green-500/40 hover:border-green-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-500/20 p-4 rounded-xl">
                <FaEnvelope className="text-4xl text-green-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Mensagens</h3>
              <p className="text-sm text-white/70 text-center">Histórico completo</p>
            </div>
          </button>

          {/* LISTAS DE RESTRIÇÃO */}
          <button
            onClick={() => router.push('/listas-restricao')}
            className="group relative overflow-hidden bg-gradient-to-br from-red-500/20 to-red-600/10 hover:from-red-500/30 hover:to-red-600/20 border-2 border-red-500/40 hover:border-red-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-red-500/20 p-4 rounded-xl">
                <FaBan className="text-4xl text-red-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Listas de Restrição</h3>
              <p className="text-sm text-white/70 text-center">Bloqueios e filtros</p>
            </div>
          </button>

          {/* RELATÓRIO DE CLIQUES */}
          <button
            onClick={() => router.push('/relatorio-cliques')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-purple-500/20 p-4 rounded-xl">
                <FaMousePointer className="text-4xl text-purple-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Relatório de Cliques</h3>
              <p className="text-sm text-white/70 text-center">Análise de botões</p>
            </div>
          </button>

          {/* EDIÇÃO EM MASSA */}
          <button
            onClick={() => router.push('/perfis/editar-massa')}
            className="group relative overflow-hidden bg-gradient-to-br from-pink-500/20 to-pink-600/10 hover:from-pink-500/30 hover:to-pink-600/20 border-2 border-pink-500/40 hover:border-pink-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-pink-500/20 p-4 rounded-xl">
                <FaUser className="text-4xl text-pink-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Edição em Massa</h3>
              <p className="text-sm text-white/70 text-center">Perfis múltiplos</p>
            </div>
          </button>

          {/* TUTORIAIS */}
          <button
            onClick={() => router.push('/tutoriais?origem=api')}
            className="group relative overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/10 hover:from-orange-500/30 hover:to-orange-600/20 border-2 border-orange-500/40 hover:border-orange-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-orange-500/20 p-4 rounded-xl">
                <FaVideo className="text-4xl text-orange-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Tutoriais</h3>
              <p className="text-sm text-white/70 text-center">Vídeos explicativos</p>
            </div>
          </button>
        </div>

        {/* Seção de Dashboard removida - agora em página dedicada: /oficial/dashboard-stats */}
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
    </ProtectedRoute>
  );
}
