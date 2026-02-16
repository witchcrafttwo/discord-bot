import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import cron from 'node-cron';

export class CallRecruitBot {
  constructor(token, textChannelId, voiceChannelId) {
    this.token = token;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;

    this.recruitHour = 22; // デフォルト
    this.recruitMinute = 0;
    this.job = null;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
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

      // ===== スラッシュコマンド =====
      if (interaction.isChatInputCommand()) {

        // /recruit
        if (interaction.commandName === 'recruit') {
          await this.postRecruitment();
          await interaction.reply({
            content: '通話募集を投稿したよ！',
            ephemeral: true
          });
        }

        // /settime
        if (interaction.commandName === 'settime') {

  const hour = interaction.options.getInteger('hour');
  const minute = interaction.options.getInteger('minute');

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    await interaction.reply({
      content: '正しい時間を入力してください。（例: 22 30）',
      ephemeral: true
    });
    return;
  }

  this.recruitHour = hour;
  this.recruitMinute = minute;

  this.scheduleRecruitment();

  await interaction.reply({
    content: `募集時間を ${hour}:${minute.toString().padStart(2,'0')} に変更しました。`,
    ephemeral: true
  });
}
}

      // ===== ボタン処理 =====
      if (interaction.isButton()) {
        if (interaction.customId === 'join_vc') {
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
      }
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
      description: '通話募集を投稿する'
    },
    {
      name: 'settime',
      description: '募集時間を変更する',
      options: [
        {
          name: 'hour',
          description: '0〜23の時間',
          type: 4,
          required: true
        },
        {
          name: 'minute',
          description: '0〜59の分',
          type: 4,
          required: true
        }
      ]
    }
  ];

  await this.client.application.commands.set(commands);
  console.log('Slash commands registered.');
}


  async postRecruitment() {
    const channel = await this.client.channels.fetch(this.textChannelId);
    if (!channel || !channel.isTextBased()) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_vc')
        .setLabel('参加する')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: '@here\n📢 **通話募集！**\n参加する人はボタンを押してね！',
      components: [row],
    });
  }
}
