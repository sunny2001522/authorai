import type { Message } from '../types';

const DEFAULT_API_BASE = 'https://us-central1-your-project.cloudfunctions.net/api';

export interface SendMessageParams {
  apiBaseUrl: string;
  authorSlug: string;
  sessionId: string;
  content: string;
}

export interface SendMessageResult {
  messageId: string;
  content: string;
  timestamp: number;
  links?: Array<{ text: string; url: string }>;
}

export interface GetHistoryParams {
  apiBaseUrl: string;
  authorSlug: string;
  sessionId: string;
}

export interface GetHistoryResult {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { apiBaseUrl, authorSlug, sessionId, content } = params;

  const response = await fetch(`${apiBaseUrl}/chat/${authorSlug}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      content,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status}`);
  }

  return response.json();
}

export async function getHistory(params: GetHistoryParams): Promise<GetHistoryResult> {
  const { apiBaseUrl, authorSlug, sessionId } = params;

  const response = await fetch(
    `${apiBaseUrl}/chat/${authorSlug}/history/${sessionId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get history: ${response.status}`);
  }

  return response.json();
}

// Poll for new admin messages
export interface PollMessagesParams {
  apiBaseUrl: string;
  authorSlug: string;
  sessionId: string;
  lastMessageId?: string;
}

export interface PollMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isAdminReply?: boolean;
  linkText?: string;
  linkUrl?: string;
}

export interface PollMessagesResult {
  hasNewMessages: boolean;
  messages: PollMessageItem[];
}

export async function pollMessages(params: PollMessagesParams): Promise<PollMessagesResult> {
  const { apiBaseUrl, authorSlug, sessionId, lastMessageId } = params;

  const url = new URL(`${apiBaseUrl}/chat/${authorSlug}/poll/${sessionId}`);
  if (lastMessageId) {
    url.searchParams.set('lastMessageId', lastMessageId);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to poll messages: ${response.status}`);
  }

  return response.json();
}
