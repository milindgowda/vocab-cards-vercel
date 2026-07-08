import { put, list, del } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { user } = req.query;
    const userKey = user || "default_user";
    const filename = `gre_vocab_state_${userKey}.json`;

    // 1. GET Method: Retrieve stored files perfectly
    if (req.method === 'GET') {
      console.log(`[VERCEL-BLOB] Scanning for file matching: ${filename}`);
      
      const { blobs } = await list({ prefix: filename });
      
      if (blobs.length === 0) {
        return res.status(200).json({});
      }

      // Read the newest file entry version out of the CDN cache pool
      const targetBlob = blobs.find(b => b.pathname === filename) ||
      blobs.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt))[0];
      const response = await fetch(targetBlob.url);
      const data = await response.json();
      
      return res.status(200).json(data);
    }

    // 2. POST Method: Accepts dynamic payload configs safely
    if (req.method === 'POST') {
      const body = req.body;
      console.log(`[VERCEL-BLOB] Writing configuration state data for profile: ${userKey}`);

      // Pass-through whatever configuration payload object the client application sent
      const payload = {
        ...body,
        updated_at: new Date().toISOString()
      };

      const { blobs } = await list({ prefix: filename });
      
      const blobResult = await put(filename, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: false, 
        allowOverwrite: true    
      });

      if (blobs.length > 0) {
        const oldUrls = blobs.filter(b => b.url !== blobResult.url).map(b => b.url);
        if (oldUrls.length > 0) {
          await del(oldUrls);
        }
      }

      return res.status(200).json({ success: true, url: blobResult.url });
    }

    return res.status(405).send('Method Not Allowed');

  } catch (globalErr) {
    console.error(`[VERCEL-BLOB] CRITICAL SERVER SYSTEM CRASH:`, globalErr);
    return res.status(500).json({ 
      error: "Internal Blob Store Exception Handler", 
      details: globalErr.message 
    });
  }
}
