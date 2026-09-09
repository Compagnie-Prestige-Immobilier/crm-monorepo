import { useState, useRef } from 'react';

export function MediaRecorderScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div
      style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px', margin: '1rem 0' }}
    >
      <h3>Enregistrement de Note Vocale (MediaRecorder)</h3>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {!isRecording ? (
          <button type="button" onClick={startRecording}>
            Démarrer l'enregistrement
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            style={{ background: 'red', color: 'white' }}
          >
            Arrêter l'enregistrement
          </button>
        )}
      </div>
      {audioUrl && (
        <div style={{ marginTop: '1rem' }}>
          <h4>Réécouter la note :</h4>
          <audio src={audioUrl} controls />
        </div>
      )}
    </div>
  );
}
