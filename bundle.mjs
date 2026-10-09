import { build } from 'esbuild';
export async function realtimeBundle() {
  const result = await build({ entryPoints: [new URL('./client/realtime-entry.mjs', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, write: false });
  return result.outputFiles[0].text;
}
