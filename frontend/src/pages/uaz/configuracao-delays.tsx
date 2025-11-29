import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft, FaSave, FaClock, FaShieldAlt, FaCheckCircle, FaTimes } from 'react-icons/fa';

export default function ConfiguracaoDelays() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');

  const [delayConfig, setDelayConfig] = useState({
    delayBeforeSending: 2,
    delayBetweenMessages: 1.5,
    delayBetweenChars: 0.05,
    enableSafeMode: true,
    randomizeDelays: true,
    maxRandomVariation: 0.5
  });

  useEffect(() => {
    loadDelayConfig();
  }, []);

  const loadDelayConfig = () => {
    try {
      const savedConfig = localStorage.getItem('uaz_delay_config');
      if (savedConfig) {
        setDelayConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de delays:', error);
    }
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem('uaz_delay_config', JSON.stringify(delayConfig));
      setSaved(true);
      setNotificationType('success');
      setShowNotification(true);
      
      setTimeout(() => {
        setSaving(false);
        setTimeout(() => {
          setSaved(false);
        }, 2000);
        // Esconder notificação após 5 segundos
        setTimeout(() => setShowNotification(false), 3001);
      }, 500);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setNotificationType('error');
      setShowNotification(true);
      setSaving(false);
      
      // Esconder notificação de erro após 5 segundos
      setTimeout(() => setShowNotification(false), 3001);
    }
  };

  const presets = {
    rapido: {
      delayBeforeSending: 0.5,
      delayBetweenMessages: 0.5,
      delayBetweenChars: 0.02,
      enableSafeMode: false,
      randomizeDelays: false,
      maxRandomVariation: 0.2
    },
    normal: {
      delayBeforeSending: 2,
      delayBetweenMessages: 1.5,
      delayBetweenChars: 0.05,
      enableSafeMode: true,
      randomizeDelays: true,
      maxRandomVariation: 0.5
    },
    seguro: {
      delayBeforeSending: 5,
      delayBetweenMessages: 3,
      delayBetweenChars: 0.1,
      enableSafeMode: true,
      randomizeDelays: true,
      maxRandomVariation: 1
    },
    muitoSeguro: {
      delayBeforeSending: 10,
      delayBetweenMessages: 5,
      delayBetweenChars: 0.15,
      enableSafeMode: true,
      randomizeDelays: true,
      maxRandomVariation: 2
    }
  };

  const applyPreset = (presetName: keyof typeof presets) => {
    setDelayConfig(presets[presetName]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 py-8 px-4">
      {/* NOTIFICAÇÃO DE SUCESSO/ERRO */}
      {showNotification && (
        <div 
          className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 ${
            notificationType === 'success' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
              : 'bg-gradient-to-r from-red-500 to-pink-500'
          } text-white px-8 py-5 rounded-2xl shadow-2xl border-2 ${
            notificationType === 'success' ? 'border-green-400' : 'border-red-400'
          } flex items-center gap-4 min-w-[400px] max-w-[600px] transition-all duration-500 ease-out`}
          style={{
            animation: 'slideDown 0.5s ease-out'
          }}
        >
          <div className={`text-4xl ${notificationType === 'success' ? 'animate-bounce' : ''}`}>
            {notificationType === 'success' ? '✅' : '❌'}
          </div>
          <div className="flex-1">
            <p className="font-black text-xl mb-1">
              {notificationType === 'success' ? '✅ Configuração Salva com Sucesso!' : '❌ Erro ao Salvar!'}
            </p>
            <p className="text-white/90 text-sm">
              {notificationType === 'success' 
                ? 'Suas configurações de delay foram salvas e serão aplicadas automaticamente em todos os próximos envios.' 
                : 'Ocorreu um erro ao salvar suas configurações. Por favor, tente novamente.'}
            </p>
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Fechar notificação"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>
      )}
      
      {/* Adicionar estilo de animação */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-green-600/30 via-emerald-500/20 to-green-600/30 backdrop-blur-xl border-2 border-green-500/40 rounded-3xl p-10 shadow-2xl">
          <div className="flex items-center gap-6">
            <button
              onClick={() => router.push('/dashboard-uaz')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all duration-200 border-2 border-white/20 hover:border-white/40"
            >
              <FaArrowLeft className="text-3xl text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                🛡️ Configuração de Delays Seguros
              </h1>
              <p className="text-xl text-white/80">
                Configure delays para envio seguro e evitar banimentos
              </p>
            </div>
          </div>
        </div>

        {/* PRESETS RÁPIDOS */}
        <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            ⚡ Presets Rápidos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => applyPreset('rapido')}
              className="p-6 bg-gradient-to-br from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border-2 border-orange-500/40 hover:border-orange-500 rounded-xl transition-all"
            >
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-lg font-bold text-white mb-2">Rápido</h3>
              <p className="text-white/60 text-sm">Envio rápido, menor segurança</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('normal')}
              className="p-6 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border-2 border-blue-500/40 hover:border-blue-500 rounded-xl transition-all"
            >
              <div className="text-4xl mb-3">🔵</div>
              <h3 className="text-lg font-bold text-white mb-2">Normal</h3>
              <p className="text-white/60 text-sm">Equilibrado e recomendado</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('seguro')}
              className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border-2 border-green-500/40 hover:border-green-500 rounded-xl transition-all"
            >
              <div className="text-4xl mb-3">🛡️</div>
              <h3 className="text-lg font-bold text-white mb-2">Seguro</h3>
              <p className="text-white/60 text-sm">Mais seguro, delays maiores</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('muitoSeguro')}
              className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-500/40 hover:border-purple-500 rounded-xl transition-all"
            >
              <div className="text-4xl mb-3">🔐</div>
              <h3 className="text-lg font-bold text-white mb-2">Muito Seguro</h3>
              <p className="text-white/60 text-sm">Máxima segurança</p>
            </button>
          </div>
        </div>

        {/* CONFIGURAÇÕES DETALHADAS */}
        <div className="bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-8 space-y-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <FaClock className="text-blue-400" />
            Configurações Detalhadas
          </h2>

          {/* Delay Antes de Enviar */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-2 border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">⏱️ Delay Antes de Iniciar</h3>
                <p className="text-white/60 text-sm">Tempo de espera antes de começar a enviar mensagens</p>
              </div>
              <span className="text-3xl font-black text-blue-300">{delayConfig.delayBeforeSending}s</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={delayConfig.delayBeforeSending}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBeforeSending: parseFloat(e.target.value) })}
                className="flex-1 h-3 bg-white/20 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(delayConfig.delayBeforeSending / 30) * 100}%, rgba(255,255,255,0.2) ${(delayConfig.delayBeforeSending / 30) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={delayConfig.delayBeforeSending}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBeforeSending: parseFloat(e.target.value) || 0 })}
                className="w-24 px-4 py-2 bg-dark-700/80 border-2 border-blue-500/40 rounded-lg text-white text-center focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Delay Entre Mensagens */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">⏳ Delay Entre Mensagens</h3>
                <p className="text-white/60 text-sm">Intervalo entre cada mensagem ou arquivo enviado</p>
              </div>
              <span className="text-3xl font-black text-purple-300">{delayConfig.delayBetweenMessages}s</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={delayConfig.delayBetweenMessages}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBetweenMessages: parseFloat(e.target.value) })}
                className="flex-1 h-3 bg-white/20 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(delayConfig.delayBetweenMessages / 20) * 100}%, rgba(255,255,255,0.2) ${(delayConfig.delayBetweenMessages / 20) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={delayConfig.delayBetweenMessages}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBetweenMessages: parseFloat(e.target.value) || 0 })}
                className="w-24 px-4 py-2 bg-dark-700/80 border-2 border-purple-500/40 rounded-lg text-white text-center focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Delay Entre Caracteres */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">⌨️ Delay Entre Caracteres</h3>
                <p className="text-white/60 text-sm">Simula digitação humana (tempo entre cada letra)</p>
              </div>
              <span className="text-3xl font-black text-green-300">{delayConfig.delayBetweenChars}s</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={delayConfig.delayBetweenChars}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBetweenChars: parseFloat(e.target.value) })}
                className="flex-1 h-3 bg-white/20 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${(delayConfig.delayBetweenChars / 0.5) * 100}%, rgba(255,255,255,0.2) ${(delayConfig.delayBetweenChars / 0.5) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <input
                type="number"
                min="0"
                max="0.5"
                step="0.01"
                value={delayConfig.delayBetweenChars}
                onChange={(e) => setDelayConfig({ ...delayConfig, delayBetweenChars: parseFloat(e.target.value) || 0 })}
                className="w-24 px-4 py-2 bg-dark-700/80 border-2 border-green-500/40 rounded-lg text-white text-center focus:border-green-500 transition-all"
              />
            </div>
          </div>

          {/* Variação Aleatória */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">🎲 Variação Aleatória Máxima</h3>
                <p className="text-white/60 text-sm">Adiciona aleatoriedade aos delays (±X segundos)</p>
              </div>
              <span className="text-3xl font-black text-yellow-300">±{delayConfig.maxRandomVariation}s</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={delayConfig.maxRandomVariation}
                onChange={(e) => setDelayConfig({ ...delayConfig, maxRandomVariation: parseFloat(e.target.value) })}
                className="flex-1 h-3 bg-white/20 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(delayConfig.maxRandomVariation / 5) * 100}%, rgba(255,255,255,0.2) ${(delayConfig.maxRandomVariation / 5) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={delayConfig.maxRandomVariation}
                onChange={(e) => setDelayConfig({ ...delayConfig, maxRandomVariation: parseFloat(e.target.value) || 0 })}
                className="w-24 px-4 py-2 bg-dark-700/80 border-2 border-yellow-500/40 rounded-lg text-white text-center focus:border-yellow-500 transition-all"
              />
            </div>
          </div>

          {/* Opções Adicionais */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">⚙️ Opções Adicionais</h3>

            <label className="flex items-center justify-between p-5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl cursor-pointer hover:border-green-500/50 transition-all">
              <div className="flex items-center gap-4">
                <FaShieldAlt className="text-3xl text-green-400" />
                <div>
                  <p className="text-white font-bold text-lg">🛡️ Modo Seguro</p>
                  <p className="text-white/60 text-sm">Ativa todas as proteções anti-banimento</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={delayConfig.enableSafeMode}
                onChange={(e) => setDelayConfig({ ...delayConfig, enableSafeMode: e.target.checked })}
                className="w-7 h-7 text-green-500 rounded focus:ring-2 focus:ring-green-500"
              />
            </label>

            <label className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl cursor-pointer hover:border-purple-500/50 transition-all">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🎲</div>
                <div>
                  <p className="text-white font-bold text-lg">Aleatorizar Delays</p>
                  <p className="text-white/60 text-sm">Varia os tempos de espera para parecer mais humano</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={delayConfig.randomizeDelays}
                onChange={(e) => setDelayConfig({ ...delayConfig, randomizeDelays: e.target.checked })}
                className="w-7 h-7 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
              />
            </label>
          </div>
        </div>

        {/* RESUMO E ESTIMATIVAS */}
        <div className="bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm border-2 border-blue-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">📊 Resumo das Configurações</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-dark-700/50 rounded-xl p-6 border-2 border-blue-500/30">
              <p className="text-white/60 text-sm mb-2">Delay Total para 1 Mensagem:</p>
              <p className="text-3xl font-black text-blue-300">
                {delayConfig.delayBeforeSending.toFixed(1)}s
              </p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-6 border-2 border-purple-500/30">
              <p className="text-white/60 text-sm mb-2">Tempo para 10 Mensagens:</p>
              <p className="text-3xl font-black text-purple-300">
                {(delayConfig.delayBeforeSending + (delayConfig.delayBetweenMessages * 9)).toFixed(1)}s
              </p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-6 border-2 border-green-500/30">
              <p className="text-white/60 text-sm mb-2">Modo de Segurança:</p>
              <p className="text-2xl font-black text-green-300">
                {delayConfig.enableSafeMode ? '🛡️ ATIVO' : '⚠️ DESATIVADO'}
              </p>
            </div>
          </div>
        </div>

        {/* AVISOS */}
        <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-3">
            ⚠️ Avisos Importantes
          </h3>
          <ul className="space-y-2 text-white/80">
            <li>• <strong>Delays maiores</strong> = <strong>Mais segurança</strong> contra banimentos</li>
            <li>• <strong>Modo Seguro</strong> é altamente recomendado para uso comercial</li>
            <li>• <strong>Variação aleatória</strong> torna o envio mais natural e humano</li>
            <li>• Essas configurações serão aplicadas <strong>automaticamente</strong> em todos os envios</li>
            <li>• Use o preset <strong>"Normal"</strong> ou <strong>"Seguro"</strong> para a maioria dos casos</li>
          </ul>
        </div>

        {/* BOTÃO SALVAR */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`w-full py-6 rounded-2xl font-bold text-2xl transition-all duration-300 flex items-center justify-center gap-4 ${
            saved
              ? 'bg-green-500 text-white'
              : saving
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-2xl shadow-green-500/50'
          }`}
        >
          {saved ? (
            <>
              <FaCheckCircle className="text-3xl" />
              Configuração Salva com Sucesso!
            </>
          ) : saving ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white"></div>
              Salvando...
            </>
          ) : (
            <>
              <FaSave className="text-3xl" />
              Salvar Configuração de Delays
            </>
          )}
        </button>
      </div>
    </div>
  );
}

