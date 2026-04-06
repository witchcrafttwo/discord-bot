import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import cron from 'node-cron';
import { VoiceReadAloudManager } from './VoiceReadAloudManager.js';

export class CallRecruitBot {
  constructor(token, textChannelId, voiceChannelId) {
    this.token = token;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;

    this.recruitHour = 22;
    this.recruitMinute = 0;
    this.job = null;

    this.voiceReadAloudManager = new VoiceReadAloudManager({
      voicevoxBaseUrl: process.env.VOICEVOX_API_URL,
      defaultSpeakerId: process.env.VOICEVOX_SPEAKER_ID,
      speakerIds: (process.env.VOICEVOX_SPEAKER_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    });

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  start() {
    this.client.once('clientready', async () => {
      console.log(`Logged in as ${this.client.user.tag}`);

      await this.registerSlashCommands();
      this.scheduleRecruitment();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'recruit') {
          await this.postRecruitment();
          await interaction.reply({
            content: '通話募集を投稿したよ！',
            ephemeral: true,
          });
          return;
        }

        if (interaction.commandName === 'settime') {
          const hour = interaction.options.getInteger('hour');
          const minute = interaction.options.getInteger('minute');

          if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            await interaction.reply({
              content: '正しい時間を入力してください。（例: 22 30）',
              ephemeral: true,
            });
            return;
          }

          this.recruitHour = hour;
          this.recruitMinute = minute;
          this.scheduleRecruitment();

          await interaction.reply({
            content: `募集時間を ${hour}:${minute.toString().padStart(2, '0')} に変更しました。`,
            ephemeral: true,
          });
          return;
        }

        if (interaction.commandName === 'join') {
          const memberChannel = interaction.member?.voice?.channel;

          if (!memberChannel) {
            await interaction.reply({
              content: '先に通話チャンネルへ参加してから /join を実行してね。',
              ephemeral: true,
            });
            return;
          }

          try {
            await this.voiceReadAloudManager.join(interaction.guild, memberChannel);
            await interaction.reply({
              content: `参加したよ！このVCのチャットを読み上げるね（${memberChannel.name}）。`,
              ephemeral: true,
            });
          } catch (error) {
            await interaction.reply({
              content: `読み上げ開始に失敗しました: ${error.message}`,
              ephemeral: true,
            });
          }
          return;
        }

        if (interaction.commandName === 'leave' || interaction.commandName === 'bye') {
          this.voiceReadAloudManager.leave(interaction.guildId);
          await interaction.reply({
            content: 'VCから退出して読み上げを停止しました。',
            ephemeral: true,
          });
        }
      }

      if (interaction.isButton() && interaction.customId === 'join_vc') {
        const guild = interaction.guild;
        const voiceChannel = await guild.channels.fetch(this.voiceChannelId);

        const invite = await voiceChannel.createInvite({
          maxAge: 300,
          maxUses: 1,
        });

        await interaction.reply({
          content: `🔗 ここから参加できるよ！\n${invite.url}`,
          ephemeral: true,
        });
      }
    });

    this.client.on('messageCreate', async (message) => {
      if (!message.guild) return;
      await this.voiceReadAloudManager.handleMessage(message);
    });

    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.voiceReadAloudManager.handleVoiceStateUpdate(oldState, newState);
    });

    this.client.login(this.token);
  }

  scheduleRecruitment() {
    if (this.job) {
      this.job.stop();
    }

    this.job = cron.schedule(
      `${this.recruitMinute} ${this.recruitHour} * * *`,
      () => this.postRecruitment(),
      { timezone: 'Asia/Tokyo' }
    );

    console.log(`Recruit time set to ${this.recruitHour}:${this.recruitMinute}`);
  }

  async registerSlashCommands() {
    const commands = [
      {
        name: 'recruit',
        description: '通話募集を投稿する',
      },
      {
        name: 'settime',
        description: '募集時間を変更する',
        options: [
          {
            name: 'hour',
            description: '0〜23の時間',
            type: 4,
            required: true,
          },
          {
            name: 'minute',
            description: '0〜59の分',
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: 'join',
        description: '参加中のVCへBOTを参加させ、VCチャットを読み上げる',
      },
      {
        name: 'leave',
        description: 'VCからBOTを退出させて読み上げを停止する',
      },
      {
        name: 'bye',
        description: 'leaveの別名（VCから退出）',
      },
    ];

    await this.client.application.commands.set(commands);
    console.log('Slash commands registered.');
  }

  async postRecruitment() {
    const channel = await this.client.channels.fetch(this.textChannelId);
    if (!channel || !channel.isTextBased()) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_vc').setLabel('参加する').setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: '@here\n📢 **通話募集！**\n参加する人はボタンを押してね！',
      components: [row],
    });
  }
}
