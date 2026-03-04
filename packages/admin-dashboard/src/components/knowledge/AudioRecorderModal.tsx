import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Mic, Square, Loader2, Sparkles, Plus, Link as LinkIcon } from 'lucide-react';
import { addTextKnowledge, transcribeAudio, getCategories, processKnowledgeWithAI } from '../../services/api';

interface AudioRecorderModalProps {
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

// 即時轉錄間隔（毫秒）
const TRANSCRIBE_INTERVAL = 3000;

export function AudioRecorderModal({ adminKey, onClose, onSaved }: AudioRecorderModalProps) {
  // 錄音狀態
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // 即時轉錄狀態
  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingText, setPendingText] = useState(''); // 正在處理中的文字

  // AI 處理狀態
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiProcessed, setAiProcessed] = useState(false);
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
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for real-time transcription
  const allChunksRef = useRef<Blob[]>([]); // 累積所有音訊片段
  const lastTranscribedIndexRef = useRef<number>(0); // 上次已轉錄的片段索引
  const transcribeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTranscribingRef = useRef<boolean>(false); // 防止同時多個轉錄請求

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 載入分類選項
  const loadCategories = useCallback(async () => {
    if (categoriesLoaded) return;
    try {
      const data = await getCategories(adminKey);
      setCategories(data.categories);
      setSubcategory1Map(data.subcategory1Map);
      setCategoriesLoaded(true);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, [adminKey, categoriesLoaded]);

  // 即時轉錄：將累積的音訊片段發送到 Whisper
  const transcribeCurrentChunks = useCallback(async () => {
    // 防止同時多個轉錄請求
    if (isTranscribingRef.current) return;

    const chunks = allChunksRef.current;
    if (chunks.length === 0) return;

    // 沒有新的片段，跳過
    if (chunks.length <= lastTranscribedIndexRef.current) return;

    isTranscribingRef.current = true;
    setIsTranscribing(true);

    try {
      // 將所有累積的音訊合併成一個 blob
      const blob = new Blob(chunks, { type: 'audio/webm' });

      const result = await transcribeAudio(blob);
      if (result.success && result.text) {
        setTranscribedText(result.text);
        lastTranscribedIndexRef.current = chunks.length;
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      isTranscribingRef.current = false;
      setIsTranscribing(false);
    }
  }, []);

  // 開始錄音
  const startRecording = async () => {
    try {
      setError(null);
      setTranscribedText('');
      setPendingText('');
      allChunksRef.current = [];
      lastTranscribedIndexRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          allChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        // 停止即時轉錄定時器
        if (transcribeIntervalRef.current) {
          clearInterval(transcribeIntervalRef.current);
          transcribeIntervalRef.current = null;
        }

        // 最後一次完整轉錄
        await finalTranscribe();
      };

      // 每秒收集一次音訊片段
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // 計時器
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // 即時轉錄定時器：每 3 秒轉錄一次
      transcribeIntervalRef.current = setInterval(() => {
        transcribeCurrentChunks();
      }, TRANSCRIBE_INTERVAL);

    } catch (err) {
      setError('無法存取麥克風，請確認已授權麥克風權限');
      console.error(err);
    }
  };

  // 停止錄音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // 最終完整轉錄（停止錄音後）
  const finalTranscribe = async () => {
    const chunks = allChunksRef.current;
    if (chunks.length === 0) {
      setError('沒有錄到任何音訊');
      return;
    }

    setIsTranscribing(true);
    setPendingText('正在完成最終轉錄...');

    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const result = await transcribeAudio(blob);

      if (result.success && result.text) {
        setTranscribedText(result.text);
        // 轉錄成功後自動觸發 AI 處理
        await handleAIProcess(result.text);
      } else {
        setError('語音轉文字失敗，請重新錄製');
      }
    } catch (err) {
      setError('語音轉文字失敗，請稍後再試');
      console.error(err);
    } finally {
      setIsTranscribing(false);
      setPendingText('');
    }
  };

  // AI 處理內容
  const handleAIProcess = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // 同時載入分類選項
      await loadCategories();

      const result = await processKnowledgeWithAI(adminKey, text);

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
      } else {
        // AI 處理失敗，使用原始文字
        setEditingItems([{
          title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
          content: text,
          category: '',
          subcategory1: '',
          linkText: '',
          linkUrl: '',
        }]);
        setAiProcessed(true);
      }
    } catch (err) {
      console.error('AI processing failed:', err);
      // AI 處理失敗，使用原始文字
      setEditingItems([{
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        content: text,
        category: '',
        subcategory1: '',
        linkText: '',
        linkUrl: '',
      }]);
      setAiProcessed(true);
    } finally {
      setIsProcessing(false);
    }
  };

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

  // 重置，重新錄音
  const handleReset = () => {
    setTranscribedText('');
    setPendingText('');
    setAiProcessed(false);
    setEditingItems([]);
    setRecordingTime(0);
    allChunksRef.current = [];
    lastTranscribedIndexRef.current = 0;
  };

  // 清理定時器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transcribeIntervalRef.current) clearInterval(transcribeIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
            <Mic className="w-5 h-5 text-[#b20a2c]" />
            <h3 className="text-lg font-semibold text-white">語音智能輸入</h3>
            <span className="text-xs text-gray-500">（即時轉錄）</span>
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
            // 步驟 1：錄音 + 即時轉錄
            <div className="space-y-6">
              {/* 錄音區域 */}
              <div className="flex flex-col items-center py-6 bg-white/5 rounded-xl">
                <div className="text-4xl font-mono mb-4 text-white">
                  {isRecording && (
                    <span className="text-red-500 animate-pulse mr-2">●</span>
                  )}
                  {formatTime(recordingTime)}
                </div>

                {/* 波形動畫 */}
                {isRecording && (
                  <div className="flex items-center gap-1 h-12 mb-4">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-500 rounded-full animate-pulse"
                        style={{
                          height: `${20 + Math.random() * 30}px`,
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* 錄音按鈕 */}
                <div className="flex gap-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isTranscribing || isProcessing}
                      className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Mic className="w-8 h-8 text-white" />
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors animate-pulse"
                    >
                      <Square className="w-8 h-8 text-white" />
                    </button>
                  )}
                </div>

                {!isRecording && !isTranscribing && !isProcessing && !transcribedText && (
                  <p className="mt-4 text-sm text-gray-400">
                    點擊開始錄音，邊說邊即時轉錄
                  </p>
                )}
              </div>

              {/* 即時轉錄結果顯示區 */}
              <div className="min-h-[120px] p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">即時轉錄結果</span>
                  {isTranscribing && (
                    <Loader2 className="w-3 h-3 animate-spin text-[#b20a2c]" />
                  )}
                </div>
                <p className="text-white whitespace-pre-wrap">
                  {transcribedText || (
                    <span className="text-gray-500 italic">
                      {isRecording ? '正在聆聽...' : '尚未開始錄音'}
                    </span>
                  )}
                  {pendingText && (
                    <span className="text-gray-400 ml-1">{pendingText}</span>
                  )}
                </p>
              </div>

              {/* 處理中提示 */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-4 text-[#b20a2c]">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>AI 正在整理分類中...</span>
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
                  重新錄音
                </button>
              </div>

              {/* 原始轉錄文字 */}
              {transcribedText && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">原始語音轉錄：</p>
                  <p className="text-sm text-gray-400">{transcribedText}</p>
                </div>
              )}

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
          {aiProcessed && (
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
