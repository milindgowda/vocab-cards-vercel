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

    // 1. GET Method: Pull the static file using prefix matching
    if (req.method === 'GET') {
      console.log(`[VERCEL-BLOB] Scanning for file matching: ${filename}`);
      
      const { blobs } = await list({ prefix: filename });
      
      if (blobs.length === 0) {
        return res.status(200).json({ scores: {} });
      }

      // Sort by uploaded date to guarantee we read the latest configuration state
      const targetBlob = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const response = await fetch(targetBlob.url);
      const data = await response.json();
      
      return res.status(200).json(data);
    }

    // 2. POST Method: Overwrite the static file 
    if (req.method === 'POST') {
      const body = req.body;
      console.log(`[VERCEL-BLOB] Writing progress state for user: ${userKey}`);

      const payload = {
        scores: body.scores || {},
        updated_at: new Date().toISOString()
      };

      // Search for any existing iterations matching the profile ID prefix
      const { blobs } = await list({ prefix: filename });
      
      // Upload the new file configuration state cleanly 
      const blobResult = await put(filename, JSON.stringify(payload), {
        access: 'public',
        addRandomSuffix: false, // <-- CRUCIAL FIX: Retain clean static filenames so your loader can look it up
        allowOverwrite: true    // <-- CRUCIAL FIX: Let the user key save update over old sessions safely
      });

      // Clear out the older iterations in the background to prevent duplicate reads
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
    console.error(`[VERCEL-BLOB] SYSTEM LAYER EXECUTION CRASH:`, globalErr);
    return res.status(500).json({ 
      error: "Internal Blob Store Exception Handler", 
      details: globalErr.message 
    });
  }
}
