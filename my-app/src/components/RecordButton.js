import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/whisper';

export default function RecordButton({ onTranscribed }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorderRef.current.ondataavailable = e => chunks.current.push(e.data);
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/wav' });
      const result = await transcribeAudio(blob);
      onTranscribed(result.text);
    };
    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={`p-2 rounded-lg ${recording ? 'bg-red-500' : 'bg-green-500'}`}
    >
      {recording ? 'Stop Recording' : 'Start Recording'}
    </button>
  );
}

// This uses whisper, but temporarily don't use it to avoid billing issues.
// later we can implement whisper locally or find another solution.
