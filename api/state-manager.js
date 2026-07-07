import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 1. Handle CORS Preflight checks cleanly for secure mobile mapping
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Parse out unique User Profile ID parameters securely
    const { user } = req.query;
    const userKey = user || "default_user";
    const redisKey = `gre_vocab_state:${userKey}`;

    // 3. GET Method: Retrieve data blocks from Vercel KV Redis database
    if (req.method === 'GET') {
      console.log(`[VERCEL-KV] Fetching state parameters for key: ${redisKey}`);
      const savedState = await kv.get(redisKey);
      
      return res.status(200).json(savedState || { scores: {} });
    }

    // 4. POST Method: Store progress matrix parameters inside Vercel KV Redis database
    if (req.method === 'POST') {
      const body = req.body;
      console.log(`[VERCEL-KV] Writing progress parameters for key: ${redisKey}`);
      
      const payload = {
        scores: body.scores || {},
        updated_at: new Date().toISOString()
      };
      
      await kv.set(redisKey, payload);
      return res.status(200).json({ success: true });
    }

    return res.status(405).send('Method Not Allowed');

  } catch (globalErr) {
    console.error(`[VERCEL-KV] SYSTEM ERROR:`, globalErr);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: globalErr.message 
    });
  }
}
