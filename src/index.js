import 'dotenv/config';
import { CallRecruitBot } from './CallRecruitBot.js';

const app = new CallRecruitBot(
  process.env.token,
  process.env.TEXT_CHANNEL_ID,
  process.env.VOICE_CHANNEL_ID
);

app.start();
