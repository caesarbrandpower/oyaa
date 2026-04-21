import { createClient } from './supabase-browser';

const BUCKET = 'audio-temp';

/**
 * Uploads a WAV Blob to Supabase Storage audio-temp bucket.
 *
 * @param {Blob} wavBlob
 * @param {string} sessionId - UUID for this upload session (groups chunks together)
 * @param {number} chunkIndex - Zero-based chunk index
 * @returns {Promise<string>} Storage path, e.g. "abc123/0.wav"
 * @throws {Error} If upload fails
 */
export async function uploadChunk(wavBlob, sessionId, chunkIndex) {
  const supabase = createClient();
  const path = `${sessionId}/${chunkIndex}.wav`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, wavBlob, {
      contentType: 'audio/wav',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload mislukt (deel ${chunkIndex + 1}): ${error.message}`);
  }

  return path;
}
