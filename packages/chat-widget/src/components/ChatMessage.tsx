import React from 'react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  avatarUrl?: string;
  primaryColor?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  avatarUrl,
  primaryColor = '#d4af37',
}) => {
  const isUser = message.role === 'user';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`cmoney-message ${isUser ? 'cmoney-message-user' : 'cmoney-message-assistant'}`}>
      <style>{`
        .cmoney-message {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          animation: message-slide-in 0.3s ease-out;
        }
        .cmoney-message-user {
          flex-direction: row-reverse;
        }
        .cmoney-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
        }
        .cmoney-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cmoney-message-content {
          max-width: 75%;
          display: flex;
          flex-direction: column;
        }
        .cmoney-message-user .cmoney-message-content {
          align-items: flex-end;
        }
        .cmoney-message-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .cmoney-message-user .cmoney-message-bubble {
          background: ${primaryColor}26;
          border: 1px solid ${primaryColor}66;
          border-bottom-right-radius: 4px;
          color: #f3f4f6;
        }
        .cmoney-message-assistant .cmoney-message-bubble {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom-left-radius: 4px;
          color: #e5e7eb;
        }
        .cmoney-message-time {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 4px;
          padding: 0 4px;
        }
        @keyframes message-slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .cmoney-message-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        .cmoney-message-link-btn {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          background: ${primaryColor}1A;
          border: 1px solid ${primaryColor}4D;
          border-radius: 8px;
          color: ${primaryColor};
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }
        .cmoney-message-link-btn:hover {
          background: ${primaryColor}33;
        }
      `}</style>

      {!isUser && avatarUrl && (
        <div className="cmoney-message-avatar">
          <img src={avatarUrl} alt="助理" />
        </div>
      )}

      <div className="cmoney-message-content">
        <div className="cmoney-message-bubble">
          {message.content}
        </div>
        {!isUser && message.links && message.links.length > 0 && (
          <div className="cmoney-message-links">
            {message.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cmoney-message-link-btn"
              >
                {link.text}
                <span style={{ marginLeft: '4px' }}>→</span>
              </a>
            ))}
          </div>
        )}
        <span className="cmoney-message-time">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
