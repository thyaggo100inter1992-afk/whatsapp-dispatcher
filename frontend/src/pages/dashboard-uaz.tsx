import React from 'react';
import { useRouter } from 'next/router';
import { 
  FaQrcode, FaPaperPlane, FaRocket, FaChartLine, 
  FaCheckCircle, FaThList, FaBullhorn, FaVideo, FaBan
} from 'react-icons/fa';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardUaz() {
  const router = useRouter();

  return (
    <ProtectedRoute requiredPermission="whatsapp_qr" fallbackPath="/">
    {/* Conteúdo protegido */}
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HERO SECTION - CABEÇALHO PRINCIPAL */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-blue-600/30 backdrop-blur-xl border-2 border-blue-500/40 rounded-3xl p-10 shadow-2xl shadow-blue-500/20">
          <div className="absolute inset-0 bg-grid-white/[0.02]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-center gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg shadow-blue-500/50">
              <FaQrcode className="text-6xl text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-6xl font-black text-white mb-2 tracking-tight">
                WhatsApp QR Connect
              </h1>
              <p className="text-2xl text-white/80 font-medium">
                Gerencie suas campanhas de WhatsApp com facilidade
              </p>
            </div>
          </div>
        </div>

        {/* MAIN ACTION CARDS - 4 CARDS PRINCIPAIS */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* CRIAR NOVA CAMPANHA - PRIMEIRO CARD */}
          <button
            onClick={() => router.push('/qr-criar-campanha')}
            className="group relative overflow-hidden bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-green-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaRocket className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Criar Campanha</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Configure e inicie uma nova campanha de disparo
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Criar agora
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* ENVIO ÚNICO */}
          <button
            onClick={() => router.push('/uaz/enviar-mensagem-unificado')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-purple-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaPaperPlane className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Envio Único</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Texto, Imagem, Vídeo, Áudio, Documentos e Menus
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Acessar agora
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* ENVIO ÚNICO COM TEMPLATE - NOVO! */}
          <button
            onClick={() => router.push('/uaz/enviar-template-unico')}
            className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-600 hover:via-violet-600 hover:to-purple-600 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-indigo-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaThList className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Envio com Template</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Use templates salvos para envios rápidos
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Acessar agora
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>

          {/* CAMPANHAS QR CONNECT */}
          <button
            onClick={() => router.push('/qr-campanhas')}
            className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg shadow-orange-500/30"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative">
              <div className="bg-white/20 backdrop-blur-sm p-5 rounded-2xl group-hover:bg-white/30 transition-all duration-300 w-fit mb-6">
                <FaBullhorn className="text-5xl text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Campanhas QR</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                Visualize e gerencie suas campanhas em andamento
              </p>
              <div className="flex items-center gap-3 text-white text-lg font-bold">
                Gerenciar campanhas
                <FaRocket className="text-base group-hover:translate-x-2 transition-transform duration-200" />
              </div>
            </div>
          </button>
        </div>

        {/* FUNCIONALIDADES ADICIONAIS - 6 CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">

          {/* DASHBOARD */}
          <button
            onClick={() => router.push('/uaz/dashboard-stats')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 border-2 border-blue-500/40 hover:border-blue-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-blue-500/20 p-4 rounded-xl">
                <FaChartLine className="text-4xl text-blue-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Dashboard</h3>
              <p className="text-sm text-white/70 text-center">Estatísticas e métricas completas</p>
            </div>
          </button>

          {/* HISTÓRICO */}
          <button
            onClick={() => router.push('/uaz/mensagens')}
            className="group relative overflow-hidden bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 hover:from-cyan-500/30 hover:to-cyan-600/20 border-2 border-cyan-500/40 hover:border-cyan-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-cyan-500/20 p-4 rounded-xl">
                <FaCheckCircle className="text-4xl text-cyan-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Histórico</h3>
              <p className="text-sm text-white/70 text-center">Todas as mensagens enviadas</p>
            </div>
          </button>

          {/* VERIFICAR NÚMEROS */}
          <button
            onClick={() => router.push('/uaz/verificar-numeros')}
            className="group relative overflow-hidden bg-gradient-to-br from-green-500/20 to-green-600/10 hover:from-green-500/30 hover:to-green-600/20 border-2 border-green-500/40 hover:border-green-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-500/20 p-4 rounded-xl">
                <FaCheckCircle className="text-4xl text-green-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Verificar Números</h3>
              <p className="text-sm text-white/70 text-center">Valide contatos do WhatsApp</p>
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

          {/* TEMPLATES QR CONNECT */}
          <button
            onClick={() => router.push('/qr-templates')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-500/20 to-purple-600/10 hover:from-purple-500/30 hover:to-purple-600/20 border-2 border-purple-500/40 hover:border-purple-500/60 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="bg-purple-500/20 p-4 rounded-xl">
                <FaThList className="text-4xl text-purple-300" />
              </div>
              <h3 className="text-lg font-bold text-white text-center">Templates QR Connect</h3>
              <p className="text-sm text-white/70 text-center">Gerencie templates reutilizáveis</p>
            </div>
          </button>

          {/* TUTORIAIS */}
          <button
            onClick={() => router.push('/tutoriais?origem=qr')}
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
      </div>

      <style jsx>{`
        .bg-grid-white {
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
    </ProtectedRoute>
  );
}

