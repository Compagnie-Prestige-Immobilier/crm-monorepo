/**
 * Ce qu'une carte de graphique montre quand sa série est vide.
 *
 * Sans lui, Chart.js dessine des axes nus, ce qui se lit comme un chargement
 * qui n'aboutit pas plutôt que comme une absence de données.
 */
export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="text-[0.8125rem] text-muted-foreground">{message}</p>
    </div>
  );
}
