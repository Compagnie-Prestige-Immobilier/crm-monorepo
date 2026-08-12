/**
 * Nom du throttler dédié à `POST /auth/login`.
 *
 * Il est distinct du throttler par défaut : la limite globale protège le
 * service, celle-ci protège les comptes. Les confondre obligerait à choisir
 * entre « laisser tenter 100 mots de passe par minute » et « brider toute
 * l'API au rythme d'un formulaire de connexion ».
 */
export const LOGIN_THROTTLER = 'login';
