import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useOutletContext } from "react-router-dom";
import {
  getConversations,
  getConversation,
  getKnowledgeItems,
  getCategories,
  getMessageStats,
  updateKnowledge,
  deleteKnowledge,
  deleteConversation,
  notifyBugToWebhook,
  sendAdminReply,
  recallAdminMessage,
  addTextKnowledge,
  searchConversations,
  Conversation,
  Message,
  KnowledgeItem,
  Author,
  DailyMessageStats,
  ConversationSearchResult,
} from "../services/api";
import {
  MessageSquare,
  Clock,
  User,
  Bot,
  FileText,
  Sparkles,
  ChevronRight,
  Edit3,
  Trash2,
  Tag,
  Check,
  BarChart3,
  TrendingUp,
  Calendar,
  ChevronDown,
  Send,
  Link as LinkIcon,
  X,
  Undo2,
  Search,
  Plus,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { DateRangePicker } from "../components/common/DateRangePicker";

interface OutletContext {
  currentAuthor: Author;
  authors: Author[];
  darkMode: boolean;
  knowledgeRefreshKey: number;
}

export function AuthorDashboard() {
  const { slug, convId } = useParams();
  const location = useLocation();
  const context = useOutletContext<OutletContext>();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isSharedPage = location.pathname.includes("/shared");
  const isKnowledgeView = location.pathname.includes("/knowledge");
  const isSummaryView =
    location.pathname.includes("/summary") ||
    location.pathname.includes("/dashboard");

  // 處理「通用」頁面（只有知識庫）
  if (isSharedPage) {
    return (
      <KnowledgeView
        slug="shared"
        refreshKey={context?.knowledgeRefreshKey || 0}
        isSharedView={true}
      />
    );
  }

  if (!slug) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>請從側欄選擇一位作者</p>
      </div>
    );
  }

  if (isSummaryView) {
    return <SummaryView slug={slug} />;
  }

  if (isKnowledgeView) {
    return (
      <KnowledgeView
        slug={slug}
        refreshKey={context?.knowledgeRefreshKey || 0}
        isSharedView={false}
      />
    );
  }

  // 電腦版使用三欄佈局，手機版維持原有設計
  return (
    <ConversationsView
      slug={slug}
      selectedConvId={convId}
      isMobile={isMobile}
    />
  );
}

// ============ Conversations View ============

