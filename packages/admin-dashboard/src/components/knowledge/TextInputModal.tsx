import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Link as LinkIcon, Sparkles, Loader2 } from 'lucide-react';
import { addTextKnowledge, getCategories, processKnowledgeWithAI } from '../../services/api';

interface TextInputModalProps {
  adminKey: string;
  onClose: () => void;
  onSaved: () => void;
}

// 可編輯的下拉選單組件
function EditableSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);

  return (
    <div className="relative">
      {isCustom ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input flex-1"
            autoFocus
          />
          <button
            onClick={() => setIsCustom(false)}
            className="btn-secondary px-3"
            title="選擇現有"
          >
            ↓
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input flex-1 bg-dark-card"
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsCustom(true)}
            className="btn-secondary px-3"
            title="新增"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function TextInputModal({ adminKey, onClose, onSaved }: TextInputModalProps) {
  // 原始輸入
  const [rawContent, setRawContent] = useState('');

  // AI 處理狀態
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiProcessed, setAiProcessed] = useState(false);

  // 編輯狀態（單個項目或多個項目）
  const [editingItems, setEditingItems] = useState<Array<{
    title: string;
    content: string;
    category: string;
    subcategory1: string;
    linkText: string;
    linkUrl: string;
  }>>([]);

  const [isShared, setIsShared] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategory1Map, setSubcategory1Map] = useState<Record<string, string[]>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入分類選項
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories(adminKey);
        setCategories(data.categories);
        setSubcategory1Map(data.subcategory1Map);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, [adminKey]);

  // AI 處理內容
  const handleAIProcess = useCallback(async () => {
    if (!rawContent.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await processKnowledgeWithAI(adminKey, rawContent);

      if (result.success && result.items.length > 0) {
        setEditingItems(result.items.map(item => ({
          title: item.title,
          content: item.content,
          category: item.category,
          subcategory1: item.sub_category || '',
          linkText: '',
          linkUrl: '',
        })));
        setAiProcessed(true);
      }
    } catch (err) {
      console.error('AI processing failed:', err);
      setError('AI 處理失敗，請手動填寫');
    } finally {
      setIsProcessing(false);
    }
  }, [adminKey, rawContent]);

  // 輸入後自動觸發 AI 處理（防抖）
  useEffect(() => {
    if (!rawContent.trim() || aiProcessed) return;

    const timer = setTimeout(() => {
      if (rawContent.trim().length >= 10) {
        handleAIProcess();
      }
    }, 1500); // 1.5秒後自動處理

    return () => clearTimeout(timer);
  }, [rawContent, aiProcessed, handleAIProcess]);

  // 更新單個項目
  const updateItem = (index: number, field: string, value: string) => {
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // 刪除項目
  const removeItem = (index: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index));
  };

  // 儲存所有項目
  const handleSave = async () => {
    const validItems = editingItems.filter(item => item.title.trim() && item.content.trim());

    if (validItems.length === 0) {
      setError('請至少填寫一筆有效的知識');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // 逐一儲存
      for (const item of validItems) {
        await addTextKnowledge(adminKey, {
          title: item.title.trim(),
          content: item.content.trim(),
          category: item.category || undefined,
          subcategory1: item.subcategory1 || undefined,
          linkText: item.linkText.trim() || undefined,
          linkUrl: item.linkUrl.trim() || undefined,
          isShared,
        });
      }

      onSaved();
    } catch (err) {
      setError('儲存失敗，請稍後再試');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // 重置，重新輸入
  const handleReset = () => {
    setAiProcessed(false);
    setEditingItems([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-card border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#b20a2c]" />
            <h3 className="text-lg font-semibold text-white">AI 智能新增知識</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {!aiProcessed ? (
            // 步驟 1：輸入原始內容
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  輸入知識內容
                  <span className="text-gray-500 font-normal ml-2">
                    （AI 將自動整理標題、分類，並判斷是否需要拆分）
                  </span>
                </label>
                <textarea
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="直接貼上或輸入你的知識內容，AI 會自動幫你整理...&#10;&#10;例如：&#10;Q: 如何報名體驗課？&#10;A: 可以點擊下方連結報名，體驗課完全免費..."
                  rows={12}
                  className="textarea w-full"
                  disabled={isProcessing}
                />
              </div>

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-4 text-[#b20a2c]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI 正在分析整理中...</span>
                </div>
              )}

              {/* 歸屬選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  歸屬
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ownership"
                      checked={!isShared}
                      onChange={() => setIsShared(false)}
                      className="w-4 h-4 text-[#b20a2c] bg-dark-card border-gray-600 focus:ring-[#b20a2c]"
                    />
                    <span className="text-white">老師專屬</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ownership"
                      checked={isShared}
                      onChange={() => setIsShared(true)}
                      className="w-4 h-4 text-gray-500 bg-dark-card border-gray-600 focus:ring-gray-500"
                    />
                    <span className="text-white">共用知識</span>
                    <span className="text-xs text-gray-500">（所有老師都可見）</span>
                  </label>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </div>
          ) : (
            // 步驟 2：顯示 AI 處理結果
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-300">
                  AI 整理完成，共 <span className="text-[#b20a2c] font-semibold">{editingItems.length}</span> 筆知識
                </p>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  重新輸入
                </button>
              </div>

              {/* 顯示每個整理後的項目 */}
              <div className="space-y-4">
                {editingItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 bg-[#b20a2c]/20 text-[#b20a2c] text-xs rounded">
                        #{index + 1}
                      </span>
                      {editingItems.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="text-gray-400 hover:text-red-400 text-xs"
                        >
                          移除
                        </button>
                      )}
                    </div>

                    {/* 分類 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">分類</label>
                        <EditableSelect
                          value={item.category}
                          options={categories}
                          placeholder="選擇分類"
                          onChange={(v) => updateItem(index, 'category', v)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">子分類</label>
                        <EditableSelect
                          value={item.subcategory1}
                          options={subcategory1Map[item.category] || []}
                          placeholder="選擇子分類"
                          onChange={(v) => updateItem(index, 'subcategory1', v)}
                        />
                      </div>
                    </div>

                    {/* 標題 */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">標題</label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(index, 'title', e.target.value)}
                        className="input w-full"
                      />
                    </div>

                    {/* 內容 */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">內容</label>
                      <textarea
                        value={item.content}
                        onChange={(e) => updateItem(index, 'content', e.target.value)}
                        rows={3}
                        className="textarea w-full"
                      />
                    </div>

                    {/* 連結 */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">連結按鈕（可選）</label>
                      <div className="flex gap-2 items-center">
                        <LinkIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <input
                          type="text"
                          value={item.linkText}
                          onChange={(e) => updateItem(index, 'linkText', e.target.value)}
                          placeholder="按鈕文字"
                          className="input flex-1"
                        />
                        <input
                          type="url"
                          value={item.linkUrl}
                          onChange={(e) => updateItem(index, 'linkUrl', e.target.value)}
                          placeholder="https://..."
                          className="input flex-[2]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          {!aiProcessed ? (
            <button
              onClick={handleAIProcess}
              disabled={isProcessing || !rawContent.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 整理
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || editingItems.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '儲存中...' : `儲存 ${editingItems.length} 筆知識`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
