import OpenAI from 'openai';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'Geen audiobestand ontvangen.' }, { status: 400 });
    }

    const maxSize = 25 * 1024 * 1024; // 25MB Whisper limit
    if (file.size > maxSize) {
      return Response.json(
        { error: 'Bestand is te groot. Maximum is 25MB.' },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/x-m4a', 'audio/wav', 'audio/wave', 'audio/ogg',
      'audio/webm', 'video/mp4', 'video/webm',
    ];
    const allowedExts = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];

    const name = file.name?.toLowerCase() || '';
    const ext = name.slice(name.lastIndexOf('.'));
    const typeOk = allowedTypes.includes(file.type) || allowedExts.includes(ext);

    if (!typeOk) {
      return Response.json(
        { error: `Bestandstype "${ext || file.type}" wordt niet ondersteund voor transcriptie.` },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'nl',
    });

    return Response.json({ transcript: transcription.text });
  } catch (error) {
    console.error('Whisper API error:', error);
    return Response.json(
      { error: 'Er is een fout opgetreden bij het transcriberen van de audio.' },
      { status: 500 }
    );
  }
}
