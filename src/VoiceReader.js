import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource
} from '@discordjs/voice';
import axios from 'axios';
import fs from 'fs';

export class VoiceReader {

  constructor() {
    this.connection = null;
    this.player = createAudioPlayer();
    this.currentVoiceChannelId = null; // ← 追加
  }

  async join(member) {
    if (!member.voice.channel) return;

    this.currentVoiceChannelId = member.voice.channel.id; // ← 保存

    this.connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId: member.guild.id,
      adapterCreator: member.guild.voiceAdapterCreator,
    });

    this.connection.subscribe(this.player);
  }

  async leave() {
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
      this.currentVoiceChannelId = null;
    }
  }

  async speak(text) {
    try {

      // 長すぎるの防止
      text = text.slice(0, 100);

      const query = await axios.post(
        `http://127.0.0.1:50021/audio_query`,
        null,
        { params: { text, speaker: 3 } }
      );

      const wav = await axios.post(
        `http://127.0.0.1:50021/synthesis`,
        query.data,
        {
          params: { speaker: 3 },
          responseType: 'arraybuffer'
        }
      );

      fs.writeFileSync('voice.wav', wav.data);

      const resource = createAudioResource('voice.wav');
      this.player.play(resource);

    } catch (err) {
      console.error('VOICEVOX error:', err);
    }
  }
}
