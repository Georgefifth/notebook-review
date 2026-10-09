import { publicConfig } from '../config.mjs';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  res.status(200).json(publicConfig());
}
