-- =============================================
-- AI Chat Supabase Schema
-- 在 Supabase Dashboard > SQL Editor 執行此腳本
-- =============================================

-- 0. 啟用 pgvector 擴展（用於向量搜索）
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Authors 表 (作者/老師)
CREATE TABLE IF NOT EXISTS authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversations 表 (對話)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
  session_id VARCHAR(100) NOT NULL,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(author_id, session_id)
);

-- 3. Messages 表 (訊息)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,  -- 標記是否為管理員回覆
  link_text VARCHAR(200),                -- 連結顯示文字
  link_url TEXT,                         -- 連結 URL
  read_at TIMESTAMPTZ,                   -- 用戶讀取時間（用於輪詢）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Knowledge 表 (知識庫)
CREATE TABLE IF NOT EXISTS knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'file', 'audio')),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50),           -- 主分類：technical, course, community, brokerage, security, general
  subcategory VARCHAR(100),       -- 子分類：app_issue, payment, join_group, etc.
  subcategory1 VARCHAR(100),      -- 子分類1
  subcategory2 VARCHAR(100),      -- 子分類2
  subcategory3 VARCHAR(100),      -- 子分類3
  link_text VARCHAR(200),         -- 連結顯示文字
  link_url TEXT,                  -- 連結 URL
  original_file_name VARCHAR(255),
  file_url TEXT,
  mime_type VARCHAR(100),
  word_count INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 0,    -- RAG 搜尋命中次數
  last_hit_at TIMESTAMPTZ,        -- 最後命中時間
  status VARCHAR(20) DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'error')),
  embedding vector(768),          -- Gemini text-embedding-004 向量 (768 維度)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes 索引
-- =============================================

CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug);
CREATE INDEX IF NOT EXISTS idx_conversations_author_id ON conversations(author_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_author_id ON knowledge(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_subcategory ON knowledge(subcategory);
CREATE INDEX IF NOT EXISTS idx_knowledge_hit_count ON knowledge(hit_count DESC);

-- 管理員未讀訊息索引（用於輪詢）
CREATE INDEX IF NOT EXISTS idx_messages_unread_admin
  ON messages(conversation_id, is_admin_reply, read_at)
  WHERE is_admin_reply = TRUE AND read_at IS NULL;

-- 向量搜索索引 (HNSW 算法，比 IVFFlat 更快)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON knowledge USING hnsw (embedding vector_cosine_ops);

-- =============================================
-- 插入範例作者 (林恩如)
-- =============================================

INSERT INTO authors (name, slug, system_prompt, temperature)
VALUES (
  '林恩如',
  'enru',
  '你是 niiko 學姊，林恩如老師的 AI 助理。你的任務是幫助用戶了解美股投資和林恩如老師的課程。

關於林恩如老師：
- 擁有 28 年投資經驗
- 創立「超簡單投資法」
- 專注於美股投資教學

回答風格：
- 親切友善，像學姊一樣
- 專業但不生硬
- 適時推薦免費體驗課程',
  0.7
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- 插入範例知識庫
-- =============================================

INSERT INTO knowledge (author_id, type, title, content, word_count, status)
SELECT
  id,
  'text',
  '超簡單投資法介紹',
  '超簡單投資法是林恩如老師獨創的投資方法，核心理念是選擇趨勢向上的股票，用簡單的技術指標判斷進出場時機，並嚴格執行停損停利。',
  50,
  'ready'
FROM authors WHERE slug = 'enru'
ON CONFLICT DO NOTHING;

INSERT INTO knowledge (author_id, type, title, content, word_count, status)
SELECT
  id,
  'text',
  '課程資訊',
  '「美股致富聖經」線上體驗課完全免費，課程中恩如老師會分享超簡單投資法的核心理念、如何選擇優質美股、以及實際操作案例。',
  45,
  'ready'
FROM authors WHERE slug = 'enru'
ON CONFLICT DO NOTHING;

-- =============================================
-- RPC Function: 增加訊息計數
-- =============================================

CREATE OR REPLACE FUNCTION increment_message_count(conv_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE conversations
  SET message_count = message_count + 1
  WHERE id = conv_id
  RETURNING message_count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC Function: 向量搜索知識庫
-- =============================================

CREATE OR REPLACE FUNCTION search_knowledge(
  p_author_id UUID,
  p_query_embedding vector(768),
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  content TEXT,
  category VARCHAR(50),
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.title,
    k.content,
    k.category,
    (1 - (k.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM knowledge k
  WHERE k.author_id = p_author_id
    AND k.status = 'ready'
    AND k.embedding IS NOT NULL
    AND (1 - (k.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY k.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC Function: 增加知識庫命中計數
-- =============================================

CREATE OR REPLACE FUNCTION increment_knowledge_hit_count(item_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE knowledge
  SET
    hit_count = COALESCE(hit_count, 0) + 1,
    last_hit_at = NOW()
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Migration Script (執行一次即可)
-- 如果表已存在，使用 ALTER TABLE 新增欄位
-- =============================================

-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_admin_reply BOOLEAN DEFAULT FALSE;
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS link_text VARCHAR(200);
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS link_url TEXT;
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS subcategory1 VARCHAR(100);
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS subcategory2 VARCHAR(100);
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS subcategory3 VARCHAR(100);
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS link_text VARCHAR(200);
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS link_url TEXT;
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0;
-- ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS last_hit_at TIMESTAMPTZ;

-- =============================================
-- Migration: 移除 admin_key 和 avatar_url 欄位
-- =============================================
-- ALTER TABLE authors DROP COLUMN IF EXISTS admin_key;
-- ALTER TABLE authors DROP COLUMN IF EXISTS avatar_url;
-- ALTER TABLE authors ALTER COLUMN system_prompt DROP NOT NULL;
-- DROP INDEX IF EXISTS idx_authors_admin_key;
