// lib/token-usage.js
import { createServiceClient } from './supabase-server';

/**
 * Slaat tokenverbruik op na een Anthropic-call. Fire-and-forget: nooit awaiten.
 *
 * @param {object} opts
 * @param {string|null} opts.tenantId
 * @param {string|null} opts.userId
 * @param {string|null} opts.threadId
 * @param {string} opts.requestType  — 'chat-custom-analysis' | 'chat-custom-generation' | 'chat' | 'generate-title' | 'rewrite-marker'
 * @param {string} opts.model
 * @param {object} opts.usage  — Anthropic usage object van response.usage of finalMessage().usage
 */
export function insertTokenUsage({ tenantId, userId, threadId, requestType, model, usage }) {
  const service = createServiceClient();
  service
    .from('token_usage')
    .insert({
      tenant_id: tenantId ?? null,
      user_id: userId ?? null,
      thread_id: threadId ?? null,
      request_type: requestType,
      model,
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage?.cache_creation_input_tokens ?? 0,
    })
    .then(
      ({ error }) => { if (error) console.error('[token_usage] insert failed:', error); },
      (err) => console.error('[token_usage] insert exception:', err)
    );
}
