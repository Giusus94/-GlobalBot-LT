const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { url, key } = req.query;
  if (!url || !key) { res.status(400).json({ error: 'Missing url or key' }); return; }

  try {
    const target = new URL(url);
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: 'GET',
        headers: {
          'x-rapidapi-host': target.hostname,
          'x-rapidapi-key': key,
          'User-Agent': 'Mozilla/5.0',
        }
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
      proxyReq.end();
    });
    res.status(data.status).json(data.body);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
