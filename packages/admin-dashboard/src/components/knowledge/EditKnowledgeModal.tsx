import { useState, useEffect } from 'react';
import { X, Plus, Link as LinkIcon } from 'lucide-react';
import { updateKnowledge, getCategories, KnowledgeItem } from '../../services/api';

interface EditKnowledgeModalProps {
  adminKey: string;
  item: KnowledgeItem;
  onClose: () => void;
  onSaved: () => void;
}

// 可編輯的下拉選單組件（與 TextInputModal 一致）
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
  // 判斷當前值是否為自訂值（不在選項列表中且非空）
  const isCustomValue = value && !options.includes(value);
  const [isCustom, setIsCustom] = useState(isCustomValue);

  // 當值變化時，更新 isCustom 狀態
  useEffect(() => {
    if (value && !options.includes(value)) {
      setIsCustom(true);
    }
  }, [value, options]);

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
            onClick={() => {
              setIsCustom(false);
              // 如果當前值不在選項中，清空它
              if (!options.includes(value)) {
                onChange('');
              }
            }}
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

export function EditKnowledgeModal({ adminKey, item, onClose, onSaved }: EditKnowledgeModalProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || '');
  const [category, setCategory] = useState(item.category || '');
  const [subcategory1, setSubcategory1] = useState(item.subcategory1 || '');
  const [subcategory2, setSubcategory2] = useState(item.subcategory2 || '');
  const [subcategory3, setSubcategory3] = useState(item.subcategory3 || '');
  const [linkText, setLinkText] = useState(item.linkText || '');
  const [linkUrl, setLinkUrl] = useState(item.linkUrl || '');

  const [categories, setCategories] = useState<string[]>([]);
  const [subcategory1Map, setSubcategory1Map] = useState<Record<string, string[]>>({});
  const [subcategory2Map, setSubcategory2Map] = useState<Record<string, string[]>>({});
  const [subcategory3Map, setSubcategory3Map] = useState<Record<string, string[]>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入分類選項
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories(adminKey);
        setCategories(data.categories);
        setSubcategory1Map(data.subcategory1Map);
        setSubcategory2Map(data.subcategory2Map);
        setSubcategory3Map(data.subcategory3Map);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, [adminKey]);

  // 取得子分類選項
  const getSubcategory1Options = () => subcategory1Map[category] || [];
  const getSubcategory2Options = () => subcategory2Map[`${category}|${subcategory1}`] || [];
  const getSubcategory3Options = () => subcategory3Map[`${category}|${subcategory1}|${subcategory2}`] || [];

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('請填寫標題和內容');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateKnowledge(adminKey, item.id, {
        title: title.trim(),
        content: content.trim(),
        category: category || undefined,
        subcategory1: subcategory1 || undefined,
        subcategory2: subcategory2 || undefined,
        subcategory3: subcategory3 || undefined,
        linkText: linkText.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError('儲存失敗，請稍後再試');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-card border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">編輯知識</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 分類 - 四層 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                類別
              </label>
              <EditableSelect
                value={category}
                options={categories}
                placeholder="選擇或新增類別"
                onChange={setCategory}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                子類別 1
              </label>
              <EditableSelect
                value={subcategory1}
                options={getSubcategory1Options()}
                placeholder="選擇或新增"
                onChange={setSubcategory1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                子類別 2
              </label>
              <EditableSelect
                value={subcategory2}
                options={getSubcategory2Options()}
                placeholder="選擇或新增"
                onChange={setSubcategory2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                子類別 3
              </label>
              <EditableSelect
                value={subcategory3}
                options={getSubcategory3Options()}
                placeholder="選擇或新增"
                onChange={setSubcategory3}
              />
            </div>
          </div>

          {/* 標題 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              標題（問題）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：如何報名體驗課？"
              className="input w-full"
            />
          </div>

          {/* 內容 */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              內容（回答）
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="輸入回答內容..."
              rows={6}
              className="textarea w-full"
            />
          </div>

          {/* 連結 - 更明顯的樣式 */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-3">
              <LinkIcon className="w-4 h-4" />
              連結按鈕（選填）
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">按鈕文字</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="例：前往報名、聯絡客服、查看更多"
                  className="input w-full border-amber-500/30 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">連結網址</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="input w-full border-amber-500/30 focus:border-amber-500"
                />
              </div>
              {linkText && linkUrl && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <span>✓</span>
                  <span>預覽：用戶會看到「{linkText}」按鈕</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>
    </div>
  );
}
