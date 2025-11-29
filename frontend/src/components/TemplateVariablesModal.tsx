/**
 * ============================================
 * TEMPLATE VARIABLES MODAL
 * ============================================
 * Modal para preencher variáveis de templates
 * Com preview em tempo real
 * ============================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaTimes, FaPaperPlane, FaEdit, FaEye, FaRobot, FaUser, FaQuestionCircle, FaImage, FaVideo, FaMusic, FaFile, FaPlay, FaPause } from 'react-icons/fa';
import VariablesHelpModal from './VariablesHelpModal';
import {
  detectVariables,
  getSystemVariables,
  categorizeVariables,
  getPreview,
  validateVariables,
  formatVariableName
} from '@/utils/templateVariables';

// Configuração da URL base da API
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '${API_BASE_URL}/api').replace(/\/api$/, '');

interface TemplateVariablesModalProps {
  templateName: string;
  templateText: string;
  template?: any; // Template completo para mostrar botões e outras configurações
  onClose: () => void;
  onSendDirect: (filledText: string, variables: Record<string, string>) => void;
  onEditBefore: (filledText: string, variables: Record<string, string>) => void;
}

export default function TemplateVariablesModal({
  templateName,
  templateText,
  template,
  onClose,
  onSendDirect,
  onEditBefore
}: TemplateVariablesModalProps) {
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [systemVariables, setSystemVariables] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Estados para player de mídia
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  
  // Estado para visualização mobile
  const [mobileView, setMobileView] = useState(true);

  // Detectar variáveis no texto
  const allVariables = detectVariables(templateText);
  const { system, custom } = categorizeVariables(allVariables);

  // Log inicial apenas uma vez
  useEffect(() => {
    console.log('🎨 Modal aberto:', {
      templateName,
      templateText,
      allVariables,
      system,
      custom,
      template,
      buttons: template?.buttons_config
    });
  }, []);

  // Atualizar preview quando valores mudarem
  const updatePreview = useCallback((sysVars: Record<string, string>, customVals: Record<string, string>) => {
    const allValues = { ...sysVars, ...customVals };
    const newPreview = getPreview(templateText, allValues);
    console.log('📋 Atualizando preview:', {
      templateText,
      systemVariables: sysVars,
      customValues: customVals,
      allValues,
      preview: newPreview,
      template: template
    });
    setPreview(newPreview);
  }, [templateText, template]);

  // Inicializar variáveis do sistema e preview
  useEffect(() => {
    const sysVars = getSystemVariables();
    setSystemVariables(sysVars);
    updatePreview(sysVars, {});
  }, [updatePreview]);

  // Atualizar preview quando valores mudarem
  useEffect(() => {
    if (Object.keys(systemVariables).length > 0) {
      updatePreview(systemVariables, customValues);
    }
  }, [customValues, systemVariables, updatePreview]);

  // Atualizar valor de variável customizada
  const handleCustomValueChange = (variable: string, value: string) => {
    console.log('🔄 Mudando valor:', { variable, value });
    const newValues = { ...customValues, [variable]: value };
    setCustomValues(newValues);
    console.log('📦 Novos valores:', newValues);
  };

  // Funções de controle de mídia
  const toggleAudioPlayPause = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioPlaying(!audioPlaying);
  };

  const toggleVideoPlayPause = () => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setVideoPlaying(!videoPlaying);
  };

  // Validar e enviar direto
  const handleSendDirect = () => {
    const validation = validateVariables(allVariables, customValues);
    
    if (!validation.valid) {
      alert(`❌ Por favor, preencha as variáveis: ${validation.missing.join(', ')}`);
      return;
    }

    const allValues = { ...systemVariables, ...customValues };
    onSendDirect(preview, allValues);
  };

  // Validar e abrir para editar
  const handleEditBefore = () => {
    const validation = validateVariables(allVariables, customValues);
    
    if (!validation.valid) {
      alert(`❌ Por favor, preencha as variáveis: ${validation.missing.join(', ')}`);
      return;
    }

    const allValues = { ...systemVariables, ...customValues };
    onEditBefore(preview, allValues);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-purple-500/40 rounded-3xl max-w-6xl w-full my-8 shadow-2xl shadow-purple-500/30 flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/30 via-blue-600/30 to-purple-600/30 border-b-2 border-white/10 p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-1">🔧 Configurar Variáveis</h2>
            <p className="text-white/70">Template: <span className="text-purple-300 font-semibold">{templateName}</span></p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Botão Ajuda */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border-2 border-yellow-500/40 rounded-xl transition-all flex items-center gap-2 text-yellow-300 hover:text-yellow-200"
              title="Como usar variáveis?"
            >
              <FaQuestionCircle className="text-2xl" />
              <span className="text-sm font-bold">Ajuda</span>
            </button>
            
            {/* Botão Fechar */}
            <button
              onClick={onClose}
              className="bg-red-500/20 hover:bg-red-500/30 p-3 rounded-xl text-red-300 transition-all border-2 border-red-500/40"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Variáveis Automáticas */}
          {system.length > 0 && (
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaRobot className="text-3xl text-green-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">✨ Variáveis Automáticas</h3>
                  <p className="text-sm text-green-300">Preenchidas automaticamente pelo sistema</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {system.map(variable => (
                  <div key={variable} className="bg-dark-700/50 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-green-300 mb-2">
                      {`{{${variable}}}`}
                    </label>
                    <div className="bg-dark-800 border-2 border-green-500/30 rounded-lg px-4 py-3 text-white font-mono">
                      {systemVariables[variable] || '...'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variáveis Personalizadas */}
          {custom.length > 0 && (
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="text-3xl text-blue-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">📝 Preencha as Variáveis</h3>
                  <p className="text-sm text-blue-300">Digite os valores para enviar</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {custom.map(variable => (
                  <div key={variable}>
                    <label className="block text-lg font-semibold text-white mb-2">
                      {`{{${variable}}}`}
                      <span className="text-sm text-white/50 ml-2">
                        ({formatVariableName(variable)})
                      </span>
                    </label>
                    <input
                      type="text"
                      value={customValues[variable] || ''}
                      onChange={(e) => handleCustomValueChange(variable, e.target.value)}
                      placeholder={`Digite o valor para ${variable}...`}
                      className="w-full px-6 py-4 text-lg bg-dark-700/80 border-2 border-blue-500/40 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sem variáveis */}
          {allVariables.length === 0 && (
            <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-6 text-center">
              <p className="text-yellow-300 text-lg">
                ℹ️ Este template não possui variáveis
              </p>
            </div>
          )}

          {/* Preview Toggle */}
          <div className="flex items-center justify-between bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaEye className="text-2xl text-purple-400" />
              <span className="text-white font-semibold text-lg">👁️ Preview da Mensagem</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle Visualização Mobile/Desktop */}
              {showPreview && (
                <div className="flex items-center gap-2 bg-dark-700/50 rounded-xl p-2 border-2 border-white/10">
                  <button
                    onClick={() => setMobileView(true)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                      mobileView
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    📱 Celular
                  </button>
                  <button
                    onClick={() => setMobileView(false)}
                    className={`px-4 py-2 rounded-lg font-bold transition-all text-sm ${
                      !mobileView
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    💻 Desktop
                  </button>
                </div>
              )}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg text-lg ${
                showPreview
                  ? 'bg-purple-500 hover:bg-purple-600 text-white border-2 border-purple-400'
                  : 'bg-dark-700 hover:bg-dark-600 text-white/70 border-2 border-white/20'
              }`}
            >
              {showPreview ? '✅ Visível' : '👁️ Mostrar Prévia'}
            </button>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/40 rounded-2xl p-6 animate-fadeIn">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FaEye className="text-purple-400" />
                👁️ Preview da Mensagem Final {mobileView ? '📱 (Visualização Celular)' : '💻 (Visualização Desktop)'}
              </h3>
              
              {/* VISUALIZAÇÃO MOBILE (Celular) */}
              {mobileView ? (
                <div className="flex justify-center items-center py-4">
                  {/* Frame do Celular */}
                  <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-[3rem] p-3 shadow-2xl border-[14px] border-gray-800" style={{ width: '400px' }}>
                    {/* Notch (entalhe superior) */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-black rounded-b-3xl h-7 w-48 z-10"></div>
                    
                    {/* Tela do WhatsApp */}
                    <div className="bg-[#0b141a] rounded-[2rem] overflow-hidden flex flex-col" style={{ height: '700px' }}>
                      {/* Header do WhatsApp */}
                      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white text-lg">
                          👤
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">Cliente</p>
                          <p className="text-gray-400 text-xs">online</p>
                        </div>
                      </div>
                      
                      {/* Área de Mensagens */}
                      <div 
                        className="flex-1 p-3 overflow-y-auto"
                        style={{ 
                          backgroundColor: '#0b141a',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%230b141a\'/%3E%3Cpath d=\'M50 0L0 50l50 50 50-50z\' fill=\'%23111b21\' opacity=\'.03\'/%3E%3C/svg%3E")',
                          backgroundSize: '80px 80px'
                        }}
                      >
                        {/* Balão de Mensagem (Verde - enviada pelo negócio) */}
                        <div className="flex justify-end mb-2">
                          <div className="bg-[#005c4b] rounded-lg shadow-lg max-w-[85%] rounded-tr-sm">
                            <div className="p-2">
                              {/* Mídias dentro do balão mobile */}
                              {template?.type === 'image' && template?.media_files && template.media_files.length > 0 && (
                                <img
                                  src={`${API_BASE_URL}${template.media_files[0].url}`}
                                  alt="Preview"
                                  className="w-full rounded-lg mb-2"
                                />
                              )}
                              
                              {/* Texto dentro do balão mobile */}
                              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                                {preview || templateText || 'Nenhum texto disponível'}
                              </p>
                              
                              {/* BOTÕES no celular */}
                              {(() => {
                                if (template?.type === 'buttons' && template?.buttons_config) {
                                  let config = template.buttons_config;
                                  if (typeof config === 'string') {
                                    try { config = JSON.parse(config); } catch (e) { config = null; }
                                  }
                                  const buttonsArray = config?.buttons;
                                  
                                  if (buttonsArray && Array.isArray(buttonsArray) && buttonsArray.length > 0) {
                                    return (
                                      <div className="mt-2 space-y-1">
                                        {buttonsArray.map((button: any, idx: number) => (
                                          <div
                                            key={idx}
                                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-center text-white text-xs font-semibold"
                                          >
                                            {button.text || 'Botão'}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                }
                                
                                // LISTA no celular
                                if (template?.type === 'list' && template?.list_config) {
                                  let config = template.list_config;
                                  if (typeof config === 'string') {
                                    try { config = JSON.parse(config); } catch (e) { config = null; }
                                  }
                                  
                                  if (config?.sections && Array.isArray(config.sections)) {
                                    return (
                                      <div className="mt-2">
                                        <div className="bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-center">
                                          <span className="text-white text-xs font-bold">📋 {config.buttonText || 'Ver Lista'}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                }
                                
                                // POLL no celular
                                if (template?.type === 'poll' && template?.poll_config) {
                                  let config = template.poll_config;
                                  if (typeof config === 'string') {
                                    try { config = JSON.parse(config); } catch (e) { config = null; }
                                  }
                                  
                                  if (config?.options && Array.isArray(config.options)) {
                                    return (
                                      <div className="mt-2 space-y-1">
                                        <p className="text-white/80 text-[10px] mb-1">📊 Enquete (selecione {config.selectableCount || 1})</p>
                                        {config.options.slice(0, 3).map((option: string, idx: number) => (
                                          <div
                                            key={idx}
                                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs flex items-center gap-2"
                                          >
                                            <div className="w-3 h-3 border border-white rounded-full"></div>
                                            <span>{option}</span>
                                          </div>
                                        ))}
                                        {config.options.length > 3 && (
                                          <p className="text-white/60 text-[10px] text-center">+{config.options.length - 3} opções</p>
                                        )}
                                      </div>
                                    );
                                  }
                                }
                                
                                // CARROSSEL no celular
                                if (template?.type === 'carousel' && template?.carousel_config) {
                                  let config = template.carousel_config;
                                  if (typeof config === 'string') {
                                    try { config = JSON.parse(config); } catch (e) { config = null; }
                                  }
                                  
                                  if (config?.cards && Array.isArray(config.cards) && config.cards.length > 0) {
                                    const firstCard = config.cards[0];
                                    return (
                                      <div className="mt-2">
                                        {firstCard.image && (
                                          <img
                                            src={firstCard.image.startsWith('http') ? firstCard.image : `${API_BASE_URL}${firstCard.image}`}
                                            alt="Card"
                                            className="w-full rounded-lg mb-1"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                          />
                                        )}
                                        <p className="text-white text-xs mb-1">{firstCard.text}</p>
                                        {firstCard.buttons && firstCard.buttons.length > 0 && (
                                          <div className="space-y-1">
                                            {firstCard.buttons.map((btn: any, btnIdx: number) => (
                                              <div
                                                key={btnIdx}
                                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-[10px] text-center"
                                              >
                                                {btn.text}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {config.cards.length > 1 && (
                                          <p className="text-white/60 text-[10px] text-center mt-1">
                                            🎠 Card 1 de {config.cards.length}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                }
                                
                                return null;
                              })()}
                              
                              {/* Hora da mensagem */}
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-[10px] text-gray-300">{new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                                <span className="text-blue-400 text-xs">✓✓</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* VISUALIZAÇÃO DESKTOP (Normal) */
                <div className="bg-dark-800 border-2 border-purple-500/30 rounded-xl p-6 min-h-[120px] max-h-[600px] overflow-y-auto">
                  
                  {/* MÍDIAS - PREVIEW DE IMAGEM */}
                {template?.type === 'image' && template?.media_files && template.media_files.length > 0 && (
                  <div className="mb-6 bg-dark-900/50 rounded-xl overflow-hidden border-2 border-blue-500/30">
                    <div className="bg-blue-500/20 px-4 py-2 border-b border-blue-500/30">
                      <p className="text-blue-300 font-bold flex items-center gap-2">
                        <FaImage /> 🖼️ Imagem
                      </p>
                    </div>
                    <div className="p-4">
                      <img
                        src={`${API_BASE_URL}${template.media_files[0].url}`}
                        alt="Preview"
                        className="w-full max-h-96 object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* MÍDIAS - PREVIEW DE VÍDEO */}
                {template?.type === 'video' && template?.media_files && template.media_files.length > 0 && (
                  <div className="mb-6 bg-dark-900/50 rounded-xl overflow-hidden border-2 border-purple-500/30">
                    <div className="bg-purple-500/20 px-4 py-2 border-b border-purple-500/30">
                      <p className="text-purple-300 font-bold flex items-center gap-2">
                        <FaVideo /> 🎥 Vídeo
                      </p>
                    </div>
                    <div className="p-4">
                      <video
                        ref={videoRef}
                        src={`${API_BASE_URL}${template.media_files[0].url}`}
                        controls
                        className="w-full max-h-96 rounded-lg bg-black"
                        onPlay={() => setVideoPlaying(true)}
                        onPause={() => setVideoPlaying(false)}
                      />
                    </div>
                  </div>
                )}

                {/* MÍDIAS - PREVIEW DE ÁUDIO */}
                {(template?.type === 'audio' || template?.type === 'audio_recorded') && template?.media_files && template.media_files.length > 0 && (
                  <div className="mb-6 bg-dark-900/50 rounded-xl overflow-hidden border-2 border-green-500/30">
                    <div className="bg-green-500/20 px-4 py-2 border-b border-green-500/30">
                      <p className="text-green-300 font-bold flex items-center gap-2">
                        <FaMusic /> 🎵 Áudio
                      </p>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <button
                          onClick={toggleAudioPlayPause}
                          className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-green-500/50 transition-all transform hover:scale-105"
                        >
                          {audioPlaying ? <FaPause className="text-2xl" /> : <FaPlay className="text-2xl ml-1" />}
                        </button>
                      </div>
                      <audio
                        ref={audioRef}
                        src={`${API_BASE_URL}${template.media_files[0].url}`}
                        controls
                        className="w-full"
                        onPlay={() => setAudioPlaying(true)}
                        onPause={() => setAudioPlaying(false)}
                        onEnded={() => setAudioPlaying(false)}
                      />
                    </div>
                  </div>
                )}

                {/* MÍDIAS - PREVIEW DE DOCUMENTO */}
                {template?.type === 'document' && template?.media_files && template.media_files.length > 0 && (
                  <div className="mb-6 bg-dark-900/50 rounded-xl overflow-hidden border-2 border-yellow-500/30">
                    <div className="bg-yellow-500/20 px-4 py-2 border-b border-yellow-500/30">
                      <p className="text-yellow-300 font-bold flex items-center gap-2">
                        <FaFile /> 📄 Documento
                      </p>
                    </div>
                    <div className="p-6 text-center">
                      <FaFile className="text-6xl text-yellow-400 mx-auto mb-4" />
                      <p className="text-white font-bold mb-2">{template.media_files[0].original_name}</p>
                      <p className="text-white/60 text-sm mb-4">
                        {(template.media_files[0].size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <a
                        href={`${API_BASE_URL}${template.media_files[0].url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition-all"
                      >
                        📥 Baixar Documento
                      </a>
                    </div>
                  </div>
                )}

                <p className="text-white text-lg leading-relaxed whitespace-pre-wrap font-sans">
                  {preview || templateText || 'Nenhum texto disponível'}
                </p>
                
                {/* Mostrar elementos interativos */}
                {(() => {
                  // BOTÕES
                  if (template?.type === 'buttons' && template?.buttons_config) {
                    let config = template.buttons_config;
                    if (typeof config === 'string') {
                      try { config = JSON.parse(config); } catch (e) { config = null; }
                    }
                    const buttonsArray = config?.buttons;
                    
                    if (buttonsArray && Array.isArray(buttonsArray) && buttonsArray.length > 0) {
                      return (
                        <div className="mt-6 space-y-2">
                          <div className="border-t-2 border-purple-500/30 pt-4">
                            <p className="text-purple-300 text-sm font-semibold mb-3">🔘 Botões:</p>
                            {buttonsArray.map((button: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 border-2 border-purple-500/50 rounded-xl px-6 py-3 mb-2 text-white font-semibold text-center hover:from-purple-600/50 hover:to-blue-600/50 transition-all cursor-pointer"
                              >
                                {button.text || 'Botão'}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // LISTA
                  if (template?.type === 'list' && template?.list_config) {
                    let config = template.list_config;
                    if (typeof config === 'string') {
                      try { config = JSON.parse(config); } catch (e) { config = null; }
                    }
                    
                    if (config?.sections && Array.isArray(config.sections)) {
                      return (
                        <div className="mt-6">
                          <div className="border-t-2 border-purple-500/30 pt-4">
                            <div className="bg-blue-600/20 border-2 border-blue-500/50 rounded-xl px-4 py-3 mb-3 text-center">
                              <span className="text-white font-bold">📋 {config.buttonText || 'Ver Lista'}</span>
                            </div>
                            <p className="text-purple-300 text-sm font-semibold mb-2">📝 Itens da Lista:</p>
                            {config.sections.map((section: any, secIdx: number) => (
                              <div key={secIdx} className="mb-3">
                                <p className="text-yellow-300 font-bold text-sm mb-1">[{section.title}]</p>
                                {section.rows?.map((row: any, rowIdx: number) => (
                                  <div key={rowIdx} className="bg-dark-700/50 border border-purple-500/30 rounded-lg px-4 py-2 mb-1">
                                    <p className="text-white font-medium">{row.title}</p>
                                    {row.description && (
                                      <p className="text-white/60 text-sm">{row.description}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // POLL (Enquete)
                  if (template?.type === 'poll' && template?.poll_config) {
                    let config = template.poll_config;
                    if (typeof config === 'string') {
                      try { config = JSON.parse(config); } catch (e) { config = null; }
                    }
                    
                    if (config?.options && Array.isArray(config.options)) {
                      return (
                        <div className="mt-6">
                          <div className="border-t-2 border-purple-500/30 pt-4">
                            <p className="text-purple-300 text-sm font-semibold mb-3">📊 Enquete (selecione {config.selectableCount || 1}):</p>
                            {config.options.map((option: string, idx: number) => (
                              <div
                                key={idx}
                                className="bg-green-600/20 border-2 border-green-500/50 rounded-xl px-4 py-3 mb-2 text-white flex items-center gap-3"
                              >
                                <div className="w-5 h-5 border-2 border-white rounded-full"></div>
                                <span>{option}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // CARROSSEL
                  if (template?.type === 'carousel' && template?.carousel_config) {
                    let config = template.carousel_config;
                    if (typeof config === 'string') {
                      try { config = JSON.parse(config); } catch (e) { config = null; }
                    }
                    
                    if (config?.cards && Array.isArray(config.cards)) {
                      return (
                        <div className="mt-6">
                          <div className="border-t-2 border-purple-500/30 pt-4">
                            <p className="text-purple-300 text-sm font-semibold mb-3">🎠 Carrossel ({config.cards.length} cards):</p>
                            <div className="space-y-4">
                              {config.cards.map((card: any, idx: number) => (
                                <div key={idx} className="bg-dark-700/50 border-2 border-purple-500/40 rounded-xl p-4">
                                  {card.image && (
                                    <div className="mb-3 bg-dark-900 rounded-lg overflow-hidden">
                                      <img
                                        src={card.image.startsWith('http') ? card.image : `${API_BASE_URL}${card.image}`}
                                        alt={`Card ${idx + 1}`}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const parent = e.currentTarget.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="p-4 text-center"><span class="text-white/50 text-sm">🖼️ Imagem</span></div>';
                                          }
                                        }}
                                      />
                                    </div>
                                  )}
                                  <p className="text-white font-medium mb-3 whitespace-pre-wrap">{card.text}</p>
                                  {card.buttons && card.buttons.length > 0 && (
                                    <div className="space-y-2">
                                      {card.buttons.map((btn: any, btnIdx: number) => (
                                        <div
                                          key={btnIdx}
                                          className="bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 rounded-lg px-4 py-2 text-white text-sm text-center"
                                        >
                                          {btn.text}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  return null;
                })()}
              </div>
              )}
              {/* Fim da visualização Desktop/Mobile */}
              
              <div className="mt-3 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="text-purple-300 text-sm flex items-center gap-2">
                  <span className="text-2xl">✨</span>
                  <span>
                    <strong>Preview em Tempo Real:</strong> As variáveis são substituídas automaticamente enquanto você preenche
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Botões de Ação */}
        <div className="bg-gradient-to-r from-dark-800 to-dark-900 border-t-2 border-white/10 p-6 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Botão Enviar Direto */}
            <button
              onClick={handleSendDirect}
              className="group relative px-8 py-5 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 hover:from-green-700 hover:via-emerald-700 hover:to-green-700 text-white font-bold text-xl rounded-2xl transition-all shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-105 border-2 border-green-500/40"
            >
              <div className="flex flex-col items-center gap-2">
                <FaPaperPlane className="text-3xl group-hover:translate-x-1 transition-transform" />
                <span>📤 Enviar Direto</span>
                <span className="text-xs text-green-200 opacity-80">
                  Substitui e envia imediatamente
                </span>
              </div>
            </button>

            {/* Botão Editar Antes */}
            <button
              onClick={handleEditBefore}
              className="group relative px-8 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 text-white font-bold text-xl rounded-2xl transition-all shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 hover:scale-105 border-2 border-blue-500/40"
            >
              <div className="flex flex-col items-center gap-2">
                <FaEdit className="text-3xl group-hover:rotate-12 transition-transform" />
                <span>✏️ Editar Antes</span>
                <span className="text-xs text-blue-200 opacity-80">
                  Abrir formulário para ajustes
                </span>
              </div>
            </button>
          </div>

          {/* Info adicional */}
          <div className="mt-4 text-center">
            <p className="text-white/50 text-sm">
              💡 <strong>Dica:</strong> O preview mostra exatamente como a mensagem será enviada
            </p>
          </div>
        </div>
      </div>
      
      {/* MODAL DE AJUDA */}
      {showHelpModal && (
        <VariablesHelpModal onClose={() => setShowHelpModal(false)} />
      )}
    </div>
  );
}

