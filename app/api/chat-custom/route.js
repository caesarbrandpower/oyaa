// app/api/chat-custom/route.js
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { getTenant } from '@/lib/get-tenant';
import { anonymize, deanonymize } from '@/lib/anonymize';
import { CUSTOM_PROMPTS, CUSTOM_SYSTEM_PROMPT, DOCUMENT_OUTPUT_TYPES } from '@/lib/custom-prompts';

export const maxDuration = 60;

function writeEvent(controller, data) {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  controller.enqueue(encoded);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Niet ingelogd.' }, { status: 401 });
  }

  const { threadId, message, outputType, taskLabel } = await request.json();

  if (!message || !message.trim()) {
    return Response.json({ error: 'Bericht is verplicht.' }, { status: 400 });
  }

  const tenant = await getTenant();
  const isDocument = outputType ? DOCUMENT_OUTPUT_TYPES.has(outputType) : false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        let activeThreadId = threadId;

        if (!activeThreadId) {
          const title = taskLabel || message.trim().slice(0, 60);
          const { data: newThread, error: threadError } = await supabase
            .from('threads')
            .insert({
              user_id: user.id,
              tenant_id: tenant?.id ?? null,
              title,
              output_type: outputType ?? null,
            })
            .select('id')
            .single();

          if (threadError) {
            writeEvent(controller, { type: 'error', error: 'Thread aanmaken mislukt.' });
            controller.close();
            return;
          }
          activeThreadId = newThread.id;
        }

        writeEvent(controller, { type: 'meta', threadId: activeThreadId, isDocument });

        // Verify thread ownership when threadId was provided by client
        if (threadId) {
          const { data: ownedThread } = await supabase
            .from('threads')
            .select('id')
            .eq('id', activeThreadId)
            .eq('user_id', user.id)
            .single();

          if (!ownedThread) {
            writeEvent(controller, { type: 'error', error: 'Geen toegang tot dit gesprek.' });
            controller.close();
            return;
          }
        }

        const { error: userMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'user', content: message.trim() });

        if (userMsgError) {
          writeEvent(controller, { type: 'error', error: 'Bericht opslaan mislukt.' });
          controller.close();
          return;
        }

        const { data: allMessages, error: messagesError } = await supabase
          .from('messages')
          .select('role, content')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });

        if (messagesError || !allMessages) {
          writeEvent(controller, { type: 'error', error: 'Berichten ophalen mislukt.' });
          controller.close();
          return;
        }

        // UUID-separator: eliminates any chance of collision with user input
        const separator = `\n[---${crypto.randomUUID()}---]\n`;
        const combined = allMessages.map(m => m.content).join(separator);
        const { anonymized: anonAll, map } = anonymize(combined);
        const anonParts = anonAll.split(separator);

        const userMessages = allMessages.filter(m => m.role === 'user');
        const isFirstTurn = userMessages.length === 1;
        const useStructuredPrompt = isFirstTurn && outputType && CUSTOM_PROMPTS[outputType];

        let claudeMessages;
        if (useStructuredPrompt) {
          const lastUserIdx = anonParts.length - 1;
          claudeMessages = [
            { role: 'user', content: CUSTOM_PROMPTS[outputType](anonParts[lastUserIdx]) },
          ];
        } else {
          claudeMessages = allMessages.map((msg, i) => ({
            role: msg.role,
            content: anonParts[i] ?? msg.content,
          }));
        }

        let fullText = '';
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: CUSTOM_SYSTEM_PROMPT,
          messages: claudeMessages,
        });

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullText += text;
            writeEvent(controller, { type: 'chunk', text });
          }
        }

        const finalContent = deanonymize(fullText, map);

        const { data: savedMsg, error: savedMsgError } = await supabase
          .from('messages')
          .insert({ thread_id: activeThreadId, role: 'assistant', content: finalContent })
          .select('id')
          .single();

        if (savedMsgError) {
          console.error('Assistant message opslaan mislukt:', savedMsgError);
        }

        await supabase
          .from('threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeThreadId);

        writeEvent(controller, {
          type: 'done',
          content: finalContent,
          messageId: savedMsg?.id ?? crypto.randomUUID(),
        });

        controller.close();
      } catch (err) {
        console.error('chat-custom stream error:', err);
        writeEvent(controller, { type: 'error', error: 'Er is een fout opgetreden.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
