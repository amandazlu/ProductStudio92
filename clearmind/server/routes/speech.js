import express from "express";
// switch to use openAI instead of Gemini
import { chatResponse } from '../services/openaiService.js'; 
import { generateCalendarEventFromText } from "../services/geminiService.js"; 

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    const reponse = await chatResponse(text);
    // const event = await generateCalendarEventFromText(text);
    res.json(reponse);
  } catch (error) {
    console.error("Error processing speech:", error);
    res.status(500).json({ error: "Failed to process speech" });
  }
});

export default router;
