import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  primaryColor?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '輸入訊息...',
  primaryColor = '#d4af37',
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <form onSubmit={handleSubmit} className="cmoney-chat-input-form">
      <style>{`
        .cmoney-chat-input-form {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cmoney-chat-input-wrapper {
          flex: 1;
          display: flex;
          align-items: flex-end;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 8px 16px;
          transition: border-color 0.2s;
        }
        .cmoney-chat-input-wrapper:focus-within {
          border-color: ${primaryColor}80;
        }
        .cmoney-chat-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #f3f4f6;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          max-height: 120px;
          font-family: inherit;
        }
        .cmoney-chat-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .cmoney-chat-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${primaryColor};
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .cmoney-chat-send-btn:hover:not(:disabled) {
          background: ${primaryColor}dd;
          transform: scale(1.05);
        }
        .cmoney-chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cmoney-chat-send-btn svg {
          width: 20px;
          height: 20px;
          color: #0a0806;
        }
      `}</style>

      <div className="cmoney-chat-input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="cmoney-chat-input"
        />
      </div>

      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="cmoney-chat-send-btn"
        aria-label="發送訊息"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
};
