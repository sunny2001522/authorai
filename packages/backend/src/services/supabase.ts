/**
 * Supabase Service
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============ Types ============

export interface Author {
  id: string;
  name: string;
  slug: string;
  admin_key: string;
  avatar_url?: string;
  system_prompt: string;
  temperature: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  author_id: string;
  session_id: string;
  summary?: string;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  is_admin_reply?: boolean;
  link_text?: string;
  link_url?: string;
  read_at?: string;
  created_at: string;
}

export interface KnowledgeItem {
  id: string;
  author_id: string | null;  // null = 共用知識
  title: string;
  content: string;
  category?: string;
  subcategory1?: string;
  subcategory2?: string;
  subcategory3?: string;
  link_text?: string;
  link_url?: string;
  hit_count?: number;
  last_hit_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  category?: string;
  link_text?: string;
  link_url?: string;
  similarity: number;
}

// ============ Supabase Client ============

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return supabase;
}

// ============ Author Operations ============

export async function getAllAuthors(): Promise<Author[]> {
  const client = getSupabase();

  const { data, error } = await client
    .from('authors')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as Author[];
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const client = getSupabase();

  const { data, error } = await client
    .from('authors')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as Author;
}

export async function getAuthorByAdminKey(adminKey: string): Promise<Author | null> {
  const client = getSupabase();

  const { data, error } = await client
    .from('authors')
    .select('*')
    .eq('admin_key', adminKey)
    .single();

  if (error || !data) return null;
  return data as Author;
}

// ============ Conversation Operations ============

export async function getOrCreateConversation(
  authorId: string,
  sessionId: string
): Promise<{ conversation: Conversation; isNew: boolean }> {
  const client = getSupabase();

  // Try to find existing
  const { data: existing } = await client
    .from('conversations')
    .select('*')
    .eq('author_id', authorId)
    .eq('session_id', sessionId)
    .single();

  if (existing) {
    return { conversation: existing as Conversation, isNew: false };
  }

  // Create new
  const now = new Date().toISOString();
  const { data: newConv, error } = await client
    .from('conversations')
    .insert({
      author_id: authorId,
      session_id: sessionId,
      message_count: 0,
      started_at: now,
      last_message_at: now,
    })
    .select()
    .single();

  if (error || !newConv) throw new Error('Failed to create conversation');

  return { conversation: newConv as Conversation, isNew: true };
}

export async function addMessage(
  authorId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  options?: { linkText?: string; linkUrl?: string }
): Promise<string> {
  const client = getSupabase();
  const now = new Date().toISOString();

  // Insert message (link columns temporarily disabled until Supabase schema cache refreshes)
  const insertData: Record<string, unknown> = {
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  };

  // Add link fields if provided
  if (options?.linkText) insertData.link_text = options.linkText;
  if (options?.linkUrl) insertData.link_url = options.linkUrl;

  const { data: newMsg, error } = await client
    .from('messages')
    .insert(insertData)
    .select()
    .single();

  if (error || !newMsg) {
    console.error('addMessage error:', error);
    throw new Error('Failed to add message');
  }

  // Update conversation message count and last_message_at
  // Get current count first
  const { data: conv } = await client
    .from('conversations')
    .select('message_count')
    .eq('id', conversationId)
    .single();

  const newCount = (conv?.message_count || 0) + 1;

  await client
    .from('conversations')
    .update({
      message_count: newCount,
      last_message_at: now,
    })
    .eq('id', conversationId);

  return newMsg.id;
}

export async function getConversationMessages(
  authorId: string,
  conversationId: string,
  options?: { includeRecalled?: boolean }
): Promise<Message[]> {
  const client = getSupabase();

  let query = client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId);

  // 預設過濾已收回的訊息，除非明確要求包含
  if (!options?.includeRecalled) {
    query = query.or('is_recalled.is.null,is_recalled.eq.false');
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as Message[];
}

export async function updateConversationSummary(
  authorId: string,
  conversationId: string,
  summary: string
): Promise<void> {
  const client = getSupabase();

  await client
    .from('conversations')
    .update({ summary })
    .eq('id', conversationId);
}

// ============ Knowledge Operations ============

/**
 * 取得知識庫項目
 * 包含該作者專屬的 + 共用的（author_id = null）
 */
