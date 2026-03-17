// dev.mjs — wraps server.js with tsx so TypeScript src/ files are loaded directly.
// Usage: node --import tsx/esm dev.mjs   (via "npm run dev:ts")
//
// This file stays as ESM so it can use top-level await and dynamic import,
// while server.js remains CommonJS.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register tsx transform hook for .ts files required from server.js
register('tsx/cjs', pathToFileURL('./'));

// Now load server.js — all require('./src/api/*.ts') inside it will work
await import('./server.js');
