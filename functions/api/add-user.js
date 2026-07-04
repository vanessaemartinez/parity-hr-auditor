// PRIVATE ADMIN ENDPOINT — creates a buyer account after you see their Squarespace order
// Use at: /api/add-user?adminKey=YOUR_ADMIN_KEY&email=buyer@example.com&password=SomePassword123
// Protect this with your existing ADMIN_KEY secret in Cloudflare Pages > Settings > Variables and Secrets

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const adminKey = url.searchParams.get('adminKey');
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
  }

  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const password = url.searchParams.get('password') || '';

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required.' }), { status: 400, headers: corsHeaders });
  }
  if (!password || password.length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), { status: 400, headers: corsHeaders });
  }

  const db = env.EQUIDRAFT_USERS;
  if (!db) {
    return new Response(JSON.stringify({ error: 'EQUIDRAFT_USERS KV namespace not bound. Add it in Cloudflare Pages > Settings > Functions.' }), { status: 500, headers: corsHeaders });
  }

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);

  await db.put(email, JSON.stringify({
    salt, hash,
    createdAt: Date.now(),
    active: true
  }));

  return new Response(JSON.stringify({
    success: true,
    email,
    message: `Account created for ${email}. Send them their email and the password you just set — they can log in at equidraft.chooseparity.com.`
  }), { status: 200, headers: corsHeaders });
}
