import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { FileText, Mic, Plus, Trash2, Edit2, Link as LinkIcon, Users, Sparkles } from 'lucide-react';
import { getKnowledgeItems, deleteKnowledge, KnowledgeItem } from '../../services/api';
import { TextInputModal } from './TextInputModal';
import { AudioRecorderModal } from './AudioRecorderModal';
import { EditKnowledgeModal } from './EditKnowledgeModal';

interface KnowledgeListProps {
  adminKey: string;
}

// 麵包屑組件：用斜線分隔分類
function Breadcrumb({ item }: { item: KnowledgeItem }) {
  const parts = [
    item.category,
    item.subcategory1,
    item.subcategory2,
    item.subcategory3,
  ].filter(Boolean);

  if (parts.length === 0) {
    return <span className="text-gray-500">未分類</span>;
  }

  return (
    <span className="text-sm text-gray-400">
      {parts.join(' / ')}
    </span>
  );
}

export function KnowledgeList({ adminKey }: KnowledgeListProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await getKnowledgeItems(adminKey);
      setItems(data.items);
    } catch (err) {
      setError('無法載入知識庫');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [adminKey]);

  const handleDelete = async (itemId: string) => {
    if (!confirm('確定要刪除此知識嗎？')) return;

    try {
      await deleteKnowledge(adminKey, itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      alert('刪除失敗');
    }
  };

  const handleTextSaved = () => {
    setShowTextModal(false);
    loadItems();
  };

  const handleAudioSaved = () => {
    setShowAudioModal(false);
    loadItems();
  };

  const handleEditSaved = () => {
    setEditingItem(null);
    loadItems();
  };

  // 計算共用和專屬知識數量
  const sharedCount = items.filter(item => !item.authorId).length;
  const ownCount = items.filter(item => item.authorId).length;

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
        <button onClick={loadItems} className="btn-secondary mt-4">
          重試
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">知識庫管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {items.length} 筆（專屬 {ownCount} + 共用 {sharedCount}）
          </p>
        </div>
      </div>

      {/* Add buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowTextModal(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          文字輸入
        </button>
        <button
          onClick={() => setShowAudioModal(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Mic className="w-4 h-4" />
          錄音輸入
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">知識庫是空的</p>
          <p className="text-gray-500 text-sm mt-2">
            點擊上方按鈕新增知識
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  {item.authorId ? (
                    <FileText className="w-5 h-5 text-[#b20a2c]" />
                  ) : (
                    <Users className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {/* 麵包屑分類 */}
                  <div className="mb-1 flex items-center gap-2">
                    <Breadcrumb item={item} />
                    {!item.authorId && (
                      <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">共用</span>
                    )}
                  </div>
                  {/* 標題 */}
                  <p className="text-white font-medium truncate">{item.title}</p>
                  {/* 詳細資訊 */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    {item.linkUrl && (
                      <>
                        <span className="flex flex-col">
                          <span className="flex items-center gap-1 text-gold">
                            <LinkIcon className="w-3 h-3" />
                            {item.linkText || '連結'}
                          </span>
                          <span className="text-gray-500 text-[10px] truncate max-w-[200px]" title={item.linkUrl}>
                            {item.linkUrl}
                          </span>
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#b20a2c]/70" />
                      {item.hitCount ?? 0} 次命中
                    </span>
                    <span>•</span>
                    <span>
                      {format(new Date(item.createdAt), 'yyyy/MM/dd', { locale: zhTW })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingItem(item)}
                  className="p-2 rounded-lg text-gray-500 hover:text-gold hover:bg-gold/10 transition-colors"
                  title="編輯"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showTextModal && (
        <TextInputModal
          adminKey={adminKey}
          onClose={() => setShowTextModal(false)}
          onSaved={handleTextSaved}
        />
      )}

      {showAudioModal && (
        <AudioRecorderModal
          adminKey={adminKey}
          onClose={() => setShowAudioModal(false)}
          onSaved={handleAudioSaved}
        />
      )}

      {editingItem && (
        <EditKnowledgeModal
          adminKey={adminKey}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}
