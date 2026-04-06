export class VoiceVoxReader {
  constructor({ voicevoxBaseUrl, defaultSpeakerId, speakerIds = [] }) {
    this.voicevoxBaseUrl = (voicevoxBaseUrl || 'http://127.0.0.1:50021').replace(/\/$/, '');
    this.defaultSpeakerId = Number.isNaN(Number(defaultSpeakerId)) ? 1 : Number(defaultSpeakerId);

    this.speakerIds = speakerIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (this.speakerIds.length === 0) {
      this.speakerIds = [this.defaultSpeakerId];
    }
  }

  normalizeMessage(content) {
    if (!content) return '';

    return content
      .replace(/https?:\/\/\S+/g, 'URL')
      .replace(/<a?:\w+:\d+>/g, '絵文字')
      .replace(/<@!?(\d+)>/g, 'メンション')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  speakerForUser(userId) {
    if (!userId) return this.defaultSpeakerId;

    const hash = [...String(userId)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const index = hash % this.speakerIds.length;
    return this.speakerIds[index];
  }

  async synthesize(text, speakerId = this.defaultSpeakerId) {
    const queryParams = new URLSearchParams({
      text,
      speaker: String(speakerId),
    });

    const audioQueryResponse = await fetch(`${this.voicevoxBaseUrl}/audio_query?${queryParams}`, {
      method: 'POST',
    });

    if (!audioQueryResponse.ok) {
      throw new Error(`audio_query failed: ${audioQueryResponse.status}`);
    }

    const audioQuery = await audioQueryResponse.json();

    const synthesisResponse = await fetch(`${this.voicevoxBaseUrl}/synthesis?speaker=${speakerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(audioQuery),
    });

    if (!synthesisResponse.ok) {
      throw new Error(`synthesis failed: ${synthesisResponse.status}`);
    }

    const arrayBuffer = await synthesisResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
