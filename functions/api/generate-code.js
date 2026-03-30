// PRIVATE ADMIN ENDPOINT — generates access codes
// Access at: /api/generate-code?adminKey=YOUR_ADMIN_KEY&type=single OR annual
// Protect this with your ADMIN_KEY secret in Cloudflare Pages Variables and Secrets

function generateCode(type) {
  const prefix = type === 'annual' ? 'EQA' : 'EQS';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = prefix + '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // Admin key check
  const adminKey = url.searchParams.get('adminKey');
  const expectedKey = env.ADMIN_KEY;

  if (!expectedKey || adminKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401, headers: corsHeaders
    });
  }

  const type = url.searchParams.get('type');
  if (!type || !['single', 'annual'].includes(type)) {
    return new Response(JSON.stringify({ error: 'type must be single or annual.' }), {
      status: 400, headers: corsHeaders
    });
  }

  const db = env.EQUIDRAFT_CODES;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not connected.' }), {
      status: 500, headers: corsHeaders
    });
  }

  // Generate a unique code
  let code;
  let attempts = 0;
  do {
    code = generateCode(type);
    const existing = await db.get(code);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  // Build the entry
  const entry = {
    type,
    createdAt: Date.now(),
    used: false,
    usedAt: null,
    expiresAt: type === 'annual' ? Date.now() + (365 * 24 * 60 * 60 * 1000) : null
  };

  await db.put(code, JSON.stringify(entry));

  const expiryDate = type === 'annual'
    ? new Date(entry.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Single use — expires after first session';

  return new Response(JSON.stringify({
    code,
    type,
    expiresAt: expiryDate,
    instructions: type === 'single'
      ? 'Send this code to the customer. It works once, then expires.'
      : `Send this code to the customer. It grants access until ${expiryDate}.`
  }), {
    status: 200, headers: corsHeaders
  });
}
