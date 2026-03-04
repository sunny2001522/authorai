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
        5,    // 取前 5 個結果（多取一些以便重新排序）
        0.30  // 相似度閾值（降低以匹配更多相關知識）
      );

      // 3. 特殊意圖偵測：根據關鍵字優先排序相關知識

      // 3a. 退費/退款偵測：優先找有客服連結的退費知識
      const hasRefundKeyword = /退費|退款|退課|退錢|取消訂閱|不想要了/.test(content);
      if (hasRefundKeyword && relevantKnowledge.length > 0) {
        // 優先找「買錯了可以退嗎？」（有客服連結）
        const refundWithLinkIndex = relevantKnowledge.findIndex(
          k => k.title.includes('買錯') && k.link_url?.includes('line.me')
        );
        if (refundWithLinkIndex > 0) {
          const refundKnowledge = relevantKnowledge[refundWithLinkIndex];
          relevantKnowledge.splice(refundWithLinkIndex, 1);
          relevantKnowledge.unshift(refundKnowledge);
          console.log(`Refund query detected, prioritizing: "${refundKnowledge.title}"`);
        } else {
          // 退而求其次，找其他退費相關
          const refundIndex = relevantKnowledge.findIndex(
            k => k.title.includes('退') || k.content?.includes('退費')
          );
          if (refundIndex > 0) {
            const refundKnowledge = relevantKnowledge[refundIndex];
            relevantKnowledge.splice(refundIndex, 1);
            relevantKnowledge.unshift(refundKnowledge);
            console.log(`Refund query detected, prioritizing: "${refundKnowledge.title}"`);
          }
        }
      }

      // 3b. 訂閱/續約偵測：優先找訂閱管理相關知識
      const hasSubscriptionKeyword = /續約|訂閱|換信用卡|更換卡|扣款|付款方式|會員中心/.test(content);
      if (hasSubscriptionKeyword && !hasRefundKeyword && relevantKnowledge.length > 0) {
        const subscriptionIndex = relevantKnowledge.findIndex(
          k => k.title.includes('續約') || k.title.includes('訂閱') ||
               k.link_url?.includes('memberSubscription') || k.content?.includes('訂閱管理')
        );
        if (subscriptionIndex > 0) {
          const subscriptionKnowledge = relevantKnowledge[subscriptionIndex];
          relevantKnowledge.splice(subscriptionIndex, 1);
          relevantKnowledge.unshift(subscriptionKnowledge);
          console.log(`Subscription query detected, prioritizing: "${subscriptionKnowledge.title}"`);
        }
      }

      // 3c. 股票代號偵測：如果查詢包含股票代號，優先使用「想要老師講特定的股票」
      const hasStockCode = /\d{4,6}|[A-Z]{2,5}/i.test(content);
      const hasStockKeyword = /股票|推薦|可以買|該買|能買|看好|分析|明牌/.test(content);

      if ((hasStockCode || hasStockKeyword) && !hasRefundKeyword && !hasSubscriptionKeyword && relevantKnowledge.length > 0) {
        const stockKnowledgeIndex = relevantKnowledge.findIndex(
          k => k.title.includes('想要老師講特定的股票') || k.link_url?.includes('enbaoai')
        );

        if (stockKnowledgeIndex > 0) {
          const stockKnowledge = relevantKnowledge[stockKnowledgeIndex];
          relevantKnowledge.splice(stockKnowledgeIndex, 1);
          relevantKnowledge.unshift(stockKnowledge);
          console.log(`Stock query detected, prioritizing: "${stockKnowledge.title}"`);
        }
      }

      // 只保留前 3 個
      relevantKnowledge = relevantKnowledge.slice(0, 3);

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
      // 有匹配到知識庫，讓 AI 基於多筆知識庫內容回答
      // 整合前 3 筆相關知識
      const knowledgeContents = relevantKnowledge
        .slice(0, 3)
        .map((k, i) => `【資料${i + 1}】${k.title}\n${k.content}`)
        .join('\n\n');
      const hasLink = relevantKnowledge.some(k => k.link_text && k.link_url);

      const enhancedPrompt = `你是恩如老師的 AI 助理「恩寶」，根據參考資料回答問題。

【參考資料】
${knowledgeContents}

【你的人設】
- 你是恩如老師團隊的一員，熱情友善
- 說話像朋友聊天，親切自然

【回答規則】
1. 可以綜合多筆參考資料來回答，給出更完整的答案
2. 用自己的話重新表達，像朋友聊天一樣自然
3. 每次回答要有變化，不要重複相同句式
4. 用「你」不要用「您」「學弟」「學妹」
5. ${hasLink ? '自然地提到「點下方按鈕可以看更多～」' : ''}
6. 字數彈性：簡單問題 20-40 字，需要詳細說明可到 80 字
7. 可以用 1-2 個表情符號讓對話更活潑

【禁止事項】
- 不要說「根據資料」「知識庫」「參考」等詞
- 不要完全照抄參考資料
- 不要用制式回答`;

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
- 字數彈性：20-50 字都可以
- 語氣輕鬆活潑，像朋友聊天
- 可以用 1-2 個表情符號
- 用「你」不要用「您」`;

      aiResponse = await generateResponse({
        systemPrompt: fallbackPrompt,
        messages: chatMessages,
        temperature: 0.9,
      });
      console.log(`Fallback answer: "${aiResponse}"`);
    }

    // 智慧連結匹配：根據 AI 回答內容決定要顯示哪個連結
    let linkText: string | undefined;
    let linkUrl: string | undefined;

    // 定義關鍵字與連結的對應關係
    const linkKeywords = [
      { keywords: ['客服', '聯絡', '進線', '諮詢', '小幫手'], linkContains: 'line.me' },
      { keywords: ['恩寶AI', '恩寶', '個股', '股票分析'], linkContains: 'enbaoai' },
      { keywords: ['報名', '課程'], linkContains: 'imoney889' },
      { keywords: ['服務條款', '條款'], linkContains: 'tos.aspx' },
      { keywords: ['訂閱', '續約', '會員中心', '訂閱管理', '信用卡', '扣款', '付款'], linkContains: 'memberSubscription' },
      { keywords: ['開戶', '口袋'], linkContains: 'pocket.tw' },
    ];

    // 先檢查 AI 回答中提到什麼，找對應的連結
    for (const { keywords, linkContains } of linkKeywords) {
      const mentionedInResponse = keywords.some(kw => aiResponse.includes(kw));
      if (mentionedInResponse) {
        // 在知識庫結果中找有這個連結的
        const matchingKnowledge = relevantKnowledge.find(k => k.link_url?.includes(linkContains));
        if (matchingKnowledge?.link_text && matchingKnowledge?.link_url) {
          linkText = matchingKnowledge.link_text;
          linkUrl = matchingKnowledge.link_url;
          console.log(`Smart link match: "${keywords.join('/')}" -> ${linkText}`);
          break;
        }
      }
    }

    // 如果沒有智慧匹配到，且 AI 回答有提到「按鈕」「點下方」，使用第一筆有連結的知識
    if (!linkUrl && /按鈕|點下方|看更多/.test(aiResponse)) {
      for (const k of relevantKnowledge) {
        if (k.link_text && k.link_url) {
          linkText = k.link_text;
          linkUrl = k.link_url;
          console.log(`Fallback link from: "${k.title}" -> ${linkText}`);
          break;
        }
      }
    }

    if (linkUrl) {
      console.log(`Final link: ${linkText} -> ${linkUrl}`);
    } else {
      console.log(`No link will be shown`);
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
