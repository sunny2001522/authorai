/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import multer from 'multer';
import {
  getAllAuthors,
  getAuthorBySlug,
  createAuthor,
  getKnowledgeItems,
  addKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  getAuthorConversations,
  getConversationMessages,
  deleteConversation,
  getDailyMessageStats,
  getTotalUserMessageCount,
  getConversationById,
  addAdminMessage,
  recallAdminMessage,
  getKnowledgeWithoutEmbedding,
  updateKnowledgeEmbedding,
} from '../services/supabase';
import { transcribeAudio } from '../services/whisper';
import { processKnowledgeContent } from '../services/gemini';
import { generateEmbedding } from '../services/embedding';

export const adminRouter = Router();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// Middleware to get author by slug
const getAuthor = async (req: any, res: any, next: any) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ error: 'Missing author slug' });
  }

  const author = await getAuthorBySlug(slug);
  if (!author) {
    return res.status(404).json({ error: 'Author not found' });
  }

  req.author = author;
  next();
};

// ============ Authors ============

// GET /admin/authors
// List all authors
adminRouter.get('/authors', async (_req: any, res: any) => {
  try {
    const authors = await getAllAuthors();

    res.json({
      authors: authors.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
      })),
    });
  } catch (error) {
    console.error('Error listing authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/authors
// Create a new author
adminRouter.post('/authors', async (req: any, res: any) => {
  try {
    const { name, slug } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!slug || !slug.trim()) {
      return res.status(400).json({ error: 'Missing slug' });
    }

    // 驗證 slug 格式（只允許小寫字母、數字、連字號）
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({ error: 'Invalid slug format. Only lowercase letters, numbers, and hyphens are allowed.' });
    }

    // 檢查 slug 是否已存在
    const existingAuthor = await getAuthorBySlug(slug);
    if (existingAuthor) {
      return res.status(409).json({ error: 'Slug already exists' });
    }

    const author = await createAuthor(name.trim(), slug.trim());

    res.json({
      success: true,
      author: {
        id: author.id,
        name: author.name,
        slug: author.slug,
      },
    });
  } catch (error) {
    console.error('Error creating author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ Author Info ============

// GET /admin/:slug/info
// Get author info
adminRouter.get('/:slug/info', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;

    res.json({
      id: author.id,
      name: author.name,
      slug: author.slug,
      system_prompt: author.system_prompt,
      temperature: author.temperature,
    });
  } catch (error) {
    console.error('Error getting author info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ Conversations ============

// GET /admin/:slug/conversations
// List all conversations for an author
adminRouter.get('/:slug/conversations', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const conversations = await getAuthorConversations(author.id);

    res.json({
      conversations: conversations.map(c => ({
        ...c,
        started_at: c.started_at,
        last_message_at: c.last_message_at,
      })),
      total: conversations.length,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/:slug/conversations/:convId
// Get conversation details with messages
adminRouter.get('/:slug/conversations/:convId', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { convId } = req.params;

    // 管理員可以看到所有訊息，包含已收回的
    const messages = await getConversationMessages(author.id, convId, { includeRecalled: true });

    res.json({
      id: convId,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        isAdminReply: m.is_admin_reply || false,
        isRecalled: m.is_recalled || false,
        linkText: m.link_text,
        linkUrl: m.link_url,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/:slug/conversations/:convId/reply
// Send admin reply to conversation
adminRouter.post('/:slug/conversations/:convId/reply', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { convId } = req.params;
    const { content, linkText, linkUrl } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Missing content' });
    }

    // 驗證連結：如果有 linkText 必須有 linkUrl
    if (linkText && !linkUrl) {
      return res.status(400).json({ error: 'linkUrl is required when linkText is provided' });
    }

    // 驗證對話存在且屬於該作者
    const conversation = await getConversationById(author.id, convId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 新增管理員回覆訊息
    const messageId = await addAdminMessage(convId, {
      content: content.trim(),
      linkText,
      linkUrl,
    });

    res.json({
      success: true,
      messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending admin reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/:slug/conversations/:convId
// Delete a conversation and all its messages
adminRouter.delete('/:slug/conversations/:convId', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { convId } = req.params;

    await deleteConversation(author.id, convId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/:slug/messages/:messageId/recall
// Recall (soft delete) an admin message
adminRouter.post('/:slug/messages/:messageId/recall', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { messageId } = req.params;

    const success = await recallAdminMessage(author.id, messageId);

    if (!success) {
      return res.status(404).json({ error: 'Message not found or not an admin reply' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error recalling message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ Knowledge ============

// GET /admin/:slug/knowledge
// List all knowledge items (including shared items with author_id = null)
adminRouter.get('/:slug/knowledge', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const items = await getKnowledgeItems(author.id);

    res.json({
      items: items.map(item => ({
        id: item.id,
        authorId: item.author_id,
        title: item.title,
        content: item.content,
        category: item.category,
        subcategory1: item.subcategory1,
        subcategory2: item.subcategory2,
        subcategory3: item.subcategory3,
        linkText: item.link_text,
        linkUrl: item.link_url,
        hitCount: item.hit_count || 0,
        lastHitAt: item.last_hit_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error('Error listing knowledge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/:slug/knowledge/categories
// Get all unique categories for dropdowns
adminRouter.get('/:slug/knowledge/categories', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const items = await getKnowledgeItems(author.id);

    const categories = new Set<string>();
    const subcategory1Map: Record<string, Set<string>> = {};
    const subcategory2Map: Record<string, Set<string>> = {};
    const subcategory3Map: Record<string, Set<string>> = {};

    for (const item of items) {
      if (item.category) {
        categories.add(item.category);

        if (!subcategory1Map[item.category]) {
          subcategory1Map[item.category] = new Set();
        }
        if (item.subcategory1) {
          subcategory1Map[item.category].add(item.subcategory1);

          const key1 = `${item.category}|${item.subcategory1}`;
          if (!subcategory2Map[key1]) {
            subcategory2Map[key1] = new Set();
          }
          if (item.subcategory2) {
            subcategory2Map[key1].add(item.subcategory2);

            const key2 = `${key1}|${item.subcategory2}`;
            if (!subcategory3Map[key2]) {
              subcategory3Map[key2] = new Set();
            }
            if (item.subcategory3) {
              subcategory3Map[key2].add(item.subcategory3);
            }
          }
        }
      }
    }

    res.json({
      categories: Array.from(categories).sort(),
      subcategory1Map: Object.fromEntries(
        Object.entries(subcategory1Map).map(([k, v]) => [k, Array.from(v).sort()])
      ),
      subcategory2Map: Object.fromEntries(
        Object.entries(subcategory2Map).map(([k, v]) => [k, Array.from(v).sort()])
      ),
      subcategory3Map: Object.fromEntries(
        Object.entries(subcategory3Map).map(([k, v]) => [k, Array.from(v).sort()])
      ),
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/:slug/knowledge/text
// POST /admin/:slug/knowledge/process
// AI 智能處理知識內容（分析、整理、分類）
adminRouter.post('/:slug/knowledge/process', getAuthor, async (req: any, res: any) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Missing content' });
    }

    console.log('Processing knowledge content with AI...');
    const result = await processKnowledgeContent(content.trim());
    console.log('AI processing result:', result);

    res.json({
      success: true,
      shouldSplit: result.shouldSplit,
      items: result.items,
    });
  } catch (error) {
    console.error('Error processing knowledge:', error);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// POST /admin/:slug/knowledge/categorize
// AI 分類並存儲知識內容
adminRouter.post('/:slug/knowledge/categorize', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Missing content' });
    }

    // 1. 使用 AI 處理內容
    const result = await processKnowledgeContent(content.trim());

    // 2. 將每個項目存入資料庫並生成 embedding
    const savedItems: Array<{ id: string; title: string; category: string; sub_category?: string }> = [];

    for (const item of result.items) {
      const id = await addKnowledgeItem(author.id, {
        title: item.title,
        content: item.content,
        category: item.category,
        subcategory1: item.sub_category,
      });
      savedItems.push({
        id,
        title: item.title,
        category: item.category,
        sub_category: item.sub_category,
      });

      // 自動生成 embedding（背景執行）
      generateEmbedding(`${item.title} ${item.content}`)
        .then(embedding => updateKnowledgeEmbedding(author.id, id, embedding))
        .then(() => console.log(`Generated embedding for: "${item.title}"`))
        .catch(e => console.error(`Failed to generate embedding for "${item.title}":`, e));
    }

    // 3. 回傳前端期望的格式
    res.json({
      success: true,
      message: `已成功新增 ${savedItems.length} 筆知識`,
      items: savedItems,
    });
  } catch (error) {
    console.error('Error categorizing content:', error);
    res.status(500).json({ error: 'Failed to categorize content' });
  }
});

// POST /admin/:slug/knowledge/text
// Add text knowledge
adminRouter.post('/:slug/knowledge/text', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { title, content, category, subcategory1, subcategory2, subcategory3, linkText, linkUrl, isShared } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content' });
    }

    // isShared = true 時，author_id 設為 null（共用知識）
    const authorId = isShared ? null : author.id;

    const itemId = await addKnowledgeItem(authorId, {
      title,
      content,
      category,
      subcategory1,
      subcategory2,
      subcategory3,
      link_text: linkText,
      link_url: linkUrl,
    });

    // 自動生成 embedding（背景執行，不阻塞回應）
    generateEmbedding(`${title} ${content}`)
      .then(embedding => updateKnowledgeEmbedding(authorId, itemId, embedding))
      .then(() => console.log(`Generated embedding for new knowledge: "${title}"`))
      .catch(e => console.error(`Failed to generate embedding for "${title}":`, e));

    res.json({ id: itemId, success: true });
  } catch (error) {
    console.error('Error adding text knowledge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /admin/:slug/knowledge/:itemId
// Update knowledge item
adminRouter.put('/:slug/knowledge/:itemId', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { itemId } = req.params;
    const { title, content, category, subcategory1, subcategory2, subcategory3, linkText, linkUrl } = req.body;

    await updateKnowledgeItem(author.id, itemId, {
      title,
      content,
      category,
      subcategory1,
      subcategory2,
      subcategory3,
      link_text: linkText,
      link_url: linkUrl,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/:slug/knowledge/:itemId
// Delete knowledge item
adminRouter.delete('/:slug/knowledge/:itemId', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { itemId } = req.params;

    await deleteKnowledgeItem(author.id, itemId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/:slug/knowledge/generate-embeddings
// 為所有缺少 embedding 的知識項目生成向量
adminRouter.post('/:slug/knowledge/generate-embeddings', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const items = await getKnowledgeWithoutEmbedding(author.id);

    console.log(`Found ${items.length} knowledge items without embedding for author ${author.slug}`);

    let processed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const text = `${item.title} ${item.content}`;
        const embedding = await generateEmbedding(text);
        await updateKnowledgeEmbedding(author.id, item.id, embedding);
        processed++;
        console.log(`Generated embedding for "${item.title}"`);
      } catch (e) {
        console.error(`Failed to generate embedding for item ${item.id}:`, e);
        errors.push(item.title);
      }
    }

    res.json({
      success: true,
      total: items.length,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({ error: 'Failed to generate embeddings' });
  }
});

// ============ Statistics ============

// GET /admin/:slug/stats/messages
// Get daily user message statistics
adminRouter.get('/:slug/stats/messages', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;

    const [dailyStats, totalCount] = await Promise.all([
      getDailyMessageStats(author.id),
      getTotalUserMessageCount(author.id),
    ]);

    res.json({
      totalUserMessages: totalCount,
      dailyStats,
    });
  } catch (error) {
    console.error('Error getting message stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============ Webhook ============

// POST /admin/:slug/webhook/notify-bug
// Send bug notification to PM via chat webhook
adminRouter.post('/:slug/webhook/notify-bug', getAuthor, async (req: any, res: any) => {
  try {
    const { author } = req;
    const { title, content, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content' });
    }

    // Get webhook URL from environment
    const webhookUrl = process.env.PM_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('PM_WEBHOOK_URL not configured');
      return res.json({ success: true, message: 'Webhook not configured' });
    }

    // Send to webhook
    const message = `🐛 **產品 Bug 回報**\n\n**作者：** ${author.name}\n**分類：** ${category || '未分類'}\n**標題：** ${title}\n\n**內容：**\n${content}`;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending webhook:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ============ Transcription ============

// POST /admin/transcribe
// Transcribe audio to text using Whisper
adminRouter.post('/transcribe', upload.single('audio'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = req.file.buffer;
    const mimeType = req.file.mimetype || 'audio/webm';

    const text = await transcribeAudio(audioBuffer, mimeType);

    res.json({ text, success: true });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});
