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
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonString = completion.choices[0].message.content.trim();
  return JSON.parse(jsonString);
}
