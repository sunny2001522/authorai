import React, { useRef, useEffect } from 'react';
import type { Message } from '../types';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onExpand?: () => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  error: string | null;
  authorName?: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  placeholder?: string;
  primaryColor?: string;
  backgroundColor?: string;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  zIndex?: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isOpen,
  onClose,
  onExpand,
  messages,
  onSendMessage,
  isLoading,
  error,
  authorName = 'AI 助理',
  avatarUrl,
  welcomeMessage = '嗨！有什麼我可以幫助你的嗎？',
  placeholder,
  primaryColor = '#d4af37',
  backgroundColor = '#0a0806',
  position = { bottom: 24, right: 24 },
  zIndex = 49,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex,
  };

  // Position window above the bubble
  if (position.bottom !== undefined) positionStyle.bottom = position.bottom + 72;
  if (position.top !== undefined) positionStyle.top = position.top;
  if (position.left !== undefined) positionStyle.left = position.left;
  if (position.right !== undefined) positionStyle.right = position.right;

  return (
    <div
      ref={windowRef}
      className="cmoney-chat-window"
      style={positionStyle}
    >
      <style>{`
        .cmoney-chat-window {
          width: calc(100vw - 32px);
          max-width: 380px;
          height: 70vh;
          max-height: 520px;
          background: ${backgroundColor}F2;
          backdrop-filter: blur(20px);
          border: 1px solid ${primaryColor}4D;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: window-open 0.3s ease-out;
          overflow: hidden;
        }
        @keyframes window-open {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .cmoney-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.3);
        }
        .cmoney-chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cmoney-chat-header-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid ${primaryColor}66;
        }
        .cmoney-chat-header-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cmoney-chat-header-name {
          font-size: 16px;
          font-weight: 600;
          color: #f3f4f6;
        }
        .cmoney-chat-header-status {
          font-size: 12px;
          color: ${primaryColor};
        }
        .cmoney-chat-header-actions {
          display: flex;
          gap: 8px;
        }
        .cmoney-chat-header-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          color: #9ca3af;
        }
        .cmoney-chat-header-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f3f4f6;
        }
        .cmoney-chat-header-btn svg {
          width: 16px;
          height: 16px;
        }
        .cmoney-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          scroll-behavior: smooth;
        }
        .cmoney-chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        .cmoney-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        .cmoney-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .cmoney-chat-welcome {
          text-align: center;
          padding: 24px 16px;
        }
        .cmoney-chat-welcome-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          margin: 0 auto 12px;
          overflow: hidden;
          border: 2px solid ${primaryColor}66;
        }
        .cmoney-chat-welcome-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cmoney-chat-welcome-text {
          color: #9ca3af;
          font-size: 14px;
          line-height: 1.6;
        }
        .cmoney-chat-error {
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 12px;
          margin: 8px 16px;
        }
        @media (max-width: 480px) {
          .cmoney-chat-window {
            width: calc(100vw - 16px);
            left: 8px !important;
            right: 8px !important;
            bottom: 80px !important;
            max-width: none;
          }
        }
      `}</style>

      {/* Header */}
      <div className="cmoney-chat-header">
        <div className="cmoney-chat-header-info">
          {avatarUrl && (
            <div className="cmoney-chat-header-avatar">
              <img src={avatarUrl} alt={authorName} />
            </div>
          )}
          <div>
            <div className="cmoney-chat-header-name">{authorName}</div>
            <div className="cmoney-chat-header-status">線上</div>
          </div>
        </div>
        <div className="cmoney-chat-header-actions">
          {onExpand && (
            <button
              onClick={onExpand}
              className="cmoney-chat-header-btn"
              aria-label="展開"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="cmoney-chat-header-btn"
            aria-label="關閉"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="cmoney-chat-messages">
        {messages.length === 0 ? (
          <div className="cmoney-chat-welcome">
            {avatarUrl && (
              <div className="cmoney-chat-welcome-avatar">
                <img src={avatarUrl} alt={authorName} />
              </div>
            )}
            <p className="cmoney-chat-welcome-text">{welcomeMessage}</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              avatarUrl={message.role === 'assistant' ? avatarUrl : undefined}
              primaryColor={primaryColor}
            />
          ))
        )}

        {isLoading && <TypingIndicator primaryColor={primaryColor} />}

        {error && (
          <div className="cmoney-chat-error">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder={placeholder}
        primaryColor={primaryColor}
      />
    </div>
  );
};
