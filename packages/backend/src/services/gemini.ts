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

/**
 * AI 智能整理知識內容
 * - 自動判斷是否需要拆分
 * - 整理標題、內容
 * - 自動分類
 */
export interface ProcessedKnowledge {
  shouldSplit: boolean;
  items: KnowledgeChunk[];
}

export async function processKnowledgeContent(content: string): Promise<ProcessedKnowledge> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const prompt = `你是一個知識庫整理助手。請分析以下輸入內容並進行整理和拆分。

重要原則：積極拆分！每個獨立的功能、產品、服務、問題都應該是一筆獨立的知識。

任務：
1. 將內容拆分成多個獨立的知識點（每個功能/產品/服務/問題一筆）
2. 為每個知識點生成清楚的標題（簡短、明確、10字以內）
3. 整理內容（保持原意但更清晰易讀，可以適當補充說明）
4. 分配適當的分類標籤

分類選項（請從以下選擇或自訂）：
- 課程資訊（報名、上課、費用等）
- 投資方法（選股、技術分析、策略等）
- 常見問題（一般疑問）
- 學員見證（心得、推薦）
- APP問題（軟體、操作）
- 社群相關（群組、互動）
- 券商資訊（開戶、手續費）
- 其他

拆分標準（寧可多拆，不要少拆）：
- 不同的產品/服務 → 各自獨立一筆
- 不同的功能介紹 → 各自獨立一筆
- 不同的 Q&A → 各自獨立一筆
- 課程包含多個內容 → 各自獨立介紹
- 例如：「線上課程」「APP權限」「學員社團」應該拆成 3 筆

請以 JSON 格式回覆：
{
  "shouldSplit": true,
  "items": [
    {
      "title": "整理後的標題",
      "content": "整理後的內容（完整說明這個知識點）",
      "category": "分類",
      "sub_category": "子分類（可選）"
    }
  ]
}

以下是需要整理的內容：

${content}

請直接回覆 JSON，不要加任何其他文字或 markdown 標記。`;

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
    const parsed = JSON.parse(responseText) as ProcessedKnowledge;
    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', responseText);
    // Fallback: return the content as a single item
    return {
      shouldSplit: false,
      items: [{
        title: content.slice(0, 20) + (content.length > 20 ? '...' : ''),
        content: content,
        category: '未分類',
      }]
    };
  }
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
