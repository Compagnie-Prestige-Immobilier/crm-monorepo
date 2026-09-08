import { useState } from 'react';

export function NotificationTemplateRenderScreen({ templateId }: { templateId: string }) {
  const [varKey, setVarKey] = useState('');
  const [varVal, setVarVal] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [renderedText, setRenderedText] = useState<string | null>(null);

  const addVariable = () => {
    if (varKey.trim()) {
      setVariables({ ...variables, [varKey.trim()]: varVal });
      setVarKey('');
      setVarVal('');
    }
  };

  const handleRender = async () => {
    try {
      const res = await fetch(`/api/v1/notification-templates/${templateId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables }),
      });
      const data = await res.json();
      setRenderedText(data.renderedText || 'Aperçu généré.');
    } catch {
      setRenderedText('Erreur lors du rendu du gabarit.');
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px', margin: '1rem 0' }}>
      <h3>Rendu de gabarit de notification ({templateId})</h3>
      <div>
        <h4>Variables :</h4>
        <ul>
          {Object.entries(variables).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong> {v}
            </li>
          ))}
        </ul>
        <div>
          <input
            type="text"
            placeholder="Clé"
            value={varKey}
            onChange={(e) => setVarKey(e.target.value)}
          />
          <input
            type="text"
            placeholder="Valeur"
            value={varVal}
            onChange={(e) => setVarVal(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          />
          <button type="button" onClick={addVariable} style={{ marginLeft: '0.5rem' }}>
            Ajouter variable
          </button>
        </div>
      </div>
      <button type="button" onClick={handleRender} style={{ marginTop: '1rem' }}>
        Générer le rendu
      </button>
      {renderedText && (
        <div style={{ marginTop: '1rem', background: '#f5f5f5', padding: '0.5rem' }}>
          <strong>Aperçu :</strong> {renderedText}
        </div>
      )}
    </div>
  );
}
