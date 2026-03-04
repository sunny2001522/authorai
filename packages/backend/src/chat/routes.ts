/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import {
  getAuthorBySlug,
  getOrCreateConversation,
  addMessage,
  getConversationMessages,
  updateConversationSummary,
  getKnowledgeItems,
  getUnreadAdminMessages,
  markMessagesAsRead,
  incrementKnowledgeHitCount,
  KnowledgeItem,
} from '../services/supabase';
import { generateResponse, generateSummary, ChatMessage } from '../services/gemini';

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

    // 簡單文字搜索：找出相關的知識庫內容
    let relevantKnowledge: KnowledgeItem[] = [];
    try {
      const allKnowledge = await getKnowledgeItems(author.id);
      const queryLower = content.toLowerCase();

      // 計算每個知識項目的匹配分數
      const scored = allKnowledge.map(item => {
        const titleLower = item.title.toLowerCase();
        const contentLower = item.content.toLowerCase();
        const combined = titleLower + ' ' + contentLower;
        let score = 0;

        // 基本關鍵字匹配（單字匹配）
        const keywords = queryLower.replace(/[？?！!，,。.]/g, '').split('');
        for (let i = 0; i < keywords.length - 1; i++) {
          const bigram = keywords[i] + keywords[i + 1];
          if (bigram.length >= 2 && combined.includes(bigram)) {
            score += 1;
          }
        }

        // ========== 意圖匹配規則 ==========

        // 【課程報名相關 - 最高優先級】
        // 匹配：美股課、台股課、課程、報名、上課等
        // 必須在股票推薦規則之前，避免「美股課」被股票規則攔截
        const isCourseQuery = queryLower.match(/美股課|台股課|課程|報名|上課|學習|體驗|講座|免費課/);
        if (isCourseQuery) {
          // 特定課程匹配（美股課）
          if (queryLower.includes('美股')) {
            if (combined.includes('美股') && (combined.includes('課') || combined.includes('報名'))) {
              score += 60;  // 最高優先級，超過股票推薦的 50 分
            }
          }
          // 特定課程匹配（台股課）
          else if (queryLower.includes('台股')) {
            if (combined.includes('台股') || combined.includes('課程') || combined.includes('報名')) {
              score += 55;
            }
          }
          // 一般課程查詢
          else if (combined.includes('課程') || combined.includes('報名') || combined.includes('課')) {
            score += 25;  // 高於股票推薦的一般匹配 20 分
          }
        }

        // 股票推薦/買賣相關 → 匹配「想要老師講特定的股票」
        // 各種問法：買哪檔、推薦什麼、哪支股票、個股分析、明牌、飆股、好股等
        // 也包含股票代號（如 0050, 2330, AAPL, TSLA 等）
        // 注意：已移除單獨的「股」字，避免「美股課」被誤判
        const isStockRecommendQuestion = queryLower.match(
          /股票|買|賣|推薦|個股|明牌|飆股|好股|哪檔|哪支|哪一檔|什麼股|看好|看漲|看跌|進場|出場|加碼|存股|標的|投資.*什麼|\d{4,6}|[a-z]{2,5}/i
        );
        // 排除課程相關查詢（避免「美股課」被誤判為股票推薦）
        const isCourseRelated = queryLower.match(/課|報名|上課|學習|體驗|講座/);
        if (isStockRecommendQuestion && !isCourseRelated) {
          // 優先匹配「想要老師講特定的股票」這篇
          if (titleLower.includes('股票') && titleLower.includes('老師')) {
            score += 50;  // 最高優先級
          } else if (titleLower.includes('股票') || contentLower.includes('股票')) {
            score += 20;
          }
        }

        // APP/軟體相關
        if (queryLower.match(/app|軟體|強棒|下載|安裝/i)) {
          if (combined.match(/app|軟體|強棒/i)) score += 15;
        }

        // 詐騙/私訊相關
        if (queryLower.match(/詐騙|私訊|假.*助理|騙/)) {
          if (combined.includes('詐騙')) score += 20;
        }

        // 群組相關
        if (queryLower.match(/群|社群|加入|連結/)) {
          if (combined.includes('群')) score += 15;
        }

        // 付款/退款相關
        if (queryLower.match(/付款|退款|刷卡|信用卡|繳費/)) {
          if (combined.match(/付款|退|刷|信用卡|繳費/)) score += 15;
        }

        return { item, score };
      });

      // 只取分數 > 0 的，按分數排序，取前 3 個
      relevantKnowledge = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => s.item);

      console.log(`Found ${relevantKnowledge.length} relevant knowledge items for query: "${content}"`);
      if (relevantKnowledge.length > 0) {
        console.log(`Top match: "${relevantKnowledge[0].title}" (link: ${relevantKnowledge[0].link_url || 'none'})`);

        // 更新命中次數
        try {
          await incrementKnowledgeHitCount(relevantKnowledge.map(k => k.id));
        } catch (hitErr) {
          console.error('Failed to update hit count:', hitErr);
        }
      }
    } catch (e) {
      console.error('Knowledge search failed:', e);
    }

    // 生成 AI 回答
    let aiResponse: string;

    if (relevantKnowledge.length > 0 && relevantKnowledge[0].content) {
      // 有匹配到知識庫，讓 AI 基於知識庫內容用親切語氣回答
      const knowledgeContent = relevantKnowledge[0].content;
      const hasLink = relevantKnowledge[0].link_text && relevantKnowledge[0].link_url;

      const enhancedPrompt = `你是恩如老師的助理，親切友善地回答問題。

【核心任務】
根據知識庫內容回答用戶問題，不要自己編造內容。

【知識庫內容】
${knowledgeContent}

【回答規則】
1. 直接根據知識庫內容回答，不要額外發揮
2. 用口語化、親切的方式傳達
3. 不要說「學弟」「學妹」「您」，直接說「你」
4. ${hasLink ? '提到可以點下方按鈕了解更多' : ''}
5. 控制在 20-40 字以內
6. 可以加一個表情符號結尾
7. 除非知識庫內容有提到「恩寶AI」，否則不要提「恩寶AI」或「強棒旺旺來」`;

      aiResponse = await generateResponse({
        systemPrompt: enhancedPrompt,
        messages: chatMessages,
        temperature: 0.8,
      });
      console.log(`Knowledge-based answer: "${aiResponse}"`);
    } else {
      // 沒有匹配到知識庫，使用 AI 生成回答
      const defaultSystemPrompt = '你是一位友善的 AI 助理，用親切的語氣回答問題。';
      const basePrompt = author.system_prompt || defaultSystemPrompt;
      const enhancedPrompt = `${basePrompt}

【重要規則】
- 不要稱呼用戶為「學弟」或「學妹」
- 回答要簡潔，最多 30 字
- 語氣親切友善`;

      aiResponse = await generateResponse({
        systemPrompt: enhancedPrompt,
        messages: chatMessages,
        temperature: author.temperature,
      });
      console.log(`AI generated answer: "${aiResponse}"`);
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
