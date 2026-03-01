import React from 'react';

interface ChatBubbleProps {
  onClick: () => void;
  isOpen: boolean;
  avatarUrl?: string;
  authorName?: string;
  hasUnread?: boolean;
  primaryColor?: string;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  bubbleOffset?: {
    right?: number;
    left?: number;
  };
  zIndex?: number;
}

const DEFAULT_AVATAR = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23d4af37"/><circle cx="50" cy="40" r="20" fill="%23fff"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="%23fff"/></svg>';

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  onClick,
  isOpen,
  avatarUrl,
  authorName = 'AI 助理',
  hasUnread = false,
  primaryColor = '#d4af37',
  position = { bottom: 24, right: 24 },
  bubbleOffset = { right: 80 },
  zIndex = 50,
}) => {
  const positionStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex,
  };

  if (position.bottom !== undefined) positionStyle.bottom = position.bottom;
  if (position.top !== undefined) positionStyle.top = position.top;
  if (position.left !== undefined) {
    positionStyle.left = (bubbleOffset.left || 0) + position.left;
  } else if (position.right !== undefined) {
    positionStyle.right = (bubbleOffset.right || 0) + position.right;
  }

  return (
    <button
      onClick={onClick}
      style={positionStyle}
      className="cmoney-chat-bubble"
      aria-label={isOpen ? '關閉聊天' : '開啟聊天'}
    >
      <style>{`
        .cmoney-chat-bubble {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid ${primaryColor}99;
          box-shadow: 0 4px 20px ${primaryColor}4D;
          transition: all 0.3s ease;
          cursor: pointer;
          background: #0a0806;
          padding: 0;
        }
        .cmoney-chat-bubble:hover {
          transform: scale(1.1);
          border-color: ${primaryColor};
          box-shadow: 0 6px 24px ${primaryColor}66;
        }
        .cmoney-chat-bubble:active {
          transform: scale(0.95);
        }
        .cmoney-chat-bubble img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
        }
        .cmoney-chat-bubble-close {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0806;
        }
        .cmoney-chat-bubble-close svg {
          width: 24px;
          height: 24px;
          color: ${primaryColor};
        }
        .cmoney-chat-bubble-unread {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid #0a0806;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (min-width: 768px) {
          .cmoney-chat-bubble {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>

      {isOpen ? (
        <div className="cmoney-chat-bubble-close">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ) : (
        <>
          <img
            src={avatarUrl || DEFAULT_AVATAR}
            alt={authorName}
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
            }}
          />
          {hasUnread && <span className="cmoney-chat-bubble-unread" />}
        </>
      )}
    </button>
  );
};
