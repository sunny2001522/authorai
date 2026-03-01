import React, { useState, useCallback } from 'react';
import type { ChatWidgetProps } from '../types';
import { useChat } from '../hooks/useChat';
import { ChatBubble } from './ChatBubble';
import { ChatWindow } from './ChatWindow';

const DEFAULT_API_BASE = 'https://us-central1-your-project.cloudfunctions.net/api';

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  authorSlug,
  apiBaseUrl = DEFAULT_API_BASE,
  avatarUrl,
  authorName = 'AI 助理',
  position = { bottom: 24, right: 24 },
  bubbleOffset = { right: 80 },
  theme = {},
  welcomeMessage = '嗨！有什麼我可以幫助你的嗎？',
  placeholder = '輸入訊息...',
  expandPath,
  zIndex = 50,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
  } = useChat({
    authorSlug,
    apiBaseUrl,
  });

  const primaryColor = theme.primaryColor || '#d4af37';
  const backgroundColor = theme.backgroundColor || '#0a0806';

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleExpand = useCallback(() => {
    if (expandPath) {
      window.location.href = expandPath;
    }
  }, [expandPath]);

  return (
    <>
      {/* Chat Window */}
      <ChatWindow
        isOpen={isOpen}
        onClose={handleClose}
        onExpand={expandPath ? handleExpand : undefined}
        messages={messages}
        onSendMessage={sendMessage}
        isLoading={isLoading}
        error={error}
        authorName={authorName}
        avatarUrl={avatarUrl}
        welcomeMessage={welcomeMessage}
        placeholder={placeholder}
        primaryColor={primaryColor}
        backgroundColor={backgroundColor}
        position={position}
        zIndex={zIndex - 1}
      />

      {/* Bubble Button */}
      <ChatBubble
        onClick={handleToggle}
        isOpen={isOpen}
        avatarUrl={avatarUrl}
        authorName={authorName}
        primaryColor={primaryColor}
        position={position}
        bubbleOffset={bubbleOffset}
        zIndex={zIndex}
      />
    </>
  );
};
