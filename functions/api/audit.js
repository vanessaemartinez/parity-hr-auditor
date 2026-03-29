export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { input } = body;
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!input) {
      return new Response(
        JSON.stringify({ error: 'No input provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are an equity-centered HR expert. Audit this job document and respond with ONLY a valid JSON object, no markdown, no backticks, no other text before or after.

Use exactly this JSON structure with real analysis of the document:
{"score":75,"scoreTitle":"Good Foundation","scoreDesc":"One sentence summary.","documentType":"job_posting","documentTypeMessage":"One sentence about what was detected.","sections":{"inclusiveLanguage":{"title":"Inclusive Language","severity":"warn","items":[{"icon":"⚠️","severity":"warn","title":"Issue title","explanation":"Why it matters","before":"original text","after":"improved text","citation":"Source"}]},"fontAccessibility":{"title":"Font and Visual Accessibility","severity":"good","items":[{"icon":"✅","severity":"good","title":"Assessment","explanation":"Finding","before":"","after":"","citation":"WCAG 2.1"}]},"screenReader":{"title":"Screen Reader Compatibility","severity":"warn","items":[{"icon":"⚠️","severity":"warn","title":"Issue","explanation":"Impact","before":"original","after":"improved","citation":"Section 508"}]},"structuralEquity":{"title":"Structural Equity and Barriers","severity":"flag","items":[{"icon":"🚩","severity":"flag","title":"Barrier","explanation":"Why inequitable","before":"original","after":"equitable","citation":"Research"}]}},"jobDescription":{"requiredFields":["List missing required fields"],"document":"JOB DESCRIPTION\n\nPOSITION TITLE\n[Title]\n\nSUMMARY\n[Summary under 100 words]"},"jobPosting":{"requiredFields":["List missing fields"],"document":"JOB POSTING\n\n[Title]\n\nABOUT THE ROLE\n[Under 100 words]\n\nTO APPLY\n[Instructions]"}}

Keep ALL text values under 80 words. Keep document fields under 200 words total. Return only the JSON.

DOCUMENT TO AUDIT:
${input}`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await anthropicResponse.json();

    if (!data.content || !data.content[0]) {
      return new Response(
        JSON.stringify({ error: 'Unexpected API response: ' + JSON.stringify(data).substring(0, 200) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const text = data.content[0].text || '';
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch(e) {
      return new Response(
        JSON.stringify({ error: 'Parse error. Model returned: ' + clean.substring(0, 300) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Function error: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
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
