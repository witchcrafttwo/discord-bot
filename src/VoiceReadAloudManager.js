import { Readable } from 'node:stream';
import { VoiceVoxReader } from './VoiceVoxReader.js';

export class VoiceReadAloudManager {
  constructor({ voicevoxBaseUrl, defaultSpeakerId, speakerIds }) {
    this.reader = new VoiceVoxReader({
      voicevoxBaseUrl,
      defaultSpeakerId,
      speakerIds,
    });

    this.sessions = new Map();
    this.userSpeakerOverrides = new Map();
  }

  async join(guild, voiceChannel) {
    const voice = await this.loadVoiceModule();

    const prev = this.sessions.get(guild.id);
    if (prev) {
      prev.connection.destroy();
    }

    const player = voice.createAudioPlayer({
      behaviors: {
        noSubscriber: voice.NoSubscriberBehavior.Pause,
      },
    });

    const connection = voice.joinVoiceChannel({
      guildId: guild.id,
      channelId: voiceChannel.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    connection.subscribe(player);
    await voice.entersState(connection, voice.VoiceConnectionStatus.Ready, 20_000);

    this.sessions.set(guild.id, {
      channelId: voiceChannel.id,
      connection,
      player,
      queue: [],
      playing: false,
      voice,
    });
  }

  leave(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) return;

    session.connection.destroy();
    this.sessions.delete(guildId);
  }

  async handleMessage(message) {
    const session = this.sessions.get(message.guild.id);
    if (!session) return;
    if (message.author.bot) return;
    if (message.channelId !== session.channelId) return;

    const text = this.reader.normalizeMessage(message.content);
    if (!text) return;

    
    const speakerId = this.getSpeakerForUser(message.author.id);

    session.queue.push({text, speakerId ,channel: message.channel });

    if (!session.playing) {
      await this.playNext(message.guild.id);
    }
  }

  handleVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const session = this.sessions.get(guildId);
    if (!session) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId !== session.channelId && newChannelId !== session.channelId) return;

    const guild = newState.guild || oldState.guild;
    const channel = guild.channels.cache.get(session.channelId);
    if (!channel) {
      this.leave(guildId);
      return;
    }

    const humanCount = channel.members.filter((member) => !member.user.bot).size;
    if (humanCount === 0) {
      this.leave(guildId);
    }
  }


  setUserSpeaker(userId, speakerId) {
    const normalized = Number(speakerId);
    if (!Number.isInteger(normalized) || normalized <= 0) {
      throw new Error('話者IDは1以上の整数を指定してください。');
    }

    this.userSpeakerOverrides.set(String(userId), normalized);
    return normalized;
  }

  clearUserSpeaker(userId) {
    this.userSpeakerOverrides.delete(String(userId));
  }

  getSpeakerForUser(userId) {
    const key = String(userId);
    if (this.userSpeakerOverrides.has(key)) {
      return this.userSpeakerOverrides.get(key);
    }

    return this.reader.speakerForUser(userId);
  }

  async playNext(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) return;

    const next = session.queue.shift();
    if (!next) {
      session.playing = false;
      return;
    }

    session.playing = true;

    try {
      const audioBuffer = await this.reader.synthesize(next.text, next.speakerId);
      const resource = session.voice.createAudioResource(Readable.from(audioBuffer), {
        inputType: session.voice.StreamType.Arbitrary,
      });

      session.player.play(resource);
      await session.voice.entersState(session.player, session.voice.AudioPlayerStatus.Playing, 10_000);
      await new Promise((resolve) => session.player.once(session.voice.AudioPlayerStatus.Idle, resolve));
    } catch (error) {
      console.error('Failed to play TTS audio:', error);
    }

    await this.playNext(guildId);
  }

  async loadVoiceModule() {
    try {
      return await import('@discordjs/voice');
    } catch {
      throw new Error('Missing dependency: @discordjs/voice. Install it to enable /join read-aloud.');
    }
  }
}