function ConversationsView({
  slug,
  selectedConvId,
  isMobile,
  isSharedView: _isSharedView = false,
}: {
  slug: string;
  selectedConvId?: string;
  isMobile: boolean;
  isSharedView?: boolean;
}) {
  // _isSharedView 可用於未來擴展顯示所有作者的對話
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedConv, setSelectedConv] = useState<string | null>(
    selectedConvId || null,
  );
  const [selectedConvData, setSelectedConvData] = useState<Conversation | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 回應學員狀態
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isComposing, setIsComposing] = useState(false); // IME 中文輸入狀態

  // 搜尋狀態
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDateRange, setSearchDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [showSearchDatePicker, setShowSearchDatePicker] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [slug]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv);
      // 找到選中的對話數據
      const conv = conversations.find((c) => c.id === selectedConv);
      setSelectedConvData(conv || null);
    }
  }, [selectedConv, slug, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await getConversations(slug);
      setConversations(data.conversations);
      // 電腦版自動選中第一個對話
      if (!isMobile && data.conversations.length > 0 && !selectedConvId) {
        setSelectedConv(data.conversations[0].id);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const data = await getConversation(slug, convId);
      setMessages(data.messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async (
    convId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!confirm("確定要刪除此對話嗎？")) return;
    try {
      await deleteConversation(slug, convId);

      // 計算刪除後要選擇的下一個對話
      const currentIndex = conversations.findIndex((c) => c.id === convId);
      const remainingConversations = conversations.filter(
        (c) => c.id !== convId,
      );

      setConversations(remainingConversations);

      if (selectedConv === convId) {
        // 刪除的是當前選中的對話，選擇下一個
        if (remainingConversations.length > 0) {
          // 優先選擇同位置或前一個
          const nextIndex = Math.min(
            currentIndex,
            remainingConversations.length - 1,
          );
          const nextConv = remainingConversations[nextIndex];
          setSelectedConv(nextConv.id);
          setSelectedConvData(nextConv);
        } else {
          // 沒有剩餘對話
          setSelectedConv(null);
          setMessages([]);
          setSelectedConvData(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      alert("刪除失敗");
    }
  };

  // 取得最後一則訊息預覽
  const getLastMessagePreview = (conv: Conversation) => {
    // 如果有當前對話的訊息，顯示最後一則
    if (selectedConv === conv.id && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      return (
        lastMsg.content.slice(0, 50) +
        (lastMsg.content.length > 50 ? "..." : "")
      );
    }
    return null;
  };

  // 發送回覆給學員
  const handleSendReply = async () => {
    if (!replyText.trim() || sending || !selectedConv) return;

    setSending(true);
    try {
      await sendAdminReply(
        slug,
        selectedConv,
        replyText.trim(),
        linkText || undefined,
        linkUrl || undefined,
      );
      setReplyText("");
      setLinkText("");
      setLinkUrl("");
      setShowLinkPopover(false);
      // 重新載入訊息
      await loadMessages(selectedConv);
      // 滾動到底部
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Failed to send reply:", err);
      const errorMessage = err instanceof Error ? err.message : "未知錯誤";
      alert(`發送失敗：${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  // 插入連結
  const handleInsertLink = () => {
    if (linkText && linkUrl) {
      setShowLinkPopover(false);
    }
  };

  // 收回訊息
  const handleRecallMessage = async (messageId: string) => {
    if (!confirm("確定要收回這則訊息嗎？用戶將無法再看到此訊息。")) return;

    try {
      await recallAdminMessage(slug, messageId);
      // 重新載入訊息
      if (selectedConv) {
        await loadMessages(selectedConv);
      }
    } catch (err) {
      console.error("Failed to recall message:", err);
      alert("收回訊息失敗");
    }
  };

  // 搜尋對話
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearchMode(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setIsSearchMode(true);
    try {
      const { results } = await searchConversations(slug, {
        q: searchQuery.trim(),
        startDate: searchDateRange.start?.toISOString().split("T")[0],
        endDate: searchDateRange.end?.toISOString().split("T")[0],
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // 清除搜尋
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchDateRange({ start: null, end: null });
    setIsSearchMode(false);
    setSearchResults([]);
  };

  // 從搜尋結果選擇對話
  const handleSelectSearchResult = (result: ConversationSearchResult) => {
    setSelectedConv(result.conversation_id);
    // 找到對應的對話資料
    const conv = conversations.find((c) => c.id === result.conversation_id);
    if (conv) {
      setSelectedConvData(conv);
    }
  };

  // 高亮搜尋關鍵字
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));

    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // 手機版：顯示對話列表或單一對話詳情
  if (isMobile) {
    if (selectedConv && messages.length > 0) {
      return (
        <div className="h-full flex flex-col bg-white">
          {/* Back button */}
          <button
            onClick={() => {
              setSelectedConv(null);
              setMessages([]);
              setSelectedConvData(null);
            }}
            className="flex items-center gap-2 px-4 py-3 text-gray-500 hover:text-gray-800 transition-colors border-b border-gray-100"
          >
            <ChevronRight size={18} className="rotate-180" />
            <span>返回對話列表</span>
          </button>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-gray-400">載入中...</div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "assistant" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user" ? "bg-blue-500" : "bg-[#b20a2c]"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User size={16} className="text-white" />
                      ) : (
                        <Bot size={16} className="text-white" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] ${msg.role === "assistant" ? "text-right" : ""}`}
                    >
                      <div
                        className={`inline-block px-4 py-3 rounded-2xl ${
                          msg.isRecalled
                            ? "bg-gray-200 text-gray-500 rounded-br-md"
                            : msg.role === "user"
                              ? "bg-blue-50 text-gray-800 rounded-bl-md"
                              : "bg-[#b20a2c] text-white rounded-br-md"
                        }`}
                      >
                        <p
                          className={`whitespace-pre-wrap text-[15px] leading-relaxed text-left ${msg.isRecalled ? "text-gray-500" : ""}`}
                        >
                          {msg.content}
                        </p>
                        {msg.isRecalled && (
                          <p className="text-xs mt-1 text-gray-400 text-left">
                            （已收回）
                          </p>
                        )}
                      </div>
                      {/* 收回按鈕 - 只有管理員回覆且未收回才顯示 */}
                      {msg.isAdminReply && !msg.isRecalled && (
                        <button
                          onClick={() => handleRecallMessage(msg.id)}
                          className="ml-2 p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                          title="收回訊息"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                      {/* 連結按鈕 - 已收回的訊息不顯示連結 */}
                      {msg.linkUrl && !msg.isRecalled && (
                        <div
                          className={`mt-2 ${msg.role === "assistant" ? "text-right" : ""}`}
                        >
                          <a
                            href={msg.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-col items-start px-3 py-1.5 bg-[#b20a2c]/10 text-[#b20a2c] text-sm rounded-lg hover:bg-[#b20a2c]/20 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <LinkIcon size={14} />
                              {msg.linkText || "連結"}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5 break-all text-left">
                              {msg.linkUrl}
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 手機版回應學員輸入框 */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="回覆學員..."
                  rows={1}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-[#b20a2c]/50 text-sm"
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                {/* 連結按鈕 */}
                <button
                  onClick={() => setShowLinkPopover(!showLinkPopover)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                    linkUrl ? "text-[#b20a2c] bg-[#b20a2c]/10" : "text-gray-400"
                  }`}
                >
                  <LinkIcon size={16} />
                </button>

                {/* 連結輸入彈窗 */}
                {showLinkPopover && (
                  <div className="absolute bottom-full right-0 mb-2 p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-64 z-10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700 font-medium">
                        添加連結
                      </span>
                      <button
                        onClick={() => setShowLinkPopover(false)}
                        className="p-1 text-gray-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="按鈕文字"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                    />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                    />
                    <button
                      onClick={handleInsertLink}
                      disabled={!linkText || !linkUrl}
                      className="w-full py-2 bg-[#b20a2c] text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      確認
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending}
                className="w-10 h-10 rounded-xl bg-[#b20a2c] hover:bg-[#8a0823] disabled:opacity-50 flex items-center justify-center flex-shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={18} className="text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 手機版對話列表
    return (
      <div className="h-full overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">載入中...</div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <MessageSquare size={48} className="mb-4 opacity-30" />
              <p>尚無對話記錄</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv.id)}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {conv.summary || "新對話"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <Clock size={14} />
                        <span>
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </span>
                        <span>·</span>
                        <span>{conv.message_count} 則訊息</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 電腦版：三欄佈局 (聊天列表 + 聊天內容)
  return (
    <div className="h-full flex bg-white">
      {/* 左側：對話列表 */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* 列表標題 + 搜尋區 */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800">對話紀錄</h3>
            <p className="text-xs text-gray-500">
              {isSearchMode
                ? `搜尋到 ${searchResults.length} 筆`
                : `共 ${conversations.length} 筆`}
            </p>
          </div>

          {/* 搜尋框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋對話內容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-16 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#b20a2c] text-sm"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {(searchQuery || searchDateRange.start) && (
                <button
                  onClick={handleClearSearch}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  title="清除搜尋"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="p-1.5 text-[#b20a2c] hover:bg-[#fffbd5] rounded"
                title="搜尋"
              >
                {isSearching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
              </button>
            </div>
          </div>

          {/* 日期範圍選擇 */}
          <div className="relative">
            <button
              onClick={() => setShowSearchDatePicker(!showSearchDatePicker)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              <Calendar size={12} />
              <span>
                {searchDateRange.start && searchDateRange.end
                  ? `${format(searchDateRange.start, "MM/dd")} - ${format(searchDateRange.end, "MM/dd")}`
                  : "選擇日期範圍"}
              </span>
            </button>
            {showSearchDatePicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSearchDatePicker(false)}
                />
                <DateRangePicker
                  startDate={searchDateRange.start}
                  endDate={searchDateRange.end}
                  onChange={(start, end) => {
                    setSearchDateRange({ start, end });
                  }}
                  onClose={() => setShowSearchDatePicker(false)}
                />
              </>
            )}
          </div>
        </div>

        {/* 對話列表 / 搜尋結果 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">載入中...</div>
            </div>
          ) : isSearchMode ? (
            /* 搜尋結果列表 */
            searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Search size={36} className="mb-3 opacity-30" />
                <p className="text-sm">找不到符合的對話</p>
                <button
                  onClick={handleClearSearch}
                  className="mt-2 text-xs text-[#b20a2c] hover:underline"
                >
                  清除搜尋
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {searchResults.map((result) => (
                  <div
                    key={`${result.conversation_id}-${result.message_id || "summary"}`}
                    onClick={() => handleSelectSearchResult(result)}
                    className={`px-4 py-3 cursor-pointer transition-colors group ${
                      selectedConv === result.conversation_id
                        ? "bg-[#fffbd5] border-l-2 border-l-[#b20a2c]"
                        : "hover:bg-white border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {/* 對話摘要 */}
                        <p
                          className={`font-medium truncate text-sm ${
                            selectedConv === result.conversation_id
                              ? "text-[#b20a2c]"
                              : "text-gray-800"
                          }`}
                        >
                          {highlightText(
                            result.conversation_summary || "新對話",
                            searchQuery,
                          )}
                        </p>
                        {/* 匹配的訊息內容預覽 */}
                        {result.match_type === "message" && result.message_content && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            <span className="text-gray-400">
                              {result.message_role === "user" ? "用戶：" : "AI："}
                            </span>
                            {highlightText(
                              result.message_content.slice(0, 100),
                              searchQuery,
                            )}
                            {result.message_content.length > 100 && "..."}
                          </p>
                        )}
                        {/* 匹配類型標籤 + 時間 */}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              result.match_type === "summary"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-green-100 text-green-600"
                            }`}
                          >
                            {result.match_type === "summary" ? "摘要" : "訊息"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(
                              new Date(result.last_message_at),
                              { addSuffix: true, locale: zhTW },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <MessageSquare size={36} className="mb-3 opacity-30" />
              <p className="text-sm">尚無對話記錄</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv.id)}
                  className={`px-4 py-3 cursor-pointer transition-colors group ${
                    selectedConv === conv.id
                      ? "bg-[#fffbd5] border-l-2 border-l-[#b20a2c]"
                      : "hover:bg-white border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* AI 摘要 */}
                      <p
                        className={`font-medium truncate text-sm ${
                          selectedConv === conv.id
                            ? "text-[#b20a2c]"
                            : "text-gray-800"
                        }`}
                      >
                        {conv.summary || "新對話"}
                      </p>
                      {/* 最後一則訊息預覽 */}
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {getLastMessagePreview(conv) ||
                          `${conv.message_count} 則訊息`}
                      </p>
                      {/* 時間 */}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </p>
                    </div>
                    {/* 刪除按鈕 */}
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右側：聊天內容 */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv && selectedConvData ? (
          <>
            {/* 對話標題列 */}
            <div className="px-6 py-3 border-b border-gray-100 bg-white">
              <h3 className="font-medium text-gray-800">
                {selectedConvData.summary || "新對話"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedConvData.message_count} 則訊息 ·{" "}
                {formatDistanceToNow(
                  new Date(selectedConvData.last_message_at),
                  { addSuffix: true, locale: zhTW },
                )}
              </p>
            </div>

            {/* 訊息列表 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-gray-400">載入中...</div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "assistant" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === "user" ? "bg-blue-500" : "bg-[#b20a2c]"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <User size={16} className="text-white" />
                        ) : (
                          <Bot size={16} className="text-white" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] ${msg.role === "assistant" ? "text-right" : ""} group/msg`}
                      >
                        <div
                          className={`inline-block px-4 py-3 rounded-2xl ${
                            msg.isRecalled
                              ? "bg-gray-200 text-gray-500 rounded-br-md"
                              : msg.role === "user"
                                ? "bg-blue-50 text-gray-800 rounded-bl-md"
                                : "bg-[#b20a2c] text-white rounded-br-md"
                          }`}
                        >
                          <p
                            className={`whitespace-pre-wrap text-[15px] leading-relaxed text-left ${msg.isRecalled ? "text-gray-500" : ""}`}
                          >
                            {msg.content}
                          </p>
                          <p
                            className={`text-xs mt-1 text-left ${
                              msg.isRecalled
                                ? "text-gray-400"
                                : msg.role === "user"
                                  ? "text-gray-400"
                                  : "text-red-200"
                            }`}
                          >
                            {format(new Date(msg.created_at), "HH:mm", {
                              locale: zhTW,
                            })}
                            {msg.isRecalled && (
                              <span className="ml-2">（已收回）</span>
                            )}
                          </p>
                        </div>
                        {/* 收回按鈕 - 只有管理員回覆且未收回才顯示 */}
                        {msg.isAdminReply && !msg.isRecalled && (
                          <button
                            onClick={() => handleRecallMessage(msg.id)}
                            className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover/msg:opacity-100 transition-all"
                            title="收回訊息"
                          >
                            <Undo2 size={14} />
                          </button>
                        )}
                        {/* 連結按鈕 - 已收回的訊息不顯示連結 */}
                        {msg.linkUrl && !msg.isRecalled && (
                          <div
                            className={`mt-2 ${msg.role === "assistant" ? "text-right" : ""}`}
                          >
                            <a
                              href={msg.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex flex-col items-start px-3 py-1.5 bg-[#b20a2c]/10 text-[#b20a2c] text-sm rounded-lg hover:bg-[#b20a2c]/20 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <LinkIcon size={14} />
                                {msg.linkText || "連結"}
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5 break-all text-left">
                                {msg.linkUrl}
                              </span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 回應學員輸入框 */}
            <div className="px-6 py-4 border-t border-gray-100 bg-white">
              <p className="text-sm text-gray-500 mb-2">回應學員與粉絲</p>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="輸入要回覆給學員的訊息..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-[#b20a2c]/50 focus:ring-1 focus:ring-[#b20a2c]/20"
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  {/* 添加連結按鈕 */}
                  <div className="absolute bottom-2 left-2">
                    <button
                      onClick={() => setShowLinkPopover(!showLinkPopover)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        linkUrl
                          ? "text-[#b20a2c] bg-[#b20a2c]/10"
                          : "text-gray-400 hover:text-[#b20a2c] hover:bg-gray-100"
                      }`}
                      title="添加連結"
                    >
                      <LinkIcon size={16} />
                    </button>

                    {/* 連結輸入彈窗 */}
                    {showLinkPopover && (
                      <div className="absolute bottom-full left-0 mb-2 p-3 bg-white border border-gray-200 rounded-xl shadow-xl w-64 z-10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 font-medium">
                            添加連結按鈕
                          </span>
                          <button
                            onClick={() => setShowLinkPopover(false)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={linkText}
                          onChange={(e) => setLinkText(e.target.value)}
                          placeholder="按鈕文字（例：點此報名）"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                        />
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                        />
                        <button
                          onClick={handleInsertLink}
                          disabled={!linkText || !linkUrl}
                          className="w-full py-2 bg-[#b20a2c] text-white text-sm rounded-lg hover:bg-[#8a0823] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          確認
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 連結預覽 */}
                  {linkUrl && linkText && (
                    <div className="absolute bottom-2 left-10 flex items-center gap-1 px-2 py-1 bg-[#b20a2c]/10 rounded text-xs text-[#b20a2c]">
                      <LinkIcon size={12} />
                      {linkText}
                      <button
                        onClick={() => {
                          setLinkText("");
                          setLinkUrl("");
                        }}
                        className="ml-1 hover:text-[#8a0823]"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sending}
                  className="px-4 rounded-xl bg-[#b20a2c] hover:bg-[#8a0823] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  title="發送訊息給學員"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={20} className="text-white" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                此訊息將即時推送給學員 · Enter 發送，Shift+Enter 換行
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p>選擇一個對話查看內容</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Knowledge View ============

// 英文分類轉中文對照表
const CATEGORY_MAP: Record<string, string> = {
  course: "課程資訊",
  technical: "技術分析",
  security: "安全須知",
  general: "一般問題",
  community: "社群互動",
  brokerage: "券商資訊",
  investment: "投資方法",
  faq: "常見問題",
  testimonial: "學員見證",
};

// 將英文分類轉換成中文顯示
function translateCategory(cat: string | undefined): string {
  if (!cat) return "";
  return CATEGORY_MAP[cat.toLowerCase()] || cat;
}

function KnowledgeView({
  slug,
  refreshKey,
  isSharedView = false,
}: {
  slug: string;
  refreshKey: number;
  isSharedView?: boolean;
}) {
  const context = useOutletContext<OutletContext>();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 分類資料（用於下拉選單）- 四層
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [subcategory1Map, setSubcategory1Map] = useState<
    Record<string, string[]>
  >({});
  const [subcategory2Map, setSubcategory2Map] = useState<
    Record<string, string[]>
  >({});
  const [subcategory3Map, setSubcategory3Map] = useState<
    Record<string, string[]>
  >({});

  // Get unique categories (原始值用於篩選，顯示時轉成中文)
  const categoryKeys = [
    "全部",
    ...new Set(items.map((i) => i.category).filter(Boolean) as string[]),
  ];

  // Filter items by category and search query
  const filteredItems = items.filter((item) => {
    // 分類過濾
    const categoryMatch =
      activeCategory === "全部" || item.category === activeCategory;

    // 搜尋過濾
    const searchMatch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.content &&
        item.content.toLowerCase().includes(searchQuery.toLowerCase()));

    return categoryMatch && searchMatch;
  });

  useEffect(() => {
    // 等待 authors 載入完成後再取得資料
    if (isSharedView && (!context?.authors || context.authors.length === 0)) {
      return;
    }
    loadItems();
    loadCategories();
  }, [slug, refreshKey, isSharedView, context?.authors]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // 通用頁面：使用第一個作者的 slug 來取得資料，再過濾出共用知識
      // 作者頁面：使用該作者的 slug
      const apiSlug =
        isSharedView && context?.authors?.length > 0
          ? context.authors[0].slug
          : slug;

      const data = await getKnowledgeItems(apiSlug);

      // 根據頁面類型過濾知識項目
      // isSharedView: 只顯示共用知識（authorId 為 null）
      // 作者頁面: 只顯示專屬知識（authorId 存在）
      const filtered = isSharedView
        ? data.items.filter((item: KnowledgeItem) => !item.authorId)
        : data.items.filter((item: KnowledgeItem) => item.authorId);
      setItems(filtered);
    } catch (error) {
      console.error("Failed to load knowledge:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const apiSlug =
        isSharedView && context?.authors?.length > 0
          ? context.authors[0].slug
          : slug;
      const data = await getCategories(apiSlug);
      setAllCategories(data.categories);
      setSubcategory1Map(data.subcategory1Map);
      setSubcategory2Map(data.subcategory2Map || {});
      setSubcategory3Map(data.subcategory3Map || {});
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("確定要刪除這筆知識嗎？")) return;
    try {
      await deleteKnowledge(slug, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("刪除失敗");
    }
  };

  const handleUpdate = async (
    itemId: string,
    updates: {
      title?: string;
      content?: string;
      category?: string;
      subcategory1?: string;
      subcategory2?: string;
      subcategory3?: string;
      linkText?: string;
      linkUrl?: string;
    },
  ) => {
    try {
      await updateKnowledge(slug, itemId, updates);
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
      );
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update:", error);
      alert("更新失敗");
    }
  };

  const handleAddNew = async () => {
    try {
      const apiSlug =
        isSharedView && context?.authors?.length > 0
          ? context.authors[0].slug
          : slug;
      const result = await addTextKnowledge(apiSlug, {
        title: "新知識",
        content: "",
        isShared: isSharedView,
      });
      const now = new Date().toISOString();
      const newItem: KnowledgeItem = {
        id: result.id,
        title: "新知識",
        content: "",
        category: "",
        subcategory1: "",
        subcategory2: "",
        subcategory3: "",
        linkText: "",
        linkUrl: "",
        hitCount: 0,
        createdAt: now,
        updatedAt: now,
        authorId: isSharedView ? null : slug,
      };
      setItems((prev) => [newItem, ...prev]);
      setEditingId(result.id);
    } catch (error) {
      console.error("Failed to add knowledge:", error);
      alert("新增失敗");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 搜尋框與新增按鈕 */}
      <div className="px-4 pt-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋知識庫..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#b20a2c]"
            />
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#b20a2c] text-white rounded-xl hover:bg-[#8a0823] transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>新增</span>
          </button>
        </div>
      </div>

      {/* Category Tabs - 換行顯示 */}
      {categoryKeys.length > 1 && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {categoryKeys.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-[#b20a2c] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat === "全部" ? cat : translateCategory(cat)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">載入中...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FileText size={48} className="mb-4 opacity-30" />
              <p>尚無知識庫資料</p>
              <p className="text-sm mt-1">使用下方輸入框新增</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  onEdit={() => setEditingId(item.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={(updates) => handleUpdate(item.id, updates)}
                  onDelete={() => handleDelete(item.id)}
                  allCategories={allCategories}
                  subcategory1Map={subcategory1Map}
                  subcategory2Map={subcategory2Map}
                  subcategory3Map={subcategory3Map}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Knowledge Card with inline editing
function KnowledgeCard({
  item,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  allCategories,
  subcategory1Map,
  subcategory2Map,
  subcategory3Map,
}: {
  item: KnowledgeItem;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: {
    title?: string;
    content?: string;
    category?: string;
    subcategory1?: string;
    subcategory2?: string;
    subcategory3?: string;
    linkText?: string;
    linkUrl?: string;
  }) => void;
  onDelete: () => void;
  allCategories: string[];
  subcategory1Map: Record<string, string[]>;
  subcategory2Map: Record<string, string[]>;
  subcategory3Map: Record<string, string[]>;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || "");
  const [category, setCategory] = useState(item.category || "");
  const [sub1, setSub1] = useState(item.subcategory1 || "");
  const [sub2, setSub2] = useState(item.subcategory2 || "");
  const [sub3, setSub3] = useState(item.subcategory3 || "");
  const [linkText, setLinkText] = useState(item.linkText || "");
  const [linkUrl, setLinkUrl] = useState(item.linkUrl || "");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 自訂輸入模式
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSub1, setIsCustomSub1] = useState(false);
  const [isCustomSub2, setIsCustomSub2] = useState(false);
  const [isCustomSub3, setIsCustomSub3] = useState(false);

  // 取得子分類選項
  const getSub1Options = () => subcategory1Map[category] || [];
  const getSub2Options = () => subcategory2Map[`${category}|${sub1}`] || [];
  const getSub3Options = () =>
    subcategory3Map[`${category}|${sub1}|${sub2}`] || [];

  // Reset form when item changes or editing starts
  useEffect(() => {
    setTitle(item.title);
    setContent(item.content || "");
    setCategory(item.category || "");
    setSub1(item.subcategory1 || "");
    setSub2(item.subcategory2 || "");
    setSub3(item.subcategory3 || "");
    setLinkText(item.linkText || "");
    setLinkUrl(item.linkUrl || "");
  }, [item]);

  // Auto focus title when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditing]);

  // Auto resize textarea
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.height = "auto";
      contentRef.current.style.height = contentRef.current.scrollHeight + "px";
    }
  }, [content, isEditing]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    await onSave({
      title,
      content,
      category: category.trim() || undefined,
      subcategory1: sub1.trim() || undefined,
      subcategory2: sub2.trim() || undefined,
      subcategory3: sub3.trim() || undefined,
      linkText: linkText.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
    });
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      className={`p-4 bg-gray-50 rounded-xl border transition-colors relative group ${
        isEditing
          ? "border-gray-400 ring-2 ring-gray-200"
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Top row: Category tag (left) + Actions (right) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <div className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full overflow-hidden border border-gray-300">
              <span className="pl-2 text-gray-600">
                <Tag size={12} />
              </span>
              {/* 主分類 */}
              {isCustomCategory ? (
                <div className="flex items-center">
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="輸入分類"
                    className="w-20 px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
                    autoFocus
                  />
                  <button
                    onClick={() => setIsCustomCategory(false)}
                    className="px-1 text-gray-500 hover:text-gray-700"
                    title="選擇現有"
                  >
                    ↓
                  </button>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === "__add_new__") {
                      setIsCustomCategory(true);
                      setCategory("");
                    } else {
                      setCategory(e.target.value);
                      setSub1("");
                      setSub2("");
                      setSub3("");
                    }
                  }}
                  className="px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-700 cursor-pointer"
                >
                  <option value="">選擇分類</option>
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {translateCategory(cat)}
                    </option>
                  ))}
                  <option value="__add_new__">+ 新增</option>
                </select>
              )}
              {/* 子分類 1 */}
              {category && (
                <>
                  <span className="text-gray-400">/</span>
                  {isCustomSub1 ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={sub1}
                        onChange={(e) => setSub1(e.target.value)}
                        placeholder="子分類1"
                        className="w-16 px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-600 placeholder-gray-400"
                        autoFocus
                      />
                      <button
                        onClick={() => setIsCustomSub1(false)}
                        className="px-1 text-gray-500 hover:text-gray-700"
                        title="選擇現有"
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <select
                      value={sub1}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          setIsCustomSub1(true);
                          setSub1("");
                        } else {
                          setSub1(e.target.value);
                          setSub2("");
                          setSub3("");
                        }
                      }}
                      className="px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-600 cursor-pointer"
                    >
                      <option value="">無</option>
                      {getSub1Options().map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="__add_new__">+ 新增</option>
                    </select>
                  )}
                </>
              )}
              {/* 子分類 2 */}
              {sub1 && (
                <>
                  <span className="text-gray-400">/</span>
                  {isCustomSub2 ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={sub2}
                        onChange={(e) => setSub2(e.target.value)}
                        placeholder="子分類2"
                        className="w-16 px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-600 placeholder-gray-400"
                        autoFocus
                      />
                      <button
                        onClick={() => setIsCustomSub2(false)}
                        className="px-1 text-gray-500 hover:text-gray-700"
                        title="選擇現有"
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <select
                      value={sub2}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          setIsCustomSub2(true);
                          setSub2("");
                        } else {
                          setSub2(e.target.value);
                          setSub3("");
                        }
                      }}
                      className="px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-600 cursor-pointer"
                    >
                      <option value="">無</option>
                      {getSub2Options().map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="__add_new__">+ 新增</option>
                    </select>
                  )}
                </>
              )}
              {/* 子分類 3 */}
              {sub2 && (
                <>
                  <span className="text-gray-400">/</span>
                  {isCustomSub3 ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={sub3}
                        onChange={(e) => setSub3(e.target.value)}
                        placeholder="子分類3"
                        className="w-16 px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-500 placeholder-gray-400"
                        autoFocus
                      />
                      <button
                        onClick={() => setIsCustomSub3(false)}
                        className="pr-2 text-gray-500 hover:text-gray-700"
                        title="選擇現有"
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <select
                      value={sub3}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          setIsCustomSub3(true);
                          setSub3("");
                        } else {
                          setSub3(e.target.value);
                        }
                      }}
                      className="px-1 py-0.5 text-xs bg-transparent border-none outline-none text-gray-500 cursor-pointer pr-2"
                    >
                      <option value="">無</option>
                      {getSub3Options().map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="__add_new__">+ 新增</option>
                    </select>
                  )}
                </>
              )}
            </div>
          ) : (
            item.category && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                <Tag size={12} />
                {translateCategory(item.category)}
                {item.subcategory1 && (
                  <span className="text-gray-400">/ {item.subcategory1}</span>
                )}
                {item.subcategory2 && (
                  <span className="text-gray-400">/ {item.subcategory2}</span>
                )}
                {item.subcategory3 && (
                  <span className="text-gray-400">/ {item.subcategory3}</span>
                )}
              </span>
            )
          )}
        </div>
        <div
          className={`flex items-center gap-1 transition-opacity ${isEditing ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`}
        >
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim()}
                className="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-[#b20a2c] text-white rounded-lg hover:bg-[#8a0822] transition-colors disabled:opacity-50"
              >
                <Check size={16} />
                {saving ? "儲存中..." : "儲存"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-[#b20a2c] hover:bg-[#fffbd5] rounded-lg transition-colors"
                title="編輯"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="刪除"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      {isEditing ? (
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full font-medium text-gray-800 bg-white px-2 py-1 rounded border border-gray-200 outline-none focus:border-[#b20a2c] transition-all"
          placeholder="標題"
        />
      ) : (
        <h3 className="font-medium text-gray-800">{item.title}</h3>
      )}

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="mt-2 w-full text-sm text-gray-600 bg-white px-2 py-1  rounded border border-gray-200 outline-none focus:border-[#b20a2c] resize-none transition-all"
          placeholder="內容"
        />
      ) : (
        <p className="mt-2 text-sm text-gray-600 line-clamp-3">
          {item.content}
        </p>
      )}

      {/* Link editing */}
      {isEditing && (
        <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 text-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon size={14} className="" />
            <span className="text-xs text-gray-600 font-medium">
              連結按鈕（選填）
            </span>
          </div>
          <div className="flex gap-2 text-gray-600">
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="連結名稱"
              className="flex-1 px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#b20a2c] transition-colors"
            />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://..."
              className="flex-[2] px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#b20a2c] transition-colors"
            />
          </div>
        </div>
      )}

      {/* Link display */}
      {!isEditing && item.linkUrl && (
        <div className="mt-3 flex flex-col">
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#b20a2c] hover:underline"
          >
            <LinkIcon size={14} />
            {item.linkText || "連結"}
          </a>
          <span className="text-xs text-gray-400 mt-0.5 break-all">
            {item.linkUrl}
          </span>
        </div>
      )}

      {/* Footer: hit count + timestamps */}
      {!isEditing && (
        <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Sparkles size={12} />
            {item.hitCount ?? 0} 次命中
          </span>
          <div className="flex items-center gap-3">
            <span>
              建立：
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: zhTW,
              })}
            </span>
            {item.updatedAt !== item.createdAt && (
              <span>
                修改：
                {formatDistanceToNow(new Date(item.updatedAt), {
                  addSuffix: true,
                  locale: zhTW,
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Summary View (AI 整理 + 儀表板) ============

type TimeUnit = "day" | "week" | "month";

interface CategoryStats {
  category: string;
  count: number;
  topics: { topic: string; count: number; isBug?: boolean }[];
}

interface AggregatedStats {
  label: string;
  count: number;
  startDate: Date;
  endDate: Date;
}

function SummaryView({
  slug,
  isSharedView: _isSharedView = false,
}: {
  slug: string;
  isSharedView?: boolean;
}) {
  // _isSharedView 可用於未來擴展顯示所有作者的統計
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyMessageStats[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 日期篩選（使用 Date 類型）
  const [startDateObj, setStartDateObj] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDateObj, setEndDateObj] = useState<Date>(() => new Date());
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("day");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 轉換為 string 格式用於篩選
  const startDate = startDateObj.toISOString().split("T")[0];
  const endDate = endDateObj.toISOString().split("T")[0];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [convData, catData, knowledgeData, statsData] = await Promise.all([
        getConversations(slug),
        getCategories(slug),
        getKnowledgeItems(slug),
        getMessageStats(slug),
      ]);
      setConversations(convData.conversations);
      setCategories(catData.categories);
      setKnowledgeItems(knowledgeData.items);
      setDailyStats(statsData.dailyStats);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 根據日期範圍篩選數據
  const filteredDailyStats = dailyStats.filter((s) => {
    const date = s.date;
    return date >= startDate && date <= endDate;
  });

  // 根據時間維度聚合數據
  const getAggregatedStats = (): AggregatedStats[] => {
    if (filteredDailyStats.length === 0) return [];

    const result: AggregatedStats[] = [];

    if (timeUnit === "day") {
      // 日維度：直接使用每日數據
      filteredDailyStats.forEach((s) => {
        const d = new Date(s.date);
        result.push({
          label: format(d, "MM/dd", { locale: zhTW }),
          count: s.userMessageCount,
          startDate: d,
          endDate: d,
        });
      });
    } else if (timeUnit === "week") {
      // 週維度：按週聚合
      const weekMap: Record<
        string,
        { count: number; startDate: Date; endDate: Date }
      > = {};
      filteredDailyStats.forEach((s) => {
        const d = new Date(s.date);
        // 取得該週的週一
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d);
        weekStart.setDate(diff);
        const weekKey = weekStart.toISOString().split("T")[0];

        if (!weekMap[weekKey]) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weekMap[weekKey] = {
            count: 0,
            startDate: weekStart,
            endDate: weekEnd,
          };
        }
        weekMap[weekKey].count += s.userMessageCount;
      });

      Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([_, data]) => {
          result.push({
            label: `${format(data.startDate, "MM/dd", { locale: zhTW })}`,
            count: data.count,
            startDate: data.startDate,
            endDate: data.endDate,
          });
        });
    } else {
      // 月維度：按月聚合
      const monthMap: Record<
        string,
        { count: number; startDate: Date; endDate: Date }
      > = {};
      filteredDailyStats.forEach((s) => {
        const d = new Date(s.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        if (!monthMap[monthKey]) {
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          monthMap[monthKey] = {
            count: 0,
            startDate: monthStart,
            endDate: monthEnd,
          };
        }
        monthMap[monthKey].count += s.userMessageCount;
      });

      Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([_, data]) => {
          result.push({
            label: format(data.startDate, "yyyy/MM", { locale: zhTW }),
            count: data.count,
            startDate: data.startDate,
            endDate: data.endDate,
          });
        });
    }

    return result;
  };

  const aggregatedStats = getAggregatedStats();
  const filteredTotalMessages = filteredDailyStats.reduce(
    (sum, s) => sum + s.userMessageCount,
    0,
  );
  const filteredConversations = conversations.filter((c) => {
    const date = c.last_message_at.split("T")[0];
    return date >= startDate && date <= endDate;
  });
  const filteredConversationCount = filteredConversations.length;
  const avgQuestions =
    filteredConversationCount > 0
      ? Math.round(filteredTotalMessages / filteredConversationCount)
      : 0;

  // 按知識庫分類統計用戶訊息
  const getCategoryStats = (): CategoryStats[] => {
    // 建立分類映射（從知識庫）
    const categoryMap: Record<
      string,
      {
        count: number;
        topics: Record<string, { count: number; isBug?: boolean }>;
      }
    > = {};

    // 初始化所有知識庫分類
    categories.forEach((cat) => {
      categoryMap[cat] = { count: 0, topics: {} };
    });

    // 加入 "產品bug" 分類
    categoryMap["產品bug"] = { count: 0, topics: {} };
    // 加入 "其他" 分類
    categoryMap["其他"] = { count: 0, topics: {} };

    // 分析對話摘要並分類
    conversations.forEach((conv) => {
      if (!conv.summary) return;

      const summary = conv.summary.toLowerCase();
      let matched = false;

      // 檢查是否是 bug 相關
      const bugKeywords = [
        "bug",
        "問題",
        "錯誤",
        "失敗",
        "無法",
        "壞掉",
        "故障",
        "異常",
        "不能用",
        "出錯",
      ];
      const isBug = bugKeywords.some((keyword) => summary.includes(keyword));

      if (isBug) {
        categoryMap["產品bug"].count += conv.message_count;
        const topic = conv.summary.slice(0, 40);
        if (!categoryMap["產品bug"].topics[topic]) {
          categoryMap["產品bug"].topics[topic] = { count: 0, isBug: true };
        }
        categoryMap["產品bug"].topics[topic].count += 1;
        matched = true;
      }

      // 嘗試匹配知識庫分類
      if (!matched) {
        for (const cat of categories) {
          const catLower = cat.toLowerCase();
          // 使用知識庫的標題和內容來匹配
          const relatedKnowledge = knowledgeItems.filter(
            (k) => k.category === cat,
          );
          const keywords = relatedKnowledge
            .flatMap((k) => [
              k.title?.toLowerCase() || "",
              ...(k.subcategory1?.toLowerCase().split(/\s+/) || []),
            ])
            .filter(Boolean);

          if (
            keywords.some((kw) => kw && summary.includes(kw)) ||
            summary.includes(catLower)
          ) {
            categoryMap[cat].count += conv.message_count;
            const topic = conv.summary.slice(0, 40);
            if (!categoryMap[cat].topics[topic]) {
              categoryMap[cat].topics[topic] = { count: 0 };
            }
            categoryMap[cat].topics[topic].count += 1;
            matched = true;
            break;
          }
        }
      }

      // 未匹配的歸入其他
      if (!matched) {
        categoryMap["其他"].count += conv.message_count;
        const topic = conv.summary.slice(0, 40);
        if (!categoryMap["其他"].topics[topic]) {
          categoryMap["其他"].topics[topic] = { count: 0 };
        }
        categoryMap["其他"].topics[topic].count += 1;
      }
    });

    // 轉換為陣列並排序
    return Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        count: data.count,
        topics: Object.entries(data.topics)
          .map(([topic, info]) => ({ topic, ...info }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => {
        // 產品bug 置頂
        if (a.category === "產品bug") return -1;
        if (b.category === "產品bug") return 1;
        return b.count - a.count;
      });
  };

  const categoryStats = getCategoryStats();

  // 設定預設選中的分類
  useEffect(() => {
    if (categoryStats.length > 0 && !activeCategory) {
      setActiveCategory(categoryStats[0].category);
    }
  }, [categoryStats.length]);

  // 發送 Bug 通知
  const handleNotifyBug = async (topic: string) => {
    try {
      await notifyBugToWebhook(slug, {
        title: topic,
        content: `用戶反映的問題：${topic}`,
        category: "產品bug",
      });
      alert("已發送通知給 PM！");
    } catch (error) {
      console.error("Failed to send notification:", error);
      alert("發送通知失敗");
    }
  };

  const maxQuestions = Math.max(...aggregatedStats.map((s) => s.count), 1);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#b20a2c]" />
              數據分析
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              對話統計與用戶問題分析
            </p>
          </div>

          {/* 篩選器 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 日期範圍選擇 */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white"
              >
                <Calendar size={16} />
                <span>
                  {format(new Date(startDate), "yyyy/MM/dd")} -{" "}
                  {format(new Date(endDate), "yyyy/MM/dd")}
                </span>
                <ChevronDown size={16} />
              </button>

              {showDatePicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDatePicker(false)}
                  />
                  <DateRangePicker
                    startDate={startDateObj}
                    endDate={endDateObj}
                    onChange={(start, end) => {
                      if (start) setStartDateObj(start);
                      if (end) setEndDateObj(end);
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                </>
              )}
            </div>

            {/* 時間維度 */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["day", "week", "month"] as TimeUnit[]).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setTimeUnit(unit)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    timeUnit === unit
                      ? "bg-[#b20a2c] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {unit === "day" ? "日" : unit === "week" ? "週" : "月"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#b20a2c] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">載入數據中...</p>
            </div>
          </div>
        ) : (
          <div className={`${isMobile ? "space-y-6" : "flex gap-6"}`}>
            {/* 左側：總計 + 長條圖 */}
            <div className={`${isMobile ? "" : "flex-1"} space-y-6`}>
              {/* 統計卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-[#fffbd5] rounded-xl border border-[#b20a2c]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={16} className="text-[#b20a2c]" />
                    <span className="text-xs text-gray-600">總訊息數</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {filteredTotalMessages}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} className="text-gray-600" />
                    <span className="text-xs text-gray-600">總對話數</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {filteredConversationCount}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-gray-600" />
                    <span className="text-xs text-gray-600">平均訊息</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {avgQuestions}
                  </p>
                </div>
              </div>

              {/* 長條圖（可左右滑動） */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="font-medium text-gray-800 mb-4">
                  訊息數量趨勢
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    （按
                    {timeUnit === "day"
                      ? "日"
                      : timeUnit === "week"
                        ? "週"
                        : "月"}
                    ）
                  </span>
                </h3>
                {aggregatedStats.length > 0 ? (
                  <div ref={chartContainerRef} className="overflow-x-auto pb-2">
                    <div
                      className="h-48 flex items-end gap-1"
                      style={{
                        minWidth: `${Math.max(aggregatedStats.length * 50, 300)}px`,
                      }}
                    >
                      {aggregatedStats.map((s, index) => (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center min-w-[40px]"
                        >
                          <span className="text-xs text-gray-500 mb-1">
                            {s.count > 0 ? s.count : ""}
                          </span>
                          <div
                            className="w-full rounded-t transition-all hover:opacity-80 cursor-pointer"
                            style={{
                              height: `${Math.max((s.count / maxQuestions) * 140, s.count > 0 ? 4 : 0)}px`,
                              background:
                                "linear-gradient(to top, #b20a2c, #e53e3e)",
                              minHeight: s.count > 0 ? "4px" : "0",
                            }}
                            title={`${s.label}: ${s.count} 則訊息`}
                          />
                          <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    <p>尚無數據</p>
                  </div>
                )}
                {dailyStats.length > 5 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    ← 左右滑動查看更多 →
                  </p>
                )}
              </div>
            </div>

            {/* 右側：按分類的用戶常見訊息（使用知識庫相同的 Tab 風格） */}
            <div
              className={`${isMobile ? "" : "w-[400px]"} flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden`}
            >
              {/* 分類 Tabs */}
              <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categoryStats.map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => setActiveCategory(cat.category)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        activeCategory === cat.category
                          ? cat.category === "產品bug"
                            ? "bg-red-500 text-white"
                            : "bg-[#b20a2c] text-white"
                          : cat.category === "產品bug"
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.category === "產品bug" && "🐛 "}
                      {cat.category}
                      <span className="ml-1 text-xs opacity-75">
                        ({cat.count})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 該分類下的內容 */}
              <div className="flex-1 overflow-y-auto p-4">
                {categoryStats.length > 0 ? (
                  <div className="space-y-3">
                    {categoryStats
                      .find((c) => c.category === activeCategory)
                      ?.topics.map((topic, topicIndex) => (
                        <div
                          key={topicIndex}
                          className={`p-4 rounded-xl border ${
                            topic.isBug
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-100"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                topic.isBug
                                  ? "bg-red-500 text-white"
                                  : "bg-[#b20a2c] text-white"
                              }`}
                            >
                              {topicIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${topic.isBug ? "text-red-700" : "text-gray-800"}`}
                              >
                                {topic.topic}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500">
                                  {topic.count} 次提問
                                </span>
                                {topic.isBug && (
                                  <button
                                    onClick={() => handleNotifyBug(topic.topic)}
                                    className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                  >
                                    通知PM
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )) || (
                      <div className="text-center text-gray-400 py-8">
                        <p>此分類暫無數據</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <Sparkles size={36} className="mb-3 opacity-30" />
                    <p>尚無分類數據</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthorDashboard;
