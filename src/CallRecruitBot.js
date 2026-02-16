import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import cron from 'node-cron';

export class CallRecruitBot {
  constructor(token, textChannelId, voiceChannelId) {
    this.token = token;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
    });
  }

  start() {
    this.client.once('ready', () => {
      console.log(`Logged in as ${this.client.user.tag}`);

      // 毎日21:00に募集
      cron.schedule(
        '0 21 * * *',
        () => this.postRecruitment(),
        { timezone: 'Asia/Tokyo' }
      );
    });

    // ボタン処理
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId !== 'join_vc') return;

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
    });

        // コマンド処理
    this.client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!recruit') {
        await this.postRecruitment();
        await message.reply('通話募集を投稿したよ！');
    }
    });



    this.client.login(this.token);
  }

  async postRecruitment() {
    const channel = await this.client.channels.fetch(this.textChannelId);
    if (!channel || !channel.isTextBased()) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_vc')
        .setLabel('✅ 参加する')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: '📢 **通話募集！**\n参加する人はボタンを押してね！',
      components: [row],
    });
  }
}
