import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  // Convert buffer to a File-like object for OpenAI
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], 'audio.webm', { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    language: 'zh',
    response_format: 'text',
    prompt: '繁體中文，台灣用語', // Hint for Traditional Chinese output
  });

  return transcription;
}
