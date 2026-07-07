import { put, list, del } from '@vercel/blob';

export default async function handler(req, res) {
  // 1. Enable CORS policies for cross-device browser operations
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

    // 2. GET Method: Find and read your state file out of the Blob storage
    if (req.method === 'GET') {
      console.log(`[VERCEL-BLOB] Scanning for file matching user profile: ${userKey}`);
      
      // Look up files matching this profile name prefix
      const { blobs } = await list({ prefix: filename });
      
      if (blobs.length === 0) {
        return res.status(200).json({ scores: {} });
      }

      // Download the stored JSON file payload directly from Vercel's global CDN network
      const targetBlob = blobs[0];
      const response = await fetch(targetBlob.url);
      const data = await response.json();
      
      return res.status(200).json(data);
    }

    // 3. POST Method: Overwrite your state file inside Blob storage
    if (req.method === 'POST') {
      const body = req.body;
      console.log(`[VERCEL-BLOB] Updating state parameters file for user: ${userKey}`);

      const payload = {
        scores: body.scores || {},
        updated_at: new Date().toISOString()
      };

      // Clean up any old staging versions under this file name signature to save space
      const { blobs } = await list({ prefix: filename });
      if (blobs.length > 0) {
        await del(blobs.map(b => b.url));
      }

      // Upload the raw text file safely 
      const blobResult = await put(filename, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: true // Best practice for Vercel CDN asset caching cycles
      });

      return res.status(200).json({ success: true, url: blobResult.url });
    }

    return res.status(405).send('Method Not Allowed');

  } catch (globalErr) {
    console.error(`[VERCEL-BLOB] CRITICAL SERVER SYSTEM EXECUTION CRASH:`, globalErr);
    return res.status(500).json({ 
      error: "Internal Blob Store Exception Handler Triggered", 
      details: globalErr.message 
    });
  }
}
