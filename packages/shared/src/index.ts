// Shared types for the AI Chat system

// ============ Author Types ============
export interface Author {
  id: string;
  name: string;
  slug: string;
  adminKey: string;
  avatarUrl?: string;
  systemPrompt: string;
  temperature: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Conversation Types ============
export interface Conversation {
  id: string;
  authorId: string;
  sessionId: string;
  summary?: string;
  messageCount: number;
  startedAt: Date;
  lastMessageAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============ Knowledge Types ============
export type KnowledgeType = 'text' | 'file' | 'audio';
export type KnowledgeStatus = 'processing' | 'ready' | 'error';

export interface KnowledgeItem {
  id: string;
  authorId: string;
  type: KnowledgeType;
  title: string;
  content: string;
  originalFileName?: string;
  fileUrl?: string;
  mimeType?: string;
  wordCount: number;
  status: KnowledgeStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============ API Types ============

// Chat API
export interface SendMessageRequest {
  sessionId: string;
  content: string;
}

export interface SendMessageResponse {
  messageId: string;
  content: string;
  timestamp: number;
}

export interface GetHistoryResponse {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

// Knowledge API
export interface AddTextKnowledgeRequest {
  title: string;
  content: string;
}

export interface UploadFileRequest {
  title: string;
  file: File;
}

export interface TranscribeAudioRequest {
  title: string;
  audioBlob: Blob;
}

// Admin API
export interface ConversationListResponse {
  conversations: Array<{
    id: string;
    sessionId: string;
    summary?: string;
    messageCount: number;
    startedAt: number;
    lastMessageAt: number;
  }>;
  total: number;
}

export interface KnowledgeListResponse {
  items: Array<{
    id: string;
    type: KnowledgeType;
    title: string;
    wordCount: number;
    status: KnowledgeStatus;
    createdAt: number;
  }>;
  total: number;
}

// ============ Config Types ============
export interface ChatWidgetConfig {
  apiBaseUrl: string;
  authorSlug: string;
}

export interface AdminConfig {
  apiBaseUrl: string;
  adminKey: string;
}
