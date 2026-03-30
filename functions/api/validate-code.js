export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ valid: false, error: 'No code provided.' }), {
        status: 400, headers: corsHeaders
      });
    }

    const key = code.trim().toUpperCase();
    const db = env.EQUIDRAFT_CODES;

    if (!db) {
      return new Response(JSON.stringify({ valid: false, error: 'Database not connected.' }), {
        status: 500, headers: corsHeaders
      });
    }

    // Look up the code
    const raw = await db.get(key);

    if (!raw) {
      return new Response(JSON.stringify({ valid: false, error: 'This code was not found. Please check your purchase confirmation email and try again.' }), {
        status: 200, headers: corsHeaders
      });
    }

    let entry;
    try {
      entry = JSON.parse(raw);
    } catch(e) {
      return new Response(JSON.stringify({ valid: false, error: 'Code data is invalid. Please contact vanessa@chooseparity.com.' }), {
        status: 200, headers: corsHeaders
      });
    }

    // Check if already used (single-use codes)
    if (entry.type === 'single' && entry.used) {
      return new Response(JSON.stringify({ valid: false, error: 'This code has already been used. Single Draft codes are valid for one use. Purchase a new draft at chooseparity.com/equidraft.' }), {
        status: 200, headers: corsHeaders
      });
    }

    // Check expiry (annual codes)
    if (entry.type === 'annual' && entry.expiresAt) {
      const now = Date.now();
      if (now > entry.expiresAt) {
        return new Response(JSON.stringify({ valid: false, error: 'This code has expired. Please renew your EquiDraft annual subscription at chooseparity.com/equidraft.' }), {
          status: 200, headers: corsHeaders
        });
      }
    }

    // Code is valid — mark single-use codes as used
    if (entry.type === 'single') {
      entry.used = true;
      entry.usedAt = Date.now();
      await db.put(key, JSON.stringify(entry));
    }

    return new Response(JSON.stringify({
      valid: true,
      type: entry.type,
      message: entry.type === 'single'
        ? 'Access granted. This is a single-use code — it will not work again after this session.'
        : 'Access granted. Your annual access is active.'
    }), {
      status: 200, headers: corsHeaders
    });

  } catch(err) {
    return new Response(JSON.stringify({ valid: false, error: 'Something went wrong. Please try again or contact vanessa@chooseparity.com.' }), {
      status: 500, headers: corsHeaders
    });
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
