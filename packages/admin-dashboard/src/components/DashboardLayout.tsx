import { useState, useEffect, useRef } from "react";
import {
  Outlet,
  NavLink,
  useParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getAuthors, addTextKnowledge, transcribeAudio, categorizeContent, Author } from "../services/api";
import {
  Menu,
  X,
  MessageSquare,
  BookOpen,
  Sparkles,
  Mic,
  Send,
  Plus,
  UserPlus,
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
    if (!loading && authors.length > 0 && !slug) {
      navigate(`/${authors[0].slug}`);
    }
  }, [loading, authors, slug, navigate]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

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
        await addTextKnowledge(slug, { title, content: inputText });
      }

      setInputText("");
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(
        (prev) =>
          prev + (prev ? "\n\n" : "") + `[文件: ${file.name}]\n${content}`,
      );
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getActiveTab = () => {
    if (location.pathname.includes("/knowledge")) return "knowledge";
    if (location.pathname.includes("/summary")) return "summary";
    return "conversations";
  };

  const handleAddAuthor = async () => {
    if (!newAuthorName.trim() || !newAuthorSlug.trim()) return;
    // TODO: Call API to add author
    alert(`新增作者: ${newAuthorName} (/${newAuthorSlug})`);
    setShowAddAuthor(false);
    setNewAuthorName("");
    setNewAuthorSlug("");
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
            ) : authors.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                尚無作者
              </div>
            ) : (
              <div className="space-y-1">
                {authors.map((author) => (
                  <button
                    key={author.id}
                    onClick={() => navigate(`/${author.slug}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      author.slug === slug
                        ? "bg-[#fffbd5] text-[#b20a2c]"
                        : "text-gray-700 hover:bg-black/5"
                    }`}
                  >
                    {author.avatar_url ? (
                      <img
                        src={author.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fffbd5] to-[#b20a2c] flex items-center justify-center text-[#b20a2c] font-medium">
                        {author.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{author.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        /{author.slug}
                      </p>
                    </div>
                  </button>
                ))}
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

            {/* Current Author */}
            {currentAuthor && (
              <div className="flex items-center gap-2">
                {currentAuthor.avatar_url ? (
                  <img
                    src={currentAuthor.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#fffbd5] to-[#b20a2c] flex items-center justify-center text-[#b20a2c] text-xs font-medium">
                    {currentAuthor.name[0]}
                  </div>
                )}
                <span className="font-medium text-gray-800 hidden sm:block">
                  {currentAuthor.name}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs in Header */}
          {currentAuthor && (
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

        {/* Bottom Input Bar - 只在知識庫和 AI 整理頁面顯示 */}
        {currentAuthor && getActiveTab() !== "conversations" && (
          <div className="px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <div className="bg-[#f0f4f9] rounded-3xl border border-gray-200 overflow-hidden">
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
                    {/* Add File */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 hover:bg-black/5 rounded-full transition-colors"
                      title="新增文件"
                    >
                      <Plus size={20} className="text-gray-600" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.json"
                      onChange={handleFileSelect}
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
