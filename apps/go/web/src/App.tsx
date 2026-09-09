import { useState } from 'react';
import { BankCaseCorrectionScreen } from './components/BankCaseCorrectionScreen';
import { NotificationTemplateRenderScreen } from './components/NotificationTemplateRenderScreen';
import { MediaRecorderScreen } from './components/MediaRecorderScreen';

export function App() {
  const [activeTab, setActiveTab] = useState<'bank' | 'template' | 'voice'>('bank');

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>CPI Monorepo v2</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('bank')}
          style={{ fontWeight: activeTab === 'bank' ? 'bold' : 'normal' }}
        >
          Correction Dossier Bancaire
        </button>
        <button
          onClick={() => setActiveTab('template')}
          style={{ fontWeight: activeTab === 'template' ? 'bold' : 'normal' }}
        >
          Rendu Gabarit Notification
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          style={{ fontWeight: activeTab === 'voice' ? 'bold' : 'normal' }}
        >
          Note Vocale (MediaRecorder)
        </button>
      </div>

      {activeTab === 'bank' && <BankCaseCorrectionScreen caseId="BC-001" />}
      {activeTab === 'template' && <NotificationTemplateRenderScreen templateId="NT-001" />}
      {activeTab === 'voice' && <MediaRecorderScreen />}
    </div>
  );
}
