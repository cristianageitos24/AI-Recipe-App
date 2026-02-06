#!/usr/bin/env node
/**
 * Start Next.js dev server with Webpack (Turbopack disabled)
 * This avoids Windows resource errors (os error 1450) when processing PostCSS
 */

// Override process.argv to pass --webpack flag
process.argv = [
  process.argv[0],
  process.argv[1],
  'dev',
  '--webpack',
  ...process.argv.slice(2)
];

require('next/dist/bin/next');
