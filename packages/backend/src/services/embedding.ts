/**
 * Embedding Service
 * 使用 Google Gemini text-embedding-005 生成向量
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * 生成文字的 embedding 向量
 * 使用 Gemini text-embedding-005 模型 (768 維度)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({
    model: 'text-embedding-005',
  });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * 批量生成 embedding
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  category: string | null;
  similarity: number;
}
