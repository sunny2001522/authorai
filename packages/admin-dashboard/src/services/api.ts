const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ============ Authors ============

export interface Author {
  id: string;
  name: string;
  slug: string;
  avatar_url?: string;
}

export async function getAuthors(): Promise<{ authors: Author[] }> {
  const response = await fetch(`${API_BASE}/admin/authors`);
  if (!response.ok) throw new Error('Failed to fetch authors');
  return response.json();
}

export async function getAuthorInfo(slug: string): Promise<Author & { system_prompt: string; temperature: number }> {
  const response = await fetch(`${API_BASE}/admin/${slug}/info`);
  if (!response.ok) throw new Error('Failed to fetch author info');
  return response.json();
}

// ============ Conversations ============

export interface Conversation {
  id: string;
  session_id: string;
  summary?: string;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isAdminReply?: boolean;
  isRecalled?: boolean;
  linkText?: string;
  linkUrl?: string;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  messages: Message[];
}

export async function getConversations(slug: string): Promise<{
  conversations: Conversation[];
  total: number;
}> {
  const response = await fetch(`${API_BASE}/admin/${slug}/conversations`);
  if (!response.ok) throw new Error('Failed to fetch conversations');
  return response.json();
}

export async function getConversation(
  slug: string,
  convId: string
): Promise<ConversationDetail> {
  const response = await fetch(
    `${API_BASE}/admin/${slug}/conversations/${convId}`
  );
  if (!response.ok) throw new Error('Failed to fetch conversation');
  return response.json();
}

export async function deleteConversation(
  slug: string,
  convId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/admin/${slug}/conversations/${convId}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Failed to delete conversation');
}

// 管理員回覆對話
export async function sendAdminReply(
  slug: string,
  convId: string,
  content: string,
  linkText?: string,
  linkUrl?: string
): Promise<{ success: boolean; messageId: string; timestamp: string }> {
  const response = await fetch(
    `${API_BASE}/admin/${slug}/conversations/${convId}/reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, linkText, linkUrl }),
    }
  );
  if (!response.ok) throw new Error('Failed to send admin reply');
  return response.json();
}

// 收回管理員訊息
export async function recallAdminMessage(
  slug: string,
  messageId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${API_BASE}/admin/${slug}/messages/${messageId}/recall`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (!response.ok) throw new Error('Failed to recall message');
  return response.json();
}

// ============ Knowledge ============

export interface KnowledgeItem {
  id: string;
  authorId: string | null;  // null = 共用知識
  title: string;
  content?: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  subcategory3?: string;
  linkText?: string;
  linkUrl?: string;
  hitCount?: number;       // RAG 搜尋命中次數
  lastHitAt?: string;      // 最後命中時間
  createdAt: string;
  updatedAt: string;
}

export async function getKnowledgeItems(slug: string): Promise<{
  items: KnowledgeItem[];
  total: number;
}> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge`);
  if (!response.ok) throw new Error('Failed to fetch knowledge items');
  return response.json();
}

export interface AddKnowledgeParams {
  title: string;
  content: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  subcategory3?: string;
  linkText?: string;
  linkUrl?: string;
  isShared?: boolean;  // true = 共用知識 (author_id = null)
}

// AI 處理後的知識項目
export interface ProcessedKnowledgeItem {
  title: string;
  content: string;
  category: string;
  sub_category?: string;
}

// AI 智能處理知識內容
export async function processKnowledgeWithAI(
  slug: string,
  content: string
): Promise<{
  success: boolean;
  shouldSplit: boolean;
  items: ProcessedKnowledgeItem[];
}> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error('AI processing failed');
  return response.json();
}

export async function addTextKnowledge(
  slug: string,
  params: AddKnowledgeParams
): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to add knowledge');
  return response.json();
}

export interface UpdateKnowledgeParams {
  title?: string;
  content?: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  subcategory3?: string;
  linkText?: string;
  linkUrl?: string;
}

export async function updateKnowledge(
  slug: string,
  itemId: string,
  updates: UpdateKnowledgeParams
): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update knowledge');
}

// 取得所有分類（用於下拉選單）
export async function getCategories(slug: string): Promise<{
  categories: string[];
  subcategory1Map: Record<string, string[]>;
  subcategory2Map: Record<string, string[]>;
  subcategory3Map: Record<string, string[]>;
}> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/categories`);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

export async function deleteKnowledge(
  slug: string,
  itemId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/${itemId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete knowledge');
}

// ============ Transcription ============

export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string; success: boolean }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const response = await fetch(`${API_BASE}/admin/transcribe`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to transcribe audio');
  return response.json();
}

// ============ Statistics ============

export interface DailyMessageStats {
  date: string;
  userMessageCount: number;
}

export interface MessageStats {
  totalUserMessages: number;
  dailyStats: DailyMessageStats[];
}

export async function getMessageStats(slug: string): Promise<MessageStats> {
  const response = await fetch(`${API_BASE}/admin/${slug}/stats/messages`);
  if (!response.ok) throw new Error('Failed to fetch message stats');
  return response.json();
}

// ============ Webhook ============

// 發送 Bug 通知給 PM
export async function notifyBugToWebhook(
  slug: string,
  params: { title: string; content: string; category?: string }
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/admin/${slug}/webhook/notify-bug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to send notification');
  return response.json();
}

// AI 自動分類長文字
export async function categorizeContent(
  slug: string,
  content: string
): Promise<{
  success: boolean;
  message: string;
  items: { id: string; title: string; category: string; sub_category?: string }[];
}> {
  const response = await fetch(`${API_BASE}/admin/${slug}/knowledge/categorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error('Failed to categorize content');
  return response.json();
}
