import { AttachmentBuilder } from 'discord.js';

export class VoiceVoxReader {
  constructor({ voicevoxBaseUrl, speakerId }) {
    this.voicevoxBaseUrl = (voicevoxBaseUrl || 'http://127.0.0.1:50021').replace(/\/$/, '');
    this.speakerId = Number.isNaN(Number(speakerId)) ? 1 : Number(speakerId);
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

  async createAttachment(message) {
    const text = this.normalizeMessage(message.content);
    if (!text) return null;

    const spokenText = `${message.member?.displayName || message.author.username}、${text}`;
    const audioBuffer = await this.synthesize(spokenText);

    return new AttachmentBuilder(audioBuffer, {
      name: `read-${Date.now()}.wav`,
    });
  }

  async synthesize(text) {
    const queryParams = new URLSearchParams({
      text,
      speaker: String(this.speakerId),
    });

    const audioQueryResponse = await fetch(`${this.voicevoxBaseUrl}/audio_query?${queryParams}`, {
      method: 'POST',
    });

    if (!audioQueryResponse.ok) {
      throw new Error(`audio_query failed: ${audioQueryResponse.status}`);
    }

    const audioQuery = await audioQueryResponse.json();

    const synthesisResponse = await fetch(
      `${this.voicevoxBaseUrl}/synthesis?speaker=${this.speakerId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(audioQuery),
      }
    );

    if (!synthesisResponse.ok) {
      throw new Error(`synthesis failed: ${synthesisResponse.status}`);
    }

    const arrayBuffer = await synthesisResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
