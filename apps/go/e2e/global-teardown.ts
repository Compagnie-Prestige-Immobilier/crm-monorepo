import { supprimerComptes } from './comptes';

export default async function globalTeardown(): Promise<void> {
  await supprimerComptes();
}
