export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  // 根據 mimeType 決定副檔名（處理帶有 codecs 參數的 mimeType）
  const baseMimeType = mimeType.split(';')[0].trim();

  const extensionMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/oga': 'oga',
    'audio/mpga': 'mpga',
  };

  const extension = extensionMap[baseMimeType] || 'webm';
  const filename = `audio.${extension}`;

  console.log(`[Whisper] mimeType: ${mimeType}, filename: ${filename}, bufferSize: ${audioBuffer.length}`);

  // 直接使用 fetch 呼叫 OpenAI API（不使用 SDK）
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: baseMimeType });
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'zh');
  formData.append('response_format', 'text');
  formData.append('prompt', '繁體中文，台灣用語');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Whisper API error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = `Whisper API error: ${errorJson.error?.message || errorText}`;
    } catch {
      errorMessage = `Whisper API error: ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  const transcription = await response.text();
  console.log(`[Whisper] Transcription complete: ${transcription.length} chars`);

  return transcription;
}
