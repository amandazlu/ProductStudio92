// server/services/geminiService.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateCalendarEventFromText(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a smart assistant that extracts event information from spoken text
      and converts it into a Google Calendar event. Return ONLY valid JSON in this format:

      {
        "summary": "Event title",
        "description": "Optional description",
        "start": "2025-11-12T15:00:00-05:00",
        "end": "2025-11-12T15:30:00-05:00"
      }

      The "start" and "end" fields must be ISO 8601 date-time strings. Default duration: 30 minutes.

      User text: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(" Gemini raw output:\n", responseText); 

    let cleanText = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

    // Try to parse the JSON from the model's text'
    const eventData = JSON.parse(cleanText);

    console.log(" Event data:\n", eventData); 

    return eventData;

  } catch (err) {
    console.error("Error generating event:", err);
    throw err;
  }
}
