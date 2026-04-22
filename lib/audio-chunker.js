const CHUNK_DURATION_SECONDS = 600; // 10 minutes per chunk
const TARGET_SAMPLE_RATE = 16000;   // Whisper prefers 16kHz

/**
 * Decodes any audio file and splits it into WAV Blobs of up to 10 minutes each.
 * Uses the browser's AudioContext — must be called from a client component.
 *
 * Each output WAV is 16kHz mono PCM, max ~18.75MB (well under Whisper's 25MB limit).
 *
 * @param {File|Blob} file - Any audio file (MP3, M4A, WAV, WebM, Ogg, etc.)
 * @returns {Promise<Blob[]>} Array of WAV Blobs
 * @throws {Error} If the format cannot be decoded by the browser
 */
export async function decodeAndChunk(file) {
  const arrayBuffer = await file.arrayBuffer();

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    audioContext.close();
  }

  // Resample to 16kHz mono using OfflineAudioContext
  const totalOutputSamples = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(
    1,                   // mono
    totalOutputSamples,
    TARGET_SAMPLE_RATE
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampled = await offlineCtx.startRendering();
  const pcmData = resampled.getChannelData(0); // Float32Array, mono

  // Split into chunks of CHUNK_DURATION_SECONDS
  const samplesPerChunk = CHUNK_DURATION_SECONDS * TARGET_SAMPLE_RATE;
  const numChunks = Math.ceil(pcmData.length / samplesPerChunk);
  const chunks = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, pcmData.length);
    const chunkSamples = pcmData.slice(start, end);
    chunks.push(encodeWav(chunkSamples, TARGET_SAMPLE_RATE));
  }

  return chunks;
}

/**
 * Converts any audio Blob to a single WAV Blob (16kHz mono PCM).
 * Useful for creating a universally playable download file from a WebM recording.
 *
 * @param {Blob} blob - Any audio blob (WebM, MP4, etc.)
 * @returns {Promise<Blob>} WAV Blob at 16kHz mono
 * @throws {Error} If the format cannot be decoded by the browser
 */
export async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    audioContext.close();
  }

  const totalOutputSamples = Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(1, totalOutputSamples, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampled = await offlineCtx.startRendering();

  return encodeWav(resampled.getChannelData(0), TARGET_SAMPLE_RATE);
}

/**
 * Encodes a Float32Array of mono PCM samples as a WAV Blob (PCM 16-bit little-endian).
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {Blob}
 */
function encodeWav(samples, sampleRate) {
  const numSamples = samples.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples: float32 [-1, 1] to int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
