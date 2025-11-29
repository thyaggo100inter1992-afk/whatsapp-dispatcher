/**
 * ============================================
 * MODAL DE AJUDA SOBRE VARIÁVEIS
 * ============================================
 * Explica detalhadamente como usar variáveis
 * ============================================
 */

import React from 'react';
import { FaTimes, FaRobot, FaUser, FaInfoCircle, FaLightbulb } from 'react-icons/fa';

interface VariablesHelpModalProps {
  onClose: () => void;
}

export default function VariablesHelpModal({ onClose }: VariablesHelpModalProps) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-dark-800 to-dark-900 border-2 border-blue-500/40 rounded-3xl max-w-6xl w-full my-8 shadow-2xl shadow-blue-500/30">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-blue-600/30 border-b-2 border-white/10 p-6 flex items-center justify-between sticky top-0">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">📚 Como Usar Variáveis em Templates</h2>
            <p className="text-white/70">Guia completo para personalizar suas mensagens</p>
          </div>
          <button
            onClick={onClose}
            className="bg-red-500/20 hover:bg-red-500/30 p-3 rounded-xl text-red-300 transition-all border-2 border-red-500/40"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          
          {/* O que são variáveis */}
          <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4 mb-4">
              <FaInfoCircle className="text-4xl text-purple-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">🤔 O que são Variáveis?</h3>
                <p className="text-white/80 text-lg leading-relaxed mb-3">
                  Variáveis são <strong className="text-purple-300">campos dinâmicos</strong> que você coloca no texto do template usando o formato <code className="bg-purple-500/20 px-2 py-1 rounded text-purple-300 font-mono">{'{{nome}}'}</code>
                </p>
                <p className="text-white/80 text-lg leading-relaxed">
                  Ao usar o template, esses campos são <strong className="text-green-300">substituídos pelos valores reais</strong>, permitindo personalizar cada mensagem!
                </p>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 mt-4">
              <p className="text-white/70 text-sm mb-2"><strong>Exemplo simples:</strong></p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-yellow-300 text-xs mb-2">📝 Template:</p>
                  <div className="bg-dark-900 rounded-lg p-3 font-mono text-sm text-white">
                    Olá {'{{nome}}'}!<br/>
                    Seu pedido é: {'{{protocolo}}'}
                  </div>
                </div>
                <div>
                  <p className="text-green-300 text-xs mb-2">✅ Resultado:</p>
                  <div className="bg-dark-900 rounded-lg p-3 text-sm text-white">
                    Olá João Silva!<br/>
                    Seu pedido é: K9L2M5
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tipos de Variáveis */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              🎯 Tipos de Variáveis
            </h3>

            {/* Variáveis Personalizadas */}
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6 mb-4">
              <div className="flex items-start gap-4">
                <FaUser className="text-4xl text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-3">🔵 Variáveis Personalizadas (Você Cria)</h4>
                  
                  <div className="bg-dark-800/50 rounded-xl p-4 mb-4">
                    <p className="text-white/80 mb-3">
                      <strong className="text-blue-300">O que é:</strong> Qualquer campo que VOCÊ inventar e que precisa preencher ao usar o template.
                    </p>
                    <p className="text-white/80 mb-3">
                      <strong className="text-blue-300">Como criar:</strong> Basta digitar <code className="bg-blue-500/20 px-2 py-1 rounded text-blue-300 font-mono">{'{{qualquer_nome}}'}</code> no texto
                    </p>
                    <p className="text-white/80">
                      <strong className="text-blue-300">Quem preenche:</strong> <span className="text-yellow-300">VOCÊ</span>, quando for usar o template
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-dark-900/80 rounded-lg p-4">
                      <p className="text-blue-300 font-semibold mb-2">📌 Exemplos de variáveis que você pode criar:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{nome}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{nome_cliente}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{valor}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{preco}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{empresa}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{produto}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{telefone}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{endereco}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{data_entrega}}'}</code>
                        <code className="bg-blue-500/20 px-3 py-2 rounded text-blue-200 font-mono text-sm">{'{{numero_pedido}}'}</code>
                      </div>
                      <p className="text-white/50 text-xs mt-3">💡 Use nomes que façam sentido para você!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Variáveis Automáticas */}
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <FaRobot className="text-4xl text-green-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white mb-3">🟢 Variáveis Automáticas ✨ (Sistema Preenche)</h4>
                  
                  <div className="bg-dark-800/50 rounded-xl p-4 mb-4">
                    <p className="text-white/80 mb-3">
                      <strong className="text-green-300">O que é:</strong> Campos especiais que o sistema preenche automaticamente com informações atuais.
                    </p>
                    <p className="text-white/80 mb-3">
                      <strong className="text-green-300">Como usar:</strong> Basta digitar o nome da variável no template
                    </p>
                    <p className="text-white/80">
                      <strong className="text-green-300">Quem preenche:</strong> <span className="text-yellow-300">SISTEMA</span>, de forma automática
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Data */}
                    <div className="bg-dark-900/80 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="bg-green-500/20 px-3 py-2 rounded text-green-200 font-mono text-lg font-bold">{'{{data}}'}</code>
                        <span className="text-2xl">📅</span>
                      </div>
                      <p className="text-white/70 text-sm mb-1"><strong>O que faz:</strong> Insere a data de hoje</p>
                      <p className="text-white/70 text-sm mb-1"><strong>Formato:</strong> DD/MM/YYYY</p>
                      <p className="text-green-300 text-sm"><strong>Exemplo:</strong> 16/11/2025</p>
                    </div>

                    {/* Hora */}
                    <div className="bg-dark-900/80 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="bg-green-500/20 px-3 py-2 rounded text-green-200 font-mono text-lg font-bold">{'{{hora}}'}</code>
                        <span className="text-2xl">⏰</span>
                      </div>
                      <p className="text-white/70 text-sm mb-1"><strong>O que faz:</strong> Insere a hora atual</p>
                      <p className="text-white/70 text-sm mb-1"><strong>Formato:</strong> HH:MM</p>
                      <p className="text-green-300 text-sm"><strong>Exemplo:</strong> 14:30</p>
                    </div>

                    {/* Protocolo */}
                    <div className="bg-dark-900/80 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="bg-green-500/20 px-3 py-2 rounded text-green-200 font-mono text-lg font-bold">{'{{protocolo}}'}</code>
                        <span className="text-2xl">🔖</span>
                      </div>
                      <p className="text-white/70 text-sm mb-1"><strong>O que faz:</strong> Gera um código único aleatório</p>
                      <p className="text-white/70 text-sm mb-1"><strong>Formato:</strong> 6 caracteres (letras + números)</p>
                      <p className="text-green-300 text-sm"><strong>Exemplo:</strong> K9L2M5, A8F2K9, P7Q3R8</p>
                      <p className="text-yellow-300 text-xs mt-2">⚠️ Cada envio gera um código DIFERENTE</p>
                    </div>

                    {/* Saudação */}
                    <div className="bg-dark-900/80 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="bg-green-500/20 px-3 py-2 rounded text-green-200 font-mono text-lg font-bold">{'{{saudacao}}'}</code>
                        <span className="text-2xl">👋</span>
                      </div>
                      <p className="text-white/70 text-sm mb-2"><strong>O que faz:</strong> Insere saudação baseada na hora do dia</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-white/70">• 05:00 às 11:59 → <span className="text-yellow-300">"Bom dia"</span></p>
                        <p className="text-white/70">• 12:00 às 17:59 → <span className="text-orange-300">"Boa tarde"</span></p>
                        <p className="text-white/70">• 18:00 às 04:59 → <span className="text-blue-300">"Boa noite"</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Exemplos Práticos Completos */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <FaLightbulb className="text-4xl text-yellow-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-4">💡 Exemplos Práticos Completos</h3>

                {/* Exemplo 1 */}
                <div className="mb-6">
                  <p className="text-yellow-300 font-bold mb-3">📦 Exemplo 1: Confirmação de Pedido</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2">Template que você cria:</p>
                      <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm text-white whitespace-pre-wrap border-2 border-yellow-500/30">
{`{{saudacao}}, {{nome}}! 🎉

Pedido confirmado!

🔖 Protocolo: {{protocolo}}
💰 Valor: R$ {{valor}}
📅 Data: {{data}}
⏰ Hora: {{hora}}

Obrigado! 😊`}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2">Como aparece para o cliente:</p>
                      <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg p-4 text-sm text-white whitespace-pre-wrap border-2 border-green-500/30">
{`Boa tarde, João Silva! 🎉

Pedido confirmado!

🔖 Protocolo: K9L2M5
💰 Valor: R$ 149,90
📅 Data: 16/11/2025
⏰ Hora: 14:30

Obrigado! 😊`}
                      </div>
                      <div className="mt-2 bg-green-500/10 rounded p-2 text-xs">
                        <p className="text-green-300"><strong>Você preencheu:</strong></p>
                        <p className="text-white/70">• {'{{nome}}'} = "João Silva"</p>
                        <p className="text-white/70">• {'{{valor}}'} = "149,90"</p>
                        <p className="text-green-300 mt-1"><strong>Sistema preencheu:</strong></p>
                        <p className="text-white/70">• {'{{saudacao}}'}, {'{{protocolo}}'}, {'{{data}}'}, {'{{hora}}'}  ✨</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exemplo 2 */}
                <div className="mb-6">
                  <p className="text-yellow-300 font-bold mb-3">💳 Exemplo 2: Cobrança</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2">Template:</p>
                      <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm text-white whitespace-pre-wrap border-2 border-yellow-500/30">
{`Olá {{nome}}, {{saudacao}}! 💳

Lembrete de pagamento:

💰 Valor: R$ {{valor}}
📅 Vencimento: {{data_vencimento}}
🔖 Código: {{protocolo}}

Emitido em: {{data}} às {{hora}}`}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2">Resultado:</p>
                      <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg p-4 text-sm text-white whitespace-pre-wrap border-2 border-orange-500/30">
{`Olá Maria Santos, Boa noite! 💳

Lembrete de pagamento:

💰 Valor: R$ 299,90
📅 Vencimento: 20/11/2025
🔖 Código: P7Q3R8

Emitido em: 16/11/2025 às 20:15`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exemplo 3 */}
                <div>
                  <p className="text-yellow-300 font-bold mb-3">📞 Exemplo 3: Atendimento</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/50 text-xs mb-2">Template:</p>
                      <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm text-white whitespace-pre-wrap border-2 border-yellow-500/30">
{`{{saudacao}}! 👋

Atendimento registrado:

🎫 Protocolo: {{protocolo}}
👤 Atendente: {{nome_atendente}}
📋 Assunto: {{assunto}}
📅 Abertura: {{data}} às {{hora}}

Aguarde nosso retorno! 📞`}
                      </div>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-2">Resultado:</p>
                      <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 text-sm text-white whitespace-pre-wrap border-2 border-purple-500/30">
{`Bom dia! 👋

Atendimento registrado:

🎫 Protocolo: A8F2K9
👤 Atendente: Carlos Souza
📋 Assunto: Suporte Técnico
📅 Abertura: 16/11/2025 às 09:30

Aguarde nosso retorno! 📞`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dicas Importantes */}
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-2 border-pink-500/30 rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4">✨ Dicas Importantes</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <p className="text-white/80"><strong className="text-green-300">Use nomes claros:</strong> {'{{nome_cliente}}'}, {'{{data_entrega}}'} são melhores que {'{{n}}'}, {'{{d1}}'}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <p className="text-white/80"><strong className="text-green-300">Combine variáveis:</strong> Use automáticas ✨ + personalizadas 🔵 juntas</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <p className="text-white/80"><strong className="text-green-300">Veja o preview:</strong> Sempre confira como ficará antes de enviar</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">✅</span>
                <p className="text-white/80"><strong className="text-green-300">Crie templates organizados:</strong> Um template para cada tipo de mensagem</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <p className="text-white/80"><strong className="text-yellow-300">Preencha tudo:</strong> O sistema não deixa enviar sem preencher variáveis obrigatórias</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-dark-800 to-dark-900 border-t-2 border-white/10 p-6 text-center">
          <button
            onClick={onClose}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg"
          >
            ✅ Entendi! Vamos Criar Templates
          </button>
          <p className="text-white/50 text-sm mt-3">
            💡 Você pode abrir esta ajuda novamente clicando no botão "?" ou "Ajuda"
          </p>
        </div>
      </div>
    </div>
  );
}



