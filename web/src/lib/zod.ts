import { z } from 'zod';

// La sonde `Function("")` de zod déclenche un rapport CSP à chaque page.
z.config({ jitless: true });

export { z };
