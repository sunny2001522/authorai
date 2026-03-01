import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, BookOpen } from 'lucide-react';
import { ConversationList } from '../components/conversations/ConversationList';
import { ConversationDetail } from '../components/conversations/ConversationDetail';
import { KnowledgeList } from '../components/knowledge/KnowledgeList';

type Tab = 'conversations' | 'knowledge';

export function DashboardPage() {
  const { adminKey, convId } = useParams<{ adminKey: string; convId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab from URL
  const getActiveTab = (): Tab => {
    if (location.pathname.includes('/knowledge')) return 'knowledge';
    return 'conversations';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getActiveTab());

  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'conversations') {
      navigate(`/dashboard/${adminKey}/conversations`);
    } else {
      navigate(`/dashboard/${adminKey}/knowledge`);
    }
  };

  if (!adminKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">無效的連結</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <header className="border-b border-white/10 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <span className="text-gold font-bold">AI</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">AI 助手管理後台</h1>
                <p className="text-xs text-gray-500">管理對話記錄與知識庫</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleTabChange('conversations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'conversations'
                ? 'bg-gold text-dark'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            對話記錄
          </button>
          <button
            onClick={() => handleTabChange('knowledge')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'knowledge'
                ? 'bg-gold text-dark'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            知識庫管理
          </button>
        </div>

        {/* Content */}
        <div className="card p-6">
          {activeTab === 'conversations' ? (
            convId ? (
              <ConversationDetail adminKey={adminKey} convId={convId} />
            ) : (
              <ConversationList adminKey={adminKey} />
            )
          ) : (
            <KnowledgeList adminKey={adminKey} />
          )}
        </div>
      </div>
    </div>
  );
}
