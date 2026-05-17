const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { url, key } = req.query || {};
  if (!url) { res.status(400).json({ error: 'Missing url' }); return; }

  let target;
  try { target = new URL(url); }
  catch { res.status(400).json({ error: 'Invalid url' }); return; }

  const isPost = req.method === 'POST';

  let bodyData = '';
  if (isPost) {
    if (req.body !== undefined && req.body !== null) {
      bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } else {
      bodyData = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', () => resolve(''));
      });
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (GlobalBotLT proxy)',
  };

  if (target.hostname === 'api.anthropic.com') {
    headers['anthropic-version'] = '2023-06-01';
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      res.status(500).json({
        error: { type: 'config_error', message: 'ANTHROPIC_API_KEY non configurata sul server (Vercel → Settings → Environment Variables).' },
      });
      return;
    }
    headers['x-api-key'] = anthropicKey;
  }

  if (target.hostname.includes('rapidapi')) {
    headers['x-rapidapi-host'] = target.hostname;
    headers['x-rapidapi-key'] = key || '';
  }

  if (isPost) {
    headers['Content-Length'] = Buffer.byteLength(bodyData);
  }

  try {
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: target.hostname,
        path: target.pathname + target.search,
        method: isPost ? 'POST' : 'GET',
        headers,
      };

      const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', (c) => chunks.push(c));
        proxyRes.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try { resolve({ status: proxyRes.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: proxyRes.statusCode, body: raw }); }
        });
      });

      proxyReq.on('error', reject);
      if (isPost && bodyData) proxyReq.write(bodyData);
      proxyReq.end();
    });

    res.status(data.status || 502).json(data.body);
  } catch (e) {
    res.status(502).json({ error: { type: 'upstream_error', message: e.message } });
  }
};