export async function getKnowledgeItems(authorId: string): Promise<KnowledgeItem[]> {
  const client = getSupabase();

  const { data, error } = await client
    .from('knowledge')
    .select('*')
    .or(`author_id.eq.${authorId},author_id.is.null`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as KnowledgeItem[];
}

/**
 * 新增知識項目
 * authorId 可以是 null（共用知識）
 */
export async function addKnowledgeItem(
  authorId: string | null,
  item: Omit<KnowledgeItem, 'id' | 'author_id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const client = getSupabase();

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('knowledge')
    .insert({
      ...item,
      author_id: authorId,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) throw new Error('Failed to add knowledge item');
  return data.id;
}

export async function updateKnowledgeItem(
  authorId: string | null,
  itemId: string,
  updates: Partial<Pick<KnowledgeItem, 'title' | 'content' | 'category' | 'subcategory1' | 'subcategory2' | 'subcategory3' | 'link_text' | 'link_url'>>
): Promise<void> {
  const client = getSupabase();

  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  let query = client
    .from('knowledge')
    .update(updateData)
    .eq('id', itemId);

  // 處理 null author_id
  if (authorId === null) {
    query = query.is('author_id', null);
  } else {
    query = query.eq('author_id', authorId);
  }

  await query;
}

export async function deleteKnowledgeItem(
  authorId: string | null,
  itemId: string
): Promise<void> {
  const client = getSupabase();

  let query = client
    .from('knowledge')
    .delete()
    .eq('id', itemId);

  if (authorId === null) {
    query = query.is('author_id', null);
  } else {
    query = query.eq('author_id', authorId);
  }

  await query;
}

// ============ Knowledge Search (RAG) ============

/**
 * 向量搜索知識庫
 */
export async function searchKnowledge(
  authorId: string,
  queryEmbedding: number[],
  matchCount: number = 5,
  matchThreshold: number = 0.5
): Promise<KnowledgeSearchResult[]> {
  const client = getSupabase();

  // 調用 Supabase RPC 函數進行向量搜索
  const { data, error } = await client.rpc('search_knowledge', {
    p_author_id: authorId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
    p_match_threshold: matchThreshold,
  });

  if (error) {
    console.error('Knowledge search error:', error);
    return [];
  }

  return (data || []) as KnowledgeSearchResult[];
}

/**
 * 更新知識項目的 embedding
 */
export async function updateKnowledgeEmbedding(
  authorId: string,
  itemId: string,
  embedding: number[]
): Promise<void> {
  const client = getSupabase();

  const { error } = await client
    .from('knowledge')
    .update({
      embedding,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('author_id', authorId);

  if (error) {
    console.error('Failed to update embedding:', error);
    throw new Error('Failed to update embedding');
  }
}

/**
 * 獲取沒有 embedding 的知識項目
 */
export async function getKnowledgeWithoutEmbedding(
  authorId: string
): Promise<KnowledgeItem[]> {
  const client = getSupabase();

  const { data, error } = await client
    .from('knowledge')
    .select('*')
    .eq('author_id', authorId)
    .eq('status', 'ready')
    .is('embedding', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as KnowledgeItem[];
}

// ============ Admin: Conversations ============

export async function getAuthorConversations(authorId: string): Promise<Conversation[]> {
  const client = getSupabase();

  const { data, error } = await client
    .from('conversations')
    .select('*')
    .eq('author_id', authorId)
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data as Conversation[];
}

/**
 * 取得每日用戶訊息統計
 */
export async function getDailyMessageStats(authorId: string): Promise<{
  date: string;
  userMessageCount: number;
}[]> {
  const client = getSupabase();

  // 先取得該作者的所有對話 ID
  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .eq('author_id', authorId);

  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map(c => c.id);

  // 取得這些對話中所有 user 的訊息
  const { data: messages, error } = await client
    .from('messages')
    .select('created_at')
    .in('conversation_id', conversationIds)
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  if (error || !messages) return [];

  // 按日期分組統計
  const dailyStats: Record<string, number> = {};
  messages.forEach(msg => {
    const date = msg.created_at.split('T')[0]; // 取得 YYYY-MM-DD
    dailyStats[date] = (dailyStats[date] || 0) + 1;
  });

  return Object.entries(dailyStats).map(([date, count]) => ({
    date,
    userMessageCount: count,
  }));
}

/**
 * 取得用戶訊息總數
 */
export async function getTotalUserMessageCount(authorId: string): Promise<number> {
  const client = getSupabase();

  // 先取得該作者的所有對話 ID
  const { data: conversations } = await client
    .from('conversations')
    .select('id')
    .eq('author_id', authorId);

  if (!conversations || conversations.length === 0) return 0;

  const conversationIds = conversations.map(c => c.id);

  // 計算這些對話中所有 user 的訊息數量
  const { count, error } = await client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .eq('role', 'user');

  if (error) return 0;
  return count || 0;
}

export async function deleteConversation(
  authorId: string,
  conversationId: string
): Promise<void> {
  const client = getSupabase();

  // 先刪除訊息
  await client
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  // 再刪除對話
  const { error } = await client
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('author_id', authorId);

  if (error) {
    console.error('Failed to delete conversation:', error);
    throw new Error('Failed to delete conversation');
  }
}

// ============ Admin Reply Operations ============

/**
 * 取得單一對話
 */
export async function getConversationById(
  authorId: string,
  conversationId: string
): Promise<Conversation | null> {
  const client = getSupabase();

  const { data, error } = await client
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('author_id', authorId)
    .single();

  if (error || !data) return null;
  return data as Conversation;
}

/**
 * 新增管理員回覆訊息
 */
export async function addAdminMessage(
  conversationId: string,
  message: {
    content: string;
    linkText?: string;
    linkUrl?: string;
  }
): Promise<string> {
  const client = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: message.content,
      is_admin_reply: true,
      link_text: message.linkText,
      link_url: message.linkUrl,
      created_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Supabase insert error:', error);
    throw new Error(`Failed to add admin message: ${error?.message || 'Unknown error'}`);
  }

  // 更新對話的 message_count 和 last_message_at
  const { data: conv } = await client
    .from('conversations')
    .select('message_count')
    .eq('id', conversationId)
    .single();

  await client
    .from('conversations')
    .update({
      message_count: (conv?.message_count || 0) + 1,
      last_message_at: now,
    })
    .eq('id', conversationId);

  return data.id;
}

/**
 * 收回管理員訊息（軟刪除）
 */
export async function recallAdminMessage(
  authorId: string,
  messageId: string
): Promise<boolean> {
  const client = getSupabase();

  // 先驗證訊息存在且是管理員回覆
  const { data: message, error: msgError } = await client
    .from('messages')
    .select('id, conversation_id, is_admin_reply')
    .eq('id', messageId)
    .single();

  console.log('Recall message lookup:', { messageId, message, msgError });

  if (!message) {
    console.log('Message not found');
    return false;
  }

  // 檢查是否是管理員回覆（允許 true 或 null 都可以收回，只要是 assistant 角色）
  if (message.is_admin_reply !== true) {
    console.log('Not an admin reply, is_admin_reply:', message.is_admin_reply);
    return false;
  }

  // 驗證對話屬於該作者
  const { data: conv, error: convError } = await client
    .from('conversations')
    .select('author_id')
    .eq('id', message.conversation_id)
    .single();

  console.log('Conversation lookup:', { conv, convError, authorId });

  if (!conv || conv.author_id !== authorId) {
    console.log('Conversation not found or author mismatch');
    return false;
  }

  // 標記為已收回
  const { error } = await client
    .from('messages')
    .update({ is_recalled: true })
    .eq('id', messageId);

  console.log('Update result:', { error });

  return !error;
}

/**
 * 取得未讀的管理員訊息（用於輪詢）
 * 自動過濾已收回的訊息
 */
export async function getUnreadAdminMessages(
  conversationId: string,
  afterMessageId?: string
): Promise<Message[]> {
  const client = getSupabase();

  let query = client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_admin_reply', true)
    .is('read_at', null)
    .or('is_recalled.is.null,is_recalled.eq.false')
    .order('created_at', { ascending: true });

  if (afterMessageId) {
    // 取得 afterMessageId 的 created_at，只返回之後的訊息
    const { data: refMsg } = await client
      .from('messages')
      .select('created_at')
      .eq('id', afterMessageId)
      .single();

    if (refMsg) {
      query = query.gt('created_at', refMsg.created_at);
    }
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Message[];
}

/**
 * 標記訊息為已讀
 */
export async function markMessagesAsRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;

  const client = getSupabase();

  await client
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .in('id', messageIds);
}

// ============ Knowledge Hit Count Operations ============

/**
 * 增加知識項目的命中計數
 */
export async function incrementKnowledgeHitCount(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  const client = getSupabase();

  // 使用 RPC 函數進行批量更新
  for (const id of itemIds) {
    try {
      await client.rpc('increment_knowledge_hit_count', { item_id: id });
    } catch (e) {
      console.error(`Failed to increment hit count for ${id}:`, e);
    }
  }
}
