import { FaTimes, FaImage, FaVideo, FaFileAlt, FaMapMarkerAlt } from 'react-icons/fa';

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  template: {
    name: string;
    category?: string;
    header_type?: string;
    header_text?: string;
    body_text: string;
    footer_text?: string;
    buttons?: Array<{
      type: string;
      text?: string;
      url?: string;
      phone_number?: string;
      example?: string;
    }>;
  };
}

export default function TemplatePreview({ isOpen, onClose, template }: TemplatePreviewProps) {
  if (!isOpen) return null;

  const getHeaderIcon = (type: string) => {
    switch (type) {
      case 'IMAGE':
        return <FaImage className="text-6xl text-gray-400" />;
      case 'VIDEO':
        return <FaVideo className="text-6xl text-gray-400" />;
      case 'DOCUMENT':
        return <FaFileAlt className="text-6xl text-gray-400" />;
      case 'LOCATION':
        return <FaMapMarkerAlt className="text-6xl text-gray-400" />;
      default:
        return null;
    }
  };

  const formatBodyText = (text: string) => {
    // Destaca variáveis {{1}}, {{2}}, etc.
    return text.split(/(\{\{\d+\}\})/g).map((part, index) => {
      if (part.match(/\{\{\d+\}\}/)) {
        return (
          <span key={index} className="bg-blue-200 text-blue-800 px-1 rounded font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getCategoryBadge = (category: string = 'MARKETING') => {
    const badges = {
      MARKETING: { label: 'Marketing', color: 'bg-blue-500' },
      UTILITY: { label: 'Utilidade', color: 'bg-green-500' },
      AUTHENTICATION: { label: 'Autenticação', color: 'bg-purple-500' },
    };
    const badge = badges[category as keyof typeof badges] || badges.MARKETING;
    return (
      <span className={`${badge.color} text-white px-3 py-1 rounded-full text-xs font-bold`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-lg">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-2 text-lg font-bold">
            <FaTimes className="text-2xl" />
            Fechar Preview
          </div>
        </button>

        {/* Simulação de Celular */}
        <div className="bg-gray-900 rounded-[3rem] p-4 shadow-2xl">
          {/* Notch do celular */}
          <div className="bg-black h-7 rounded-t-[2.5rem] mb-2 flex items-center justify-center">
            <div className="bg-gray-800 w-32 h-4 rounded-full"></div>
          </div>

          {/* Tela do WhatsApp */}
          <div className="bg-[#ECE5DD] rounded-2xl overflow-hidden shadow-inner" style={{ height: '600px' }}>
            {/* Header do WhatsApp */}
            <div className="bg-[#075E54] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold">
                  📱
                </div>
                <div>
                  <div className="font-semibold text-base">Preview do Template</div>
                  <div className="text-xs text-green-200">{getCategoryBadge(template.category)}</div>
                </div>
              </div>
            </div>

            {/* Área de mensagens */}
            <div className="p-4 overflow-y-auto" style={{ height: 'calc(600px - 64px)' }}>
              {/* Nome do Template */}
              <div className="text-center mb-4">
                <span className="bg-white/80 px-4 py-2 rounded-lg text-sm text-gray-600 font-semibold shadow">
                  📝 {template.name}
                </span>
              </div>

              {/* Bolha da Mensagem */}
              <div className="flex justify-end mb-4">
                <div className="bg-[#DCF8C6] rounded-lg shadow-md max-w-[85%] overflow-hidden">
                  {/* Header da Mensagem */}
                  {template.header_type && template.header_type !== 'TEXT' && (
                    <div className="bg-gray-100 p-8 flex items-center justify-center border-b border-gray-200">
                      {getHeaderIcon(template.header_type)}
                      <div className="text-center mt-2 text-sm text-gray-500 font-semibold">
                        {template.header_type === 'IMAGE' && '🖼️ Imagem'}
                        {template.header_type === 'VIDEO' && '🎥 Vídeo'}
                        {template.header_type === 'DOCUMENT' && '📄 Documento'}
                        {template.header_type === 'LOCATION' && '📍 Localização'}
                      </div>
                    </div>
                  )}

                  {template.header_type === 'TEXT' && template.header_text && (
                    <div className="p-3 border-b border-green-200">
                      <div className="font-bold text-lg text-gray-800">
                        {formatBodyText(template.header_text)}
                      </div>
                    </div>
                  )}

                  {/* Body da Mensagem */}
                  <div className="p-4">
                    <div className="text-gray-800 text-base whitespace-pre-wrap leading-relaxed">
                      {formatBodyText(template.body_text)}
                    </div>

                    {/* Footer */}
                    {template.footer_text && (
                      <div className="mt-3 pt-2 border-t border-green-200">
                        <div className="text-gray-500 text-sm italic">
                          {template.footer_text}
                        </div>
                      </div>
                    )}

                    {/* Hora e Status */}
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-blue-500 text-sm">✓✓</span>
                    </div>
                  </div>

                  {/* Botões */}
                  {template.buttons && template.buttons.length > 0 && (
                    <div className="border-t border-green-200">
                      {template.buttons.map((button, index) => (
                        <div
                          key={index}
                          className={`p-3 text-center font-semibold ${
                            index < template.buttons!.length - 1 ? 'border-b border-green-200' : ''
                          } ${
                            button.type === 'QUICK_REPLY'
                              ? 'text-blue-600'
                              : button.type === 'PHONE_NUMBER'
                              ? 'text-green-600'
                              : button.type === 'COPY_CODE'
                              ? 'text-orange-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {button.type === 'QUICK_REPLY' && '💬 '}
                          {button.type === 'PHONE_NUMBER' && '📞 '}
                          {button.type === 'URL' && '🔗 '}
                          {button.type === 'COPY_CODE' && '📋 '}
                          {button.type === 'COPY_CODE' ? button.example : button.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Indicador de digitação (decorativo) */}
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão Home do celular */}
          <div className="bg-black h-12 rounded-b-[2.5rem] mt-2 flex items-center justify-center">
            <div className="w-32 h-1 bg-gray-700 rounded-full"></div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 bg-white/10 backdrop-blur-xl border-2 border-white/20 rounded-2xl p-4">
          <p className="text-white text-center text-sm font-medium">
            ℹ️ Este é um preview aproximado. A aparência real pode variar conforme o dispositivo do cliente.
          </p>
        </div>
      </div>
    </div>
  );
}


