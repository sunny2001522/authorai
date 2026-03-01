import React from 'react';

interface TypingIndicatorProps {
  primaryColor?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  primaryColor = '#d4af37',
}) => {
  return (
    <div className="cmoney-typing-indicator">
      <style>{`
        .cmoney-typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          width: fit-content;
        }
        .cmoney-typing-dot {
          width: 8px;
          height: 8px;
          background: ${primaryColor};
          border-radius: 50%;
          animation: typing-bounce 1.4s infinite ease-in-out both;
        }
        .cmoney-typing-dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        .cmoney-typing-dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          40% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
      <div className="cmoney-typing-dot" />
      <div className="cmoney-typing-dot" />
      <div className="cmoney-typing-dot" />
    </div>
  );
};
