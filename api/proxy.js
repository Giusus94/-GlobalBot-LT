const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { url, key } = req.query;
  if (!url) { res.status(400).json({ error: 'Missing url' }); return; }

  try {
    const target = new URL(url);
    const isPost = req.method === 'POST';

    // Raccogli body se POST
    let bodyData = '';
    if (isPost) {
      await new Promise((resolve) => {
        req.on('data', chunk => bodyData += chunk);
        req.on('end', resolve);
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    };

    // Anthropic API
    if (target.hostname === 'api.anthropic.com') {
      // Leggi x-api-key dal body o dall'header
      headers['anthropic-version'] = '2023-06-01';
      // La chiave Anthropic viene iniettata lato server dalla env var
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) headers['x-api-key'] = anthropicKey;
    }

    // RapidAPI
    if (target.hostname.includes('rapidapi')) {
      headers['x-rapidapi-host'] = target.hostname;
      headers['x-rapidapi-key'] = key || '';
    }

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: isPost ? 'POST' : 'GET',
        headers: isPost
          ? { ...headers, 'Content-Length': Buffer.byteLength(bodyData) }
          : headers,
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          try { resolve({ status: proxyRes.statusCode, body: JSON.parse(body) }); }
          catch(e) { resolve({ status: proxyRes.statusCode, body }); }
        });
      });

      proxyReq.on('error', reject);
      if (isPost && bodyData) proxyReq.write(bodyData);
      proxyReq.end();
    });

    res.status(data.status).json(data.body);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
