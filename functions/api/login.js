// LOGIN ENDPOINT — checks email + password, returns a signed session token
// Requires SESSION_SECRET set in Cloudflare Pages > Settings > Variables and Secrets

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

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signToken(email, secret) {
  const payload = JSON.stringify({ email, exp: Date.now() + (30 * 24 * 60 * 60 * 1000) }); // 30-day session
  const payloadB64 = toBase64Url(payload);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigHex = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${payloadB64}.${sigHex}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { email, password } = await request.json();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return new Response(JSON.stringify({ valid: false, error: 'Email and password are required.' }), { status: 400, headers: corsHeaders });
    }

    const db = env.EQUIDRAFT_USERS;
    if (!db) {
      return new Response(JSON.stringify({ valid: false, error: 'Database not connected.' }), { status: 500, headers: corsHeaders });
    }

    const raw = await db.get(cleanEmail);
    if (!raw) {
      return new Response(JSON.stringify({ valid: false, error: 'Email or password is incorrect.' }), { status: 200, headers: corsHeaders });
    }

    const record = JSON.parse(raw);
    if (record.active === false) {
      return new Response(JSON.stringify({ valid: false, error: 'This account is not active. Contact vanessa@chooseparity.com.' }), { status: 200, headers: corsHeaders });
    }

    const attemptHash = await hashPassword(password, record.salt);
    if (attemptHash !== record.hash) {
      return new Response(JSON.stringify({ valid: false, error: 'Email or password is incorrect.' }), { status: 200, headers: corsHeaders });
    }

    if (!env.SESSION_SECRET) {
      return new Response(JSON.stringify({ valid: false, error: 'Server misconfigured — missing SESSION_SECRET.' }), { status: 500, headers: corsHeaders });
    }

    const token = await signToken(cleanEmail, env.SESSION_SECRET);

    return new Response(JSON.stringify({ valid: true, token, email: cleanEmail }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: 'Something went wrong. Please try again.' }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
