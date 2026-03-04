/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  getAuthorBySlug,
  getOrCreateConversation,
  addMessage,
  getConversationMessages,
  updateConversationSummary,
  getUnreadAdminMessages,
  markMessagesAsRead,
  incrementKnowledgeHitCount,
  searchKnowledge,
  KnowledgeSearchResult,
} from '../services/supabase';
import { generateResponse, generateSummary, ChatMessage } from '../services/gemini';
import { generateEmbedding } from '../services/embedding';

export const chatRouter = Router();

// POST /chat/:authorSlug/message
// Send a message to the AI
chatRouter.post('/:authorSlug/message', async (req: any, res: any) => {
  try {
    const { authorSlug } = req.params;
    const { sessionId, content } = req.body;

    // Validate input
    if (!sessionId || !content) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, content',
      });
    }

    // Get author
    const author = await getAuthorBySlug(authorSlug);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Get or create conversation
    const { conversation } = await getOrCreateConversation(
      author.id,
      sessionId
    );

    // Save user message
    await addMessage(author.id, conversation.id, 'user', content);

    // Get conversation history
    const messages = await getConversationMessages(author.id, conversation.id);

    // Convert to ChatMessage format
    const chatMessages: ChatMessage[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 使用向量搜尋找相關知識（語意匹配）
    let relevantKnowledge: KnowledgeSearchResult[] = [];
    try {
      // 1. 生成查詢的 embedding
      const queryEmbedding = await generateEmbedding(content);

      // 2. 使用向量搜尋找相關知識
      relevantKnowledge = await searchKnowledge(
        author.id,
        queryEmbedding,
        3,    // 取前 3 個結果
        0.35  // 相似度閾值（降低以增加召回率）
      );

      console.log(`Vector search found ${relevantKnowledge.length} results for query: "${content}"`);
      if (relevantKnowledge.length > 0) {
        console.log(`Top match: "${relevantKnowledge[0].title}" (similarity: ${relevantKnowledge[0].similarity.toFixed(3)}, link: ${relevantKnowledge[0].link_url || 'none'})`);

        // 更新命中次數
        try {
          await incrementKnowledgeHitCount(relevantKnowledge.map(k => k.id));
        } catch (hitErr) {
          console.error('Failed to update hit count:', hitErr);
        }
      }
    } catch (e) {
      console.error('Vector search failed:', e);
    }

    // 生成 AI 回答
    let aiResponse: string;

    if (relevantKnowledge.length > 0 && relevantKnowledge[0].content) {
      // 有匹配到知識庫，讓 AI 基於知識庫內容用親切語氣回答
      const knowledgeContent = relevantKnowledge[0].content;
      const hasLink = relevantKnowledge[0].link_text && relevantKnowledge[0].link_url;

      const enhancedPrompt = `你是恩如老師的 AI 助理「恩寶」，根據參考資料回答問題。

【參考資料】
${knowledgeContent}

【你的人設】
- 你是恩如老師團隊的一員，熱情友善
- 說話像朋友聊天，親切自然

【回答規則】
1. 根據參考資料回答，用自己的話重新表達
2. 用口語化、輕鬆的方式傳達，不要照念
3. 每次回答要稍微不同，避免重複
4. 用「你」不要用「您」「學弟」「學妹」
5. ${hasLink ? '可以說「點下方按鈕看更多」' : ''}
6. 控制在 25-45 字
7. 可以加一個表情符號

【禁止事項】
- 不要說「根據資料」「知識庫」等詞
- 不要完全照抄參考資料`;

      aiResponse = await generateResponse({
        systemPrompt: enhancedPrompt,
        messages: chatMessages,
        temperature: 0.8,
      });
      console.log(`Knowledge-based answer: "${aiResponse}"`);
    } else {
      // 沒有匹配到知識庫，巧妙轉移話題
      const fallbackPrompt = `你是恩如老師的 AI 助理「恩寶」，專門協助回答投資理財與課程相關問題。

【你的人設】
- 你是恩如老師團隊的一員，熱情友善
- 你熟悉恩如老師的「超簡單投資法」和各種課程
- 說話親切自然，像朋友聊天

【重要原則 - 絕對禁止】
- 絕對不能說「不知道」「我無法」「超出範圍」「抱歉」
- 絕對不能說「我是 AI」「我是機器人」「知識庫」
- 絕對不能推薦或評論個別股票

【回答策略】
當遇到你不確定的問題時：
1. 個股推薦/買賣建議 → 「想看個股分析的話，可以到恩寶AI問喔！那邊有即時的技術分析～」
2. 股票代號/股價查詢 → 「股票相關問題可以問恩寶AI，它會幫你分析！我這邊主要回答課程問題～」
3. 其他APP比較 → 「我比較熟悉恩如老師的強棒旺旺來喔～你想了解它的功能嗎？」
4. 無關問題 → 「哈哈我專注在投資理財這塊啦～對了，你想了解恩如老師的課程嗎？」
5. 價格問題 → 「價格會依課程方案不同，點下方按鈕可以看詳細資訊喔！」

【格式規則】
- 控制在 25-40 字
- 語氣輕鬆活潑
- 可以用一個表情符號
- 用「你」不要用「您」`;

      aiResponse = await generateResponse({
        systemPrompt: fallbackPrompt,
        messages: chatMessages,
        temperature: 0.9,
      });
      console.log(`Fallback answer: "${aiResponse}"`);
    }

    // 收集相關知識的連結（使用第一個有連結的知識項目）
    let linkText: string | undefined;
    let linkUrl: string | undefined;
    for (const k of relevantKnowledge) {
      console.log(`Checking knowledge "${k.title}" for link: link_text=${k.link_text}, link_url=${k.link_url}`);
      if (k.link_text && k.link_url) {
        linkText = k.link_text;
        linkUrl = k.link_url;
        console.log(`Found link: ${linkText} -> ${linkUrl}`);
        break;  // 只取第一個有連結的
      }
    }

    // Save AI response with link info
    const messageId = await addMessage(
      author.id,
      conversation.id,
      'assistant',
      aiResponse,
      { linkText, linkUrl }
    );

    // Generate summary for new conversations after a few messages
    if (messages.length >= 2 && !conversation.summary) {
      try {
        const summary = await generateSummary([
          ...chatMessages,
          { role: 'assistant', content: aiResponse },
        ]);
        await updateConversationSummary(author.id, conversation.id, summary);
      } catch (e) {
        console.error('Failed to generate AI summary, using fallback:', e);
        // Fallback: 使用第一則用戶訊息作為 summary
        const firstUserMessage = chatMessages.find(m => m.role === 'user');
        if (firstUserMessage) {
          const fallbackSummary = firstUserMessage.content.length > 30
            ? firstUserMessage.content.slice(0, 29) + '...'
            : firstUserMessage.content;
          await updateConversationSummary(author.id, conversation.id, fallbackSummary);
        }
      }
    }

    console.log(`Response will include: linkText=${linkText}, linkUrl=${linkUrl}`);

    res.json({
      messageId,
      content: aiResponse,
      timestamp: Date.now(),
      linkText,
      linkUrl,
    });
  } catch (error) {
    console.error('Error in chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /chat/:authorSlug/history/:sessionId
// Get conversation history
chatRouter.get('/:authorSlug/history/:sessionId', async (req: any, res: any) => {
  try {
    const { authorSlug, sessionId } = req.params;

    // Get author
    const author = await getAuthorBySlug(authorSlug);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Get conversation
    const { conversation } = await getOrCreateConversation(author.id, sessionId);

    // Get messages
    const messages = await getConversationMessages(author.id, conversation.id);

    res.json({
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /chat/:authorSlug/session
// Create a new session
chatRouter.post('/:authorSlug/session', async (req: any, res: any) => {
  try {
    const { authorSlug } = req.params;

    // Get author
    const author = await getAuthorBySlug(authorSlug);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    const sessionId = nanoid();

    res.json({
      sessionId,
      authorName: author.name,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /chat/:authorSlug/poll/:sessionId
// Poll for new admin messages (used by chat widget)
chatRouter.get('/:authorSlug/poll/:sessionId', async (req: any, res: any) => {
  try {
    const { authorSlug, sessionId } = req.params;
    const { lastMessageId } = req.query;

    // Get author
    const author = await getAuthorBySlug(authorSlug);
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    // Get conversation
    const { conversation } = await getOrCreateConversation(author.id, sessionId);

    // Get unread admin messages
    const newMessages = await getUnreadAdminMessages(
      conversation.id,
      lastMessageId as string | undefined
    );

    // Mark messages as read
    if (newMessages.length > 0) {
      await markMessagesAsRead(newMessages.map(m => m.id));
    }

    res.json({
      hasNewMessages: newMessages.length > 0,
      messages: newMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        isAdminReply: m.is_admin_reply || false,
        linkText: m.link_text,
        linkUrl: m.link_url,
      })),
    });
  } catch (error) {
    console.error('Error polling messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
