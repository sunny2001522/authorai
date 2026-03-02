import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, User, Bot, Send, Link as LinkIcon, X } from 'lucide-react';
import { getConversation, sendAdminReply, ConversationDetail as ConvDetail } from '../../services/api';

interface ConversationDetailProps {
  adminKey: string;
  convId: string;
}

export function ConversationDetail({ adminKey, convId }: ConversationDetailProps) {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ConvDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getConversation(adminKey, convId);
        setConversation(data);
      } catch (err) {
        setError('無法載入對話');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [adminKey, convId]);

  // 發送管理員回覆
  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      await sendAdminReply(adminKey, convId, replyText.trim());
      setReplyText('');
      // 重新載入對話
      const data = await getConversation(adminKey, convId);
      setConversation(data);
      // 滾動到底部
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert('發送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  // 插入連結到文字
  const handleInsertLink = () => {
    if (linkText && linkUrl) {
      const linkMarkdown = `[${linkText}](${linkUrl})`;
      setReplyText(prev => prev + linkMarkdown);
      setLinkText('');
      setLinkUrl('');
      setShowLinkPopover(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error || '對話不存在'}</p>
        <button
          onClick={() => navigate(`/dashboard/${adminKey}/conversations`)}
          className="btn-secondary mt-4"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
        <button
          onClick={() => navigate(`/dashboard/${adminKey}/conversations`)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white">
            對話詳情
          </h2>
          <p className="text-sm text-gray-500">
            {conversation.messages.length} 則訊息
          </p>
        </div>
      </div>

      {/* Messages - 用戶（學員）在左邊，助理/管理員在右邊 */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto mb-4">
        {conversation.messages.map(message => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? '' : 'flex-row-reverse'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-blue-500/20'
                  : 'bg-[#b20a2c]/20'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-blue-400" />
              ) : (
                <Bot className="w-4 h-4 text-[#b20a2c]" />
              )}
            </div>
            <div
              className={`max-w-[75%] ${
                message.role === 'user' ? '' : 'text-right'
              }`}
            >
              {/* 標籤：學員 or 助理/管理員 */}
              <p className={`text-xs mb-1 ${message.role === 'user' ? 'text-blue-400' : 'text-[#b20a2c]'}`}>
                {message.role === 'user' ? '學員' : (message.isAdminReply ? '管理員回覆' : 'AI 助理')}
              </p>
              <div
                className={`inline-block p-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/20 rounded-bl-sm'
                    : 'bg-[#b20a2c]/20 border border-[#b20a2c]/30 rounded-br-sm'
                }`}
              >
                <p className="text-sm text-gray-200 whitespace-pre-wrap text-left">
                  {message.content}
                </p>
                {/* 顯示連結按鈕（如果有） */}
                {message.linkText && message.linkUrl && (
                  <a
                    href={message.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-start mt-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs hover:bg-white/20 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <LinkIcon className="w-3 h-3" />
                      {message.linkText}
                    </span>
                    <span className="text-gray-400 text-[10px] mt-0.5 break-all">
                      {message.linkUrl}
                    </span>
                  </a>
                )}
              </div>
              <p className={`text-xs text-gray-600 mt-1 px-1 ${message.role === 'user' ? '' : 'text-right'}`}>
                {format(new Date(message.created_at), 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 回應學員與粉絲 */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm text-gray-400 mb-3">回應學員與粉絲</p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="輸入要回覆給學員的訊息..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#b20a2c]/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
            />
            {/* 添加連結按鈕 */}
            <div className="absolute bottom-2 left-2">
              <button
                onClick={() => setShowLinkPopover(!showLinkPopover)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-[#b20a2c] hover:bg-white/10 transition-colors"
                title="添加連結"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              {/* 連結輸入彈窗 */}
              {showLinkPopover && (
                <div className="absolute bottom-full left-0 mb-2 p-3 bg-gray-800 border border-white/10 rounded-xl shadow-xl w-64 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">添加連結</span>
                    <button
                      onClick={() => setShowLinkPopover(false)}
                      className="p-1 text-gray-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="連結文字（例：點此報名）"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 mb-2 focus:outline-none focus:border-[#b20a2c]/50"
                  />
                  <button
                    onClick={handleInsertLink}
                    disabled={!linkText || !linkUrl}
                    className="w-full py-2 bg-[#b20a2c] text-white text-sm rounded-lg hover:bg-[#8a0823] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    插入連結
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || sending}
            className="px-4 rounded-xl bg-[#b20a2c] hover:bg-[#8a0823] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="發送訊息給學員"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {sending ? '發送中...' : '此訊息將即時推送給學員 • Enter 發送，Shift+Enter 換行'}
        </p>
      </div>
    </div>
  );
}
