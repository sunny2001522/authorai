import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

const SESSION_STORAGE_KEY = 'cmoney_chat_session';

export function useChatSession(authorSlug: string) {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    // Try to get existing session from localStorage
    const storageKey = `${SESSION_STORAGE_KEY}_${authorSlug}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      setSessionId(stored);
    } else {
      // Create new session
      const newSessionId = nanoid();
      localStorage.setItem(storageKey, newSessionId);
      setSessionId(newSessionId);
    }
  }, [authorSlug]);

  const resetSession = useCallback(() => {
    const storageKey = `${SESSION_STORAGE_KEY}_${authorSlug}`;
    const newSessionId = nanoid();
    localStorage.setItem(storageKey, newSessionId);
    setSessionId(newSessionId);
    return newSessionId;
  }, [authorSlug]);

  return {
    sessionId,
    resetSession,
  };
}
