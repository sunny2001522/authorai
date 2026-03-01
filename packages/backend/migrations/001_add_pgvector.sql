-- =============================================
-- Migration: 添加 pgvector 支援
-- 在 Supabase Dashboard > SQL Editor 執行此腳本
-- =============================================

-- 1. 啟用 pgvector 擴展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 在 knowledge 表添加 embedding 欄位
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. 創建向量搜索索引 (HNSW 算法)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
  ON knowledge USING hnsw (embedding vector_cosine_ops);

-- 4. 創建向量搜索函數
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

-- 5. 驗證設定
-- 執行以下查詢來確認設定成功：
-- SELECT * FROM pg_extension WHERE extname = 'vector';
-- \d knowledge
