const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let prompt, apiKey;

  try {
    const parsed = JSON.parse(event.body);
    prompt = parsed.prompt;
    apiKey = parsed.apiKey;
  } catch(e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body: ' + e.message })
    };
  }

  if (!apiKey) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No API key provided' })
    };
  }

  if (!prompt) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No prompt provided' })
    };
  }

  const requestBody = JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: res.statusCode === 200 ? data : JSON.stringify({ error: 'Anthropic returned: ' + data })
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'HTTPS error: ' + err.message })
      });
    });

    req.setTimeout(25000, () => {
      req.destroy();
      resolve({
        statusCode: 504,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request timed out after 25 seconds' })
      });
    });

    req.write(requestBody);
    req.end();
  });
};
