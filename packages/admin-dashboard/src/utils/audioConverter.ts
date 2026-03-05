/**
 * Audio format converter utilities
 * Converts browser-recorded WebM audio to WAV format for Whisper API compatibility
 */

/**
 * Convert AudioBuffer to WAV Blob (16000Hz, mono, 16-bit)
 * 16kHz is sufficient for speech recognition
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const targetSampleRate = 16000;
  const format = 1; // PCM
  const bitDepth = 16;
  const numChannels = 1; // Force mono

  // Calculate sample count after resampling
  const ratio = audioBuffer.sampleRate / targetSampleRate;
  const newLength = Math.floor(audioBuffer.length / ratio);

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = newLength * blockAlign;
  const bufferLength = 44 + dataLength;

  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);

  // Write string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Mix channels to mono
  const inputChannels = audioBuffer.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let i = 0; i < inputChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  // Find maximum amplitude for normalization
  let maxAmplitude = 0;
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    let sample = 0;
    for (let ch = 0; ch < inputChannels; ch++) {
      sample += channels[ch][srcIndex] || 0;
    }
    sample /= inputChannels;
    maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
  }

  // Calculate normalization gain
  const targetPeak = 0.95;
  const normalizeGain = maxAmplitude > 0.01 ? targetPeak / maxAmplitude : 1;
  const actualGain = Math.min(normalizeGain, 10);

  // Write normalized audio data
  let offset = 44;
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    let sample = 0;
    for (let ch = 0; ch < inputChannels; ch++) {
      sample += channels[ch][srcIndex] || 0;
    }
    sample /= inputChannels;
    sample *= actualGain;
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Convert a Blob (WebM/any audio) to WAV format
 * Uses AudioContext to decode and re-encode
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } finally {
    await audioContext.close();
  }
}
