export function publicConfig(env = process.env) {
  const url = env.SUPABASE_URL || '';
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  let valid = false;
  try { const parsed = new URL(url); valid = parsed.protocol === 'https:' && parsed.pathname === '/' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash; } catch {}
  let publicOnly = publicKey.startsWith('sb_publishable_');
  if (!publicOnly) {
    try { const part = publicKey.split('.')[1]; const payload = JSON.parse(Buffer.from(part, 'base64url').toString()); publicOnly = payload.role === 'anon'; } catch {}
  }
  if (!valid || !publicOnly) return { configured: false };
  return { configured: true, url: url.replace(/\/$/, ''), publicKey };
}
