import express from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/openaiService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const transcription = await transcribeAudio(req.file.path);
    res.json({ text: transcription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Whisper transcription failed' });
  }
});

export default router;
