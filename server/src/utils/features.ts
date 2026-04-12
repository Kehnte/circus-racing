// features.ts — Feature flag registry read from environment variables.
// Each flag defaults to enabled; set to "false" to disable.
// Imported by server.ts to gate routes and Socket.IO polling.

export const FEATURES = {
  OCR:       process.env.FEATURE_OCR       !== 'false',
  STREAMING: process.env.FEATURE_STREAMING !== 'false',
} as const;

export type FeatureMap = typeof FEATURES;
