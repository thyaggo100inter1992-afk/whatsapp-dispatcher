import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FaSmile } from 'react-icons/fa';
import type { Theme } from 'emoji-picker-react';

// Importação dinâmica para evitar erros de SSR
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  buttonClassName?: string;
  pickerPosition?: 'top' | 'bottom';
}

export default function EmojiPickerButton({ 
  onEmojiSelect, 
  buttonClassName = '',
  pickerPosition = 'bottom'
}: EmojiPickerButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fechar picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const handleEmojiClick = (emojiObject: any) => {
    onEmojiSelect(emojiObject.emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={buttonClassName || "px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all flex items-center gap-2 font-bold"}
        title="Adicionar Emoji"
      >
        <FaSmile className="text-lg" />
        😊
      </button>

      {showPicker && (
        <div 
          className={`absolute z-50 ${pickerPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0`}
          style={{ 
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={450}
            theme={"dark" as Theme}
            searchPlaceHolder="Buscar emoji..."
            previewConfig={{
              showPreview: false
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}








