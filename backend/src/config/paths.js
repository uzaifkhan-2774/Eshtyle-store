import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Absolute path of the backend folder, so uploads/.env are found no matter which folder the server is started from.
export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
