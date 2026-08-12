import 'reflect-metadata';
import './load-env.js';

import { createApiApp } from './bootstrap.js';
import { readEnv } from './env.js';

const env = readEnv();
const app = await createApiApp();

await app.listen(env.PORT, '0.0.0.0');
