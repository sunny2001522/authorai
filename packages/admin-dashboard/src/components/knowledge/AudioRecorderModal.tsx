import { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Loader2 } from 'lucide-react';
import { addTextKnowledge } from '../../services/api';

interface AudioRecorderModalProps {
  adminKey: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AudioRecorderModal({ adminKey, onClose, onSaved }: AudioRecorderModalProps) {
  const [title, setTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError('無法存取麥克風');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const transcribe = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setError(null);

    try {
      // For now, we'll show a placeholder message
      // In production, this would call the Whisper API
      setTranscribedText(
        '（語音轉文字功能需要配置 OpenAI Whisper API）\n\n' +
        '請在此處手動輸入或編輯轉換後的文字內容。'
      );
    } catch (err) {
      setError('語音轉文字失敗');
      console.error(err);
    } finally {
      setIsTranscribing(false);
    }
  };

  useEffect(() => {
    if (audioBlob && !transcribedText) {
      transcribe();
    }
  }, [audioBlob]);

  const handleSave = async () => {
    if (!title.trim() || !transcribedText.trim()) {
      setError('請填寫標題和內容');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await addTextKnowledge(adminKey, { title: title.trim(), content: transcribedText.trim() });
      onSaved();
    } catch (err) {
      setError('儲存失敗');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscribedText('');
    setRecordingTime(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">新增知識 - 錄音輸入</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              標題
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：直播問答精華 2024-02-26"
              className="input w-full"
            />
          </div>

          {/* Recording area */}
          <div className="flex flex-col items-center py-8 bg-white/5 rounded-xl">
            <div className="text-4xl font-mono mb-6">
              {isRecording && (
                <span className="text-red-500 animate-pulse mr-2">●</span>
              )}
              {formatTime(recordingTime)}
            </div>

            {/* Waveform placeholder */}
            {isRecording && (
              <div className="flex items-center gap-1 h-12 mb-6">
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

            {/* Controls */}
            <div className="flex gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!!audioBlob}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <Mic className="w-6 h-6 text-white" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                >
                  <Square className="w-6 h-6 text-white" />
                </button>
              )}
            </div>

            {audioBlob && (
              <button
                onClick={resetRecording}
                className="mt-4 text-sm text-gray-400 hover:text-white"
              >
                重新錄製
              </button>
            )}
          </div>

          {/* Transcription */}
          {isTranscribing && (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>正在轉換語音為文字...</span>
            </div>
          )}

          {transcribedText && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                轉換後文字（可編輯）
              </label>
              <textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                rows={8}
                className="textarea w-full"
              />
            </div>
          )}

          {/* Audio preview */}
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full" />
          )}

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
            disabled={saving || !title.trim() || !transcribedText.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中...' : '儲存到知識庫'}
          </button>
        </div>
      </div>
    </div>
  );
}
