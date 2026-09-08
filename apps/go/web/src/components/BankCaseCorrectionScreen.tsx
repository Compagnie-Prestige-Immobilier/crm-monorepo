import { useState, type FormEvent } from 'react';

export function BankCaseCorrectionScreen({ caseId }: { caseId: string }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/bank-cases/${caseId}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details }),
      });
      const data = await res.json();
      setStatus(data.message || 'Correction envoyée.');
    } catch {
      setStatus('Erreur lors de l\'envoi de la correction.');
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px', margin: '1rem 0' }}>
      <h3>Correction de dossier bancaire ({caseId})</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Motif de correction : </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <label>Détails : </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        <button type="submit" style={{ marginTop: '0.5rem' }}>Soumettre la correction</button>
      </form>
      {status && <p style={{ marginTop: '0.5rem', color: 'green' }}>{status}</p>}
    </div>
  );
}
