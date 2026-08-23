'use client';

/**
 * Dernier recours : une erreur dans `layout.tsx` racine emporte le document
 * entier, `<html>` compris. Ce fichier le reconstruit, donc sans police, sans
 * feuille de style et sans aucun composant du panneau — tout ce qui pourrait
 * relever de la panne est écarté.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#FAF7F7',
          color: '#140206',
        }}
      >
        <main id="contenu-principal" style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>CPI GO n’a pas pu démarrer</h1>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Aucune donnée n’a été perdue. Réessayez&nbsp;; si l’écran revient, prévenez
            l’administrateur.
          </p>
          {error.digest === undefined ? null : (
            <p style={{ fontSize: '0.75rem' }}>
              Code à communiquer&nbsp;:{' '}
              <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              minHeight: '2.75rem',
              padding: '0 1.25rem',
              borderRadius: '0.5rem',
              border: 0,
              background: '#140206',
              color: '#FAF7F7',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
