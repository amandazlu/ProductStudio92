import { useState, useEffect, useRef } from 'react';

export default function useSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(''); // added state for easy access
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event) => {
        const text = event.results[0][0].transcript;
        transcriptRef.current = text;
        setTranscript(text); // update state so components can react
        setIsRecording(false);
      };

      recognitionInstance.onerror = () => setIsRecording(false);
      recognitionInstance.onend = () => setIsRecording(false);

      recognitionRef.current = recognitionInstance;
    } else {
      console.warn('Speech recognition not supported in this browser.');
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return { isRecording, toggleRecording, transcript, transcriptRef };
}
