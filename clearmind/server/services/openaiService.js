import fs from 'fs';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCalendarEventFromText(text) {
  const prompt = `
    Extract a Google Calendar event from this text. Return JSON:
    {"title":"", "description":"", "start":"ISO string", "end":"ISO string"}

    Text: ${text}
  `;

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonString = completion.choices[0].message.content.trim();
  return JSON.parse(jsonString);
}

export async function chatResponse(text) {
  const prompt = `
    You are speaking to someone who has a lot going on... they are caring for their aging family members while also supporting their children and spouse. Respond empathically

    Text: ${text}
  `;
  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonString = completion.choices[0].message.content.trim();

  return jsonString;
}
