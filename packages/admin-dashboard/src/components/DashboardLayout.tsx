import { useState, useEffect, useRef } from "react";
import {
  Outlet,
  NavLink,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getAuthors, createAuthor, addTextKnowledge, transcribeAudio, categorizeContent, getCategories, Author } from "../services/api";
import {
  Menu,
  X,
  MessageSquare,
  BookOpen,
  Sparkles,
  Mic,
  Send,
  Upload,
  UserPlus,
  Users,
  Tag,
} from "lucide-react";

export function DashboardLayout() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showAddAuthor, setShowAddAuthor] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState("");
  const [newAuthorSlug, setNewAuthorSlug] = useState("");
  const [knowledgeRefreshKey, setKnowledgeRefreshKey] = useState(0);

  // 分類選擇狀態
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSub1, setSelectedSub1] = useState("");
  const [selectedSub2, setSelectedSub2] = useState("");
  const [selectedSub3, setSelectedSub3] = useState("");
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [subcategory1Map, setSubcategory1Map] = useState<Record<string, string[]>>({});
  const [subcategory2Map, setSubcategory2Map] = useState<Record<string, string[]>>({});
  const [subcategory3Map, setSubcategory3Map] = useState<Record<string, string[]>>({});
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomSub1, setIsCustomSub1] = useState(false);
  const [isCustomSub2, setIsCustomSub2] = useState(false);
  const [isCustomSub3, setIsCustomSub3] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadAuthors();
  }, []);

  useEffect(() => {
    // 不要在通用頁面時自動跳轉到第一個作者
    const isSharedPath = location.pathname.includes('/shared');
    if (!loading && authors.length > 0 && !slug && !isSharedPath) {
      navigate(`/${authors[0].slug}`);
    }
  }, [loading, authors, slug, navigate, location.pathname]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // 載入分類選項
  useEffect(() => {
    const loadCategoriesData = async () => {
      if (!slug) return;
      try {
        const data = await getCategories(slug);
        setAllCategories(data.categories);
        setSubcategory1Map(data.subcategory1Map);
        setSubcategory2Map(data.subcategory2Map || {});
        setSubcategory3Map(data.subcategory3Map || {});
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };
    loadCategoriesData();
  }, [slug]);

  // 取得子分類選項
  const getSub1Options = () => subcategory1Map[selectedCategory] || [];
  const getSub2Options = () => subcategory2Map[`${selectedCategory}|${selectedSub1}`] || [];
  const getSub3Options = () => subcategory3Map[`${selectedCategory}|${selectedSub1}|${selectedSub2}`] || [];

  const loadAuthors = async () => {
    try {
      const data = await getAuthors();
      setAuthors(data.authors);
    } catch (error) {
      console.error("Failed to load authors:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentAuthor = authors.find((a) => a.slug === slug);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  // Helper function to auto-resize textarea
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  // Transcribe current audio chunks
  const transcribeCurrentChunks = async () => {
    if (chunksRef.current.length === 0) return;

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = []; // Clear chunks after creating blob

    try {
      setTranscribing(true);
      const result = await transcribeAudio(audioBlob);
      if (result.text && result.text.trim()) {
        setInputText((prev) => prev + (prev ? " " : "") + result.text.trim());
        setTimeout(autoResizeTextarea, 0);
      }
    } catch (error) {
      console.error("Transcription failed:", error);
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Start recording with timeslice to get data every 1 second
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Set up interval to transcribe every 2 seconds (gives enough audio data)
      transcriptionIntervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0) {
          transcribeCurrentChunks();
        }
      }, 2000);

    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("無法使用麥克風");
    }
  };

  const stopRecording = async () => {
    // Clear the transcription interval
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Transcribe any remaining chunks
      if (chunksRef.current.length > 0) {
        await transcribeCurrentChunks();
      }
    }
  };

  const handleSave = async () => {
    if (!inputText.trim() || !slug) return;
    setSaving(true);
    try {
      const textLength = inputText.replace(/\s/g, '').length;

      // If text is long enough (> 200 chars), use AI to categorize
      if (textLength > 200) {
        const result = await categorizeContent(slug, inputText);
        alert(`${result.message}`);
      } else {
        // For short text, save as single knowledge item
        const title = `知識 ${new Date().toLocaleDateString("zh-TW")} ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
        await addTextKnowledge(slug, {
          title,
          content: inputText,
          category: selectedCategory || undefined,
          subcategory1: selectedSub1 || undefined,
          subcategory2: selectedSub2 || undefined,
          subcategory3: selectedSub3 || undefined,
        });
      }

      setInputText("");
      // 重置分類選擇
      setSelectedCategory("");
      setSelectedSub1("");
      setSelectedSub2("");
      setSelectedSub3("");
      setIsCustomCategory(false);
      setIsCustomSub1(false);
      setIsCustomSub2(false);
      setIsCustomSub3(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      // Trigger knowledge refresh and navigate
      setKnowledgeRefreshKey(prev => prev + 1);
      navigate(`/${slug}/knowledge`);
    } catch (error) {
      console.error("Failed to save:", error);
      alert("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setTranscribing(true);
      const result = await transcribeAudio(file);
      if (result.text && result.text.trim()) {
        setInputText((prev) => prev + (prev ? " " : "") + result.text.trim());
        setTimeout(autoResizeTextarea, 0);
      }
    } catch (error) {
      console.error("Audio transcription failed:", error);
      alert("音檔轉錄失敗");
    } finally {
      setTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getActiveTab = () => {
    if (location.pathname.includes("/knowledge")) return "knowledge";
    if (location.pathname.includes("/summary")) return "summary";
    return "conversations";
  };

  const isSharedPage = location.pathname.includes('/shared');

  const handleAddAuthor = async () => {
    if (!newAuthorName.trim() || !newAuthorSlug.trim()) return;
    try {
      const result = await createAuthor(newAuthorName.trim(), newAuthorSlug.trim());
      if (result.success) {
        setShowAddAuthor(false);
        setNewAuthorName("");
        setNewAuthorSlug("");
        // 重新載入作者列表
        await loadAuthors();
        // 導航到新作者頁面
        navigate(`/${result.author.slug}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '新增作者失敗');
    }
  };

  return (
    <div className="h-screen h-[100dvh] flex bg-white">
      {/* Left Sidebar - Authors */}
      <aside
        className={`
          ${isMobile ? "fixed inset-y-0 left-0 z-50" : "relative"}
          ${sidebarOpen ? "w-64" : "w-0"}
          bg-[#f0f4f9] flex flex-col
          transition-all duration-300 ease-out overflow-hidden
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full w-64">
          {/* Header */}
          <div className="p-3 flex items-center justify-between border-b border-gray-200">
            <span className="font-medium text-gray-800 px-2">作者管理</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors md:hidden"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Add Author Button */}
          <div className="p-3">
            <button
              onClick={() => setShowAddAuthor(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#b20a2c] text-white rounded-full text-sm font-medium hover:bg-[#8a0822] transition-colors"
            >
              <UserPlus size={18} />
              <span>新增作者</span>
            </button>
          </div>

          {/* Authors List */}
          <div className="flex-1 overflow-y-auto px-2">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                載入中...
              </div>
            ) : (
              <div className="space-y-1">
                {/* 通用知識庫選項 */}
                <button
                  onClick={() => navigate('/shared/knowledge')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    location.pathname.includes('/shared')
                      ? "bg-[#fffbd5] text-[#b20a2c]"
                      : "text-gray-700 hover:bg-black/5"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <Users size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">通用</p>
                    <p className="text-xs text-gray-500">共用知識庫</p>
                  </div>
                </button>

                {/* 分隔線 */}
                <div className="border-t border-gray-200 my-2" />

                {/* 原有作者列表 */}
                {authors.length === 0 ? (
                  <div className="px-4 py-4 text-center text-gray-500 text-sm">
                    尚無作者
                  </div>
                ) : (
                  authors.map((author) => (
                    <button
                      key={author.id}
                      onClick={() => navigate(`/${author.slug}`)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        author.slug === slug
                          ? "bg-[#fffbd5] text-[#b20a2c]"
                          : "text-gray-700 hover:bg-black/5"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fffbd5] to-[#b20a2c] flex items-center justify-center text-[#b20a2c] font-medium">
                        {author.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{author.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          /{author.slug}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Add Author Modal */}
      {showAddAuthor && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setShowAddAuthor(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">新增作者</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  作者名稱
                </label>
                <input
                  type="text"
                  value={newAuthorName}
                  onChange={(e) => setNewAuthorName(e.target.value)}
                  placeholder="例：林恩如"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#b20a2c]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  網址代稱 (slug)
                </label>
                <input
                  type="text"
                  value={newAuthorSlug}
                  onChange={(e) =>
                    setNewAuthorSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  placeholder="例：enru"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-[#b20a2c]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddAuthor(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddAuthor}
                  disabled={!newAuthorName.trim() || !newAuthorSlug.trim()}
                  className="flex-1 px-4 py-2.5 bg-[#b20a2c] text-white rounded-xl font-medium hover:bg-[#8a0822] transition-colors disabled:opacity-50"
                >
                  新增
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Navigation Tabs */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Menu size={20} className="text-gray-600" />
            </button>

            {/* Current Author or Shared Title */}
            {isSharedPage ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <Users size={16} className="text-gray-500" />
                </div>
                <span className="font-medium text-gray-800">通用知識庫</span>
              </div>
            ) : currentAuthor && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#fffbd5] to-[#b20a2c] flex items-center justify-center text-[#b20a2c] text-xs font-medium">
                  {currentAuthor.name[0]}
                </div>
                <span className="font-medium text-gray-800 hidden sm:block">
                  {currentAuthor.name}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs in Header - 通用頁面不顯示導航（只有知識庫） */}
          {!isSharedPage && currentAuthor && (
            <nav className="flex items-center gap-1">
              <NavLink
                to={`/${slug}/conversations`}
                className={() =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    getActiveTab() === "conversations"
                      ? "bg-[#fffbd5] text-[#b20a2c]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                <MessageSquare size={16} />
                <span className="hidden sm:inline">對話紀錄</span>
              </NavLink>
              <NavLink
                to={`/${slug}/knowledge`}
                className={() =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    getActiveTab() === "knowledge"
                      ? "bg-[#fffbd5] text-[#b20a2c]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                <BookOpen size={16} />
                <span className="hidden sm:inline">知識庫</span>
              </NavLink>
              <NavLink
                to={`/${slug}/summary`}
                className={() =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    getActiveTab() === "summary"
                      ? "bg-[#fffbd5] text-[#b20a2c]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`
                }
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">AI 整理</span>
              </NavLink>
            </nav>
          )}

          {/* Right spacer */}
          <div className="w-10" />
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          <Outlet context={{ currentAuthor, authors, darkMode: false, knowledgeRefreshKey }} />
        </main>

        {/* Bottom Input Bar - 只在知識庫和 AI 整理頁面顯示，通用頁面不顯示 */}
        {!isSharedPage && currentAuthor && getActiveTab() !== "conversations" && (
          <div className="px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <div className="bg-[#f0f4f9] rounded-3xl border border-gray-200 overflow-hidden">
                {/* Tag 選擇區 */}
                <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500">
                    <Tag size={14} />
                  </span>

                  {/* 主分類 */}
                  {isCustomCategory ? (
                    <div className="inline-flex items-center bg-gray-100 rounded-full border border-gray-300 overflow-hidden">
                      <input
                        type="text"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        placeholder="輸入分類"
                        className="w-20 px-2 py-1 text-xs bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
                        autoFocus
                      />
                      <button
                        onClick={() => setIsCustomCategory(false)}
                        className="px-2 text-gray-500 hover:text-gray-700"
                      >
                        ↓
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          setIsCustomCategory(true);
                          setSelectedCategory("");
                        } else {
                          setSelectedCategory(e.target.value);
                          setSelectedSub1("");
                          setSelectedSub2("");
                          setSelectedSub3("");
                        }
                      }}
                      className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded-full text-gray-700 cursor-pointer outline-none"
                    >
                      <option value="">選擇分類</option>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__add_new__">+ 新增</option>
                    </select>
                  )}

                  {/* 子分類 1 */}
                  {selectedCategory && (
                    <>
                      <span className="text-gray-400">/</span>
                      {isCustomSub1 ? (
                        <div className="inline-flex items-center bg-gray-100 rounded-full border border-gray-300 overflow-hidden">
                          <input
                            type="text"
                            value={selectedSub1}
                            onChange={(e) => setSelectedSub1(e.target.value)}
                            placeholder="子分類1"
                            className="w-16 px-2 py-1 text-xs bg-transparent border-none outline-none text-gray-600 placeholder-gray-400"
                            autoFocus
                          />
                          <button
                            onClick={() => setIsCustomSub1(false)}
                            className="px-2 text-gray-500 hover:text-gray-700"
                          >
                            ↓
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedSub1}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              setIsCustomSub1(true);
                              setSelectedSub1("");
                            } else {
                              setSelectedSub1(e.target.value);
                              setSelectedSub2("");
                              setSelectedSub3("");
                            }
                          }}
                          className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-full text-gray-600 cursor-pointer outline-none"
                        >
                          <option value="">子分類1</option>
                          {getSub1Options().map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          <option value="__add_new__">+ 新增</option>
                        </select>
                      )}
                    </>
                  )}

                  {/* 子分類 2 */}
                  {selectedSub1 && (
                    <>
                      <span className="text-gray-400">/</span>
                      {isCustomSub2 ? (
                        <div className="inline-flex items-center bg-gray-100 rounded-full border border-gray-300 overflow-hidden">
                          <input
                            type="text"
                            value={selectedSub2}
                            onChange={(e) => setSelectedSub2(e.target.value)}
                            placeholder="子分類2"
                            className="w-16 px-2 py-1 text-xs bg-transparent border-none outline-none text-gray-600 placeholder-gray-400"
                            autoFocus
                          />
                          <button
                            onClick={() => setIsCustomSub2(false)}
                            className="px-2 text-gray-500 hover:text-gray-700"
                          >
                            ↓
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedSub2}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              setIsCustomSub2(true);
                              setSelectedSub2("");
                            } else {
                              setSelectedSub2(e.target.value);
                              setSelectedSub3("");
                            }
                          }}
                          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-full text-gray-600 cursor-pointer outline-none"
                        >
                          <option value="">子分類2</option>
                          {getSub2Options().map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          <option value="__add_new__">+ 新增</option>
                        </select>
                      )}
                    </>
                  )}

                  {/* 子分類 3 */}
                  {selectedSub2 && (
                    <>
                      <span className="text-gray-400">/</span>
                      {isCustomSub3 ? (
                        <div className="inline-flex items-center bg-gray-100 rounded-full border border-gray-300 overflow-hidden">
                          <input
                            type="text"
                            value={selectedSub3}
                            onChange={(e) => setSelectedSub3(e.target.value)}
                            placeholder="子分類3"
                            className="w-16 px-2 py-1 text-xs bg-transparent border-none outline-none text-gray-500 placeholder-gray-400"
                            autoFocus
                          />
                          <button
                            onClick={() => setIsCustomSub3(false)}
                            className="px-2 text-gray-500 hover:text-gray-700"
                          >
                            ↓
                          </button>
                        </div>
                      ) : (
                        <select
                          value={selectedSub3}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              setIsCustomSub3(true);
                              setSelectedSub3("");
                            } else {
                              setSelectedSub3(e.target.value);
                            }
                          }}
                          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-full text-gray-500 cursor-pointer outline-none"
                        >
                          <option value="">子分類3</option>
                          {getSub3Options().map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          <option value="__add_new__">+ 新增</option>
                        </select>
                      )}
                    </>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaChange}
                  placeholder="請輸入知識內容"
                  rows={1}
                  className="w-full px-5 py-4 bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none resize-none text-base"
                  style={{ minHeight: "52px", maxHeight: "150px" }}
                />

                {/* Action Row */}
                <div className="flex items-center justify-between px-3 pb-3">
                  <div className="flex items-center gap-1">
                    {/* Upload Audio */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 hover:bg-black/5 rounded-full transition-colors"
                      title="上傳音檔"
                      disabled={transcribing}
                    >
                      <Upload size={20} className="text-gray-600" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Recording Button - Always visible */}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={transcribing}
                      className={`w-11 h-11 flex items-center justify-center rounded-full transition-all ${
                        isRecording
                          ? "bg-red-500 hover:bg-red-600 animate-pulse"
                          : transcribing
                            ? "bg-gray-300"
                            : "bg-gradient-to-br from-[#fffbd5] to-[#b20a2c] hover:from-[#fff4a3] hover:to-[#8a0822]"
                      }`}
                      title={isRecording ? "停止錄音" : transcribing ? "轉錄中..." : "語音輸入"}
                    >
                      {transcribing ? (
                        <div className="w-5 h-5 border-2 border-[#b20a2c]/30 border-t-[#b20a2c] rounded-full animate-spin" />
                      ) : (
                        <Mic size={20} className="text-[#b20a2c]" />
                      )}
                    </button>

                    {/* Send Button - visible when has text */}
                    {inputText.trim() && (
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-11 h-11 flex items-center justify-center bg-[#b20a2c] hover:bg-[#8a0822] rounded-full transition-colors disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send size={20} className="text-white" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-500 text-center mt-2">
                輸入內容將新增至知識庫
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
