import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { MessageSquare, Search, Trash2, ChevronRight } from 'lucide-react';
import { getConversations, deleteConversation, Conversation } from '../../services/api';

interface ConversationListProps {
  adminKey: string;
}

export function ConversationList({ adminKey }: ConversationListProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await getConversations(adminKey);
      setConversations(data.conversations);
    } catch (err) {
      setError('無法載入對話記錄');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [adminKey]);

  const handleDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('確定要刪除此對話嗎？')) return;

    try {
      await deleteConversation(adminKey, convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
    } catch (err) {
      alert('刪除失敗');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.session_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <button onClick={loadConversations} className="btn-secondary mt-4">
          重試
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">對話記錄</h2>
        <span className="text-sm text-gray-400">
          共 {conversations.length} 筆對話
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="搜尋對話..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full pl-10"
        />
      </div>

      {/* List */}
      {filteredConversations.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchQuery ? '找不到符合的對話' : '目前沒有對話記錄'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => navigate(`/dashboard/${adminKey}/conversations/${conv.id}`)}
              className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {conv.summary || '新對話'}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>
                      {formatDistanceToNow(new Date(conv.last_message_at), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </span>
                    <span>•</span>
                    <span>{conv.message_count} 則訊息</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
