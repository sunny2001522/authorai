import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { Message } from '../types';
import { sendMessage as sendMessageApi, getHistory, pollMessages } from '../services/api';
import { useChatSession } from './useChatSession';

const MESSAGES_STORAGE_KEY = 'cmoney_chat_messages';
const MAX_STORED_MESSAGES = 50;
const POLL_INTERVAL = 5000; // Poll every 5 seconds

interface UseChatOptions {
  authorSlug: string;
  apiBaseUrl: string;
}

export function useChat({ authorSlug, apiBaseUrl }: UseChatOptions) {
  const { sessionId, resetSession } = useChatSession(authorSlug);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    if (!sessionId) return;

    const storageKey = `${MESSAGES_STORAGE_KEY}_${authorSlug}_${sessionId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Message[];
        setMessages(parsed.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
      } catch (e) {
        console.error('Failed to parse stored messages:', e);
      }
    }
  }, [sessionId, authorSlug]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;

    const storageKey = `${MESSAGES_STORAGE_KEY}_${authorSlug}_${sessionId}`;
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(storageKey, JSON.stringify(toStore));
  }, [messages, sessionId, authorSlug]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !sessionId) return;

    // Add user message immediately
    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessageApi({
        apiBaseUrl,
        authorSlug,
        sessionId,
        content: content.trim(),
      });

      const assistantMessage: Message = {
        id: response.messageId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(response.timestamp),
        links: response.links,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('抱歉，發生了一些問題，請稍後再試');
      console.error('Failed to send message:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, authorSlug, sessionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    const newSessionId = resetSession();
    const storageKey = `${MESSAGES_STORAGE_KEY}_${authorSlug}_${newSessionId}`;
    localStorage.removeItem(storageKey);
  }, [authorSlug, resetSession]);

  // Poll for new admin messages
  useEffect(() => {
    if (!sessionId || !isPolling) return;

    const poll = async () => {
      try {
        // Get the last message ID to avoid duplicates
        const lastMessage = messages[messages.length - 1];
        const lastMessageId = lastMessage?.id;

        const result = await pollMessages({
          apiBaseUrl,
          authorSlug,
          sessionId,
          lastMessageId,
        });

        if (result.hasNewMessages && result.messages.length > 0) {
          // Filter out messages that already exist in the local state
          const existingIds = new Set(messages.map(m => m.id));
          const newMessages = result.messages.filter(m => !existingIds.has(m.id));

          if (newMessages.length > 0) {
            setMessages(prev => [
              ...prev,
              ...newMessages.map(m => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: new Date(m.timestamp),
                links: m.linkText && m.linkUrl
                  ? [{ text: m.linkText, url: m.linkUrl }]
                  : undefined,
                isAdminReply: m.isAdminReply || false,
              })),
            ]);
          }
        }
      } catch (err) {
        // Silently fail polling - don't show error to user
        console.error('Polling error:', err);
      }

      // Schedule next poll
      pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    // Start polling after a short delay
    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL);

    // Cleanup on unmount or when deps change
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [sessionId, isPolling, apiBaseUrl, authorSlug, messages]);

  // Pause polling when loading (sending a message)
  useEffect(() => {
    setIsPolling(!isLoading);
  }, [isLoading]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    sessionId,
  };
}
