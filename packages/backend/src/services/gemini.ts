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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateResponseParams {
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export async function generateResponse(params: GenerateResponseParams): Promise<string> {
  const {
    systemPrompt,
    messages,
    temperature = 0.5,
    maxTokens = 50,  // 嚴格限制 token 數量
  } = params;

  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  // Build conversation history for Gemini
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  // Start chat with history
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: `System: ${systemPrompt}` }] },
      { role: 'model', parts: [{ text: '收到，每次回覆限 20 字！' }] },
      ...history,
    ],
  });

  // Get the last user message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response.text().trim();

  return response;
}

export async function generateSummary(messages: ChatMessage[]): Promise<string> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 100,
    },
  });

  const conversationText = messages
    .map(m => `${m.role === 'user' ? '用戶' : '助理'}: ${m.content}`)
    .join('\n');

  const result = await model.generateContent(
    `請用一句話（最多30字）總結以下對話的主題：\n\n${conversationText}`
  );

  return result.response.text().trim();
}

export interface KnowledgeChunk {
  title: string;
  content: string;
  category: string;
  sub_category?: string;
}

export async function splitAndCategorizeContent(content: string): Promise<KnowledgeChunk[]> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const prompt = `你是一個知識整理助手。請將以下長文字內容分割成多個獨立的知識片段。

規則：
1. 每個片段應該是一個獨立的主題或問題
2. 為每個片段給一個簡短的標題（10字以內）
3. 分類名稱使用繁體中文，例如：「投資方法」、「課程資訊」、「常見問題」、「學員見證」等
4. 子分類是可選的，用來更細緻地分類

請以 JSON 陣列格式回覆，格式如下：
[
  {
    "title": "簡短標題",
    "content": "完整內容",
    "category": "分類名稱",
    "sub_category": "子分類（可選）"
  }
]

以下是需要整理的內容：

${content}

請直接回覆 JSON 陣列，不要加任何其他文字或 markdown 標記。`;

  const result = await model.generateContent(prompt);
  let responseText = result.response.text().trim();

  // Remove markdown code blocks if present
  if (responseText.startsWith('```json')) {
    responseText = responseText.slice(7);
  }
  if (responseText.startsWith('```')) {
    responseText = responseText.slice(3);
  }
  if (responseText.endsWith('```')) {
    responseText = responseText.slice(0, -3);
  }
  responseText = responseText.trim();

  try {
    const chunks = JSON.parse(responseText) as KnowledgeChunk[];
    return chunks;
  } catch (error) {
    console.error('Failed to parse AI response:', responseText);
    // Fallback: return the whole content as a single chunk
    return [{
      title: '知識內容',
      content: content,
      category: '未分類',
    }];
  }
}
