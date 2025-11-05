export async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
  
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/whisper`, {
      method: 'POST',
      body: formData,
    });
  
    if (!response.ok) throw new Error('Whisper API failed');
    return await response.json(); // { text: "transcribed speech" }
  }
  