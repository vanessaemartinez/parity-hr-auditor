// ─────────────────────────────────────────────────────────────────────────────
// EquiDraft Audit Worker — Two-call architecture
// Call 1: Equity audit + scoring (sections only)
// Call 2: Generate both documents
// Run in parallel — both fit in 6000 tokens each, never truncate
// ─────────────────────────────────────────────────────────────────────────────

function parseJSON(text) {
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const first = clean.indexOf('{');
  const last  = clean.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('No JSON object found');
  return JSON.parse(clean.substring(first, last + 1));
}

async function callClaude(apiKey, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (!data.content || !data.content[0]) throw new Error('Empty API response: ' + JSON.stringify(data).substring(0, 200));
  return data.content[0].text || '';
}

// ─── PROMPT 1: AUDIT ONLY ────────────────────────────────────────────────────
function auditPrompt(input) {
  return `You are an equity-centered HR expert. Audit the job document below. Return ONLY the audit JSON — no jobDescription, no jobPosting. Those are handled separately.

CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No text before or after. You MUST close every bracket and brace. Keep ALL explanations to 1-2 sentences maximum. Fit in 5000 tokens.

============================
7 MANDATORY AUDIT RULES
============================

RULE 1 — GENDER-NEUTRAL LANGUAGE (goes in: inclusiveLanguage)
Flag if ANY exist:
- Gendered pronouns: "he," "she," "his," "her," "he/she"
- Gendered descriptors: "salesman," "foreman," "manpower," "guy," "gal," "girl," "guys," "ladies"
- Voice inconsistency: mixing "you will" with "the employee will" or "the candidate must"
NOTE: "HR guy" and "marketing gal" are gendered — always flag them.
ONE item. Flag if found, good if not.

RULE 2 — DISABILITY-INCLUSIVE LANGUAGE (goes in: inclusiveLanguage)
ALWAYS produces at least one item.
A. ABLEIST LANGUAGE — flag if found:
- "able-bodied," "suffer from," "wheelchair-bound," "mentally ill," "crazy," "lame"
- Neurotypical defaults: "always bring positive energy," "high energy," "always on," "upbeat"
- "Fast-paced" or "dynamic" — ALWAYS flag regardless of context or explanation.
B. ACCOMMODATION STATEMENT — ALWAYS flag if missing. Every job (remote, part-time, 1099) needs one. "No physical barriers" never justifies omitting it.
Up to TWO items.

RULE 3 — RACIALLY AND CULTURALLY NEUTRAL LANGUAGE (goes in: inclusiveLanguage)
Flag if ANY exist:
- Subjective affect standards: "positive energy," "positive attitude," "good vibes," "friendly demeanor" — always flag, no exceptions
- "Culture fit" without defining the culture
- "Professional appearance," "well-spoken," "polished," "articulate" without objective standard
- School name-dropping, unpaid trial work
Up to TWO items.

RULE 4 — VAGUE AND CODED PHRASES (goes in: structuralEquity)
Always flag if any appear — context never removes the flag:
"fast-paced," "dynamic," "self-starter," "rockstar," "ninja," "hustle," "wear many hats," "go above and beyond," "culture fit," "passionate," "hit the ground running," "proven ability," "results-driven," "strong work ethic," "entrepreneurial spirit," "thrives under pressure," "positive energy"
ONE item: title must be "One or more vague phrases found — example: '[exact phrase from document]'"

RULE 5 — DEGREE AND CREDENTIAL REQUIREMENTS (goes in: structuralEquity)
Could someone do this job via experience, certification, or training without a four-year degree?
If yes: flag — name the skills, why no degree needed, experience substitute, relevant certs.
If licensed credential required (RN, CPA, LCSW): mark good, explain briefly.
ONE item always present.

RULE 6 — SALARY TRANSPARENCY (goes in: structuralEquity)
Exactly ONE salary finding per document. Salary behind a link = missing — flag it.
SCENARIO A — No salary in document: flag. Give BLS average for this specific role.
SCENARIO B — Range exists: calculate spread = (max-min)/min x 100. Flag if over threshold (50% entry, 65% professional, 80% director).
SCENARIO C — Single figure only: warn, suggest range.
ONE item only — never combine scenarios.

RULE 7 — ADDITIONAL STRUCTURAL BARRIERS (goes in: structuralEquity)
Add only if present beyond Rules 4/5/6:
- Arbitrarily high experience thresholds for the actual duties
- Missing FLSA classification
- Missing location or remote status
- No EEO statement
- Benefits described only as "competitive" with no specifics
- Homogeneous culture signals: "like a family," "we work hard and play hard"
Only flag what is actually in the document.

Return this exact JSON structure:

{
  "score": <0-100>,
  "scoreTitle": "<Needs Significant Work | Developing Foundation | Good Foundation | Strong Equity Practice>",
  "scoreDesc": "<Two short sentences: score meaning, single most important fix.>",
  "documentType": "<job_description | job_posting | mixed | unclear>",
  "documentTypeMessage": "<One sentence: document type detected and why separate JD and posting matters.>",
  "sections": {
    "inclusiveLanguage": {
      "title": "Inclusive Language",
      "severity": "<flag | warn | good>",
      "items": [{"icon":"<🚩|⚠️|✅>","severity":"<flag|warn|good>","title":"<issue>","explanation":"<1-2 sentences>","before":"<exact quote>","after":"<specific fix>","citation":"<one sentence + source>"}]
    },
    "fontAccessibility": {
      "title": "Font and Visual Accessibility",
      "severity": "<flag | warn | good>",
      "items": [{"icon":"<🚩|⚠️|✅>","severity":"<flag|warn|good>","title":"<issue>","explanation":"<1-2 sentences>","before":"<current state>","after":"<specific standard>","citation":"<one sentence + source>"}]
    },
    "screenReader": {
      "title": "Screen Reader Compatibility",
      "severity": "<flag | warn | good>",
      "items": [{"icon":"<🚩|⚠️|✅>","severity":"<flag|warn|good>","title":"<issue>","explanation":"<1-2 sentences>","before":"<current state>","after":"<plain-language fix>","citation":"<one sentence + source>"}]
    },
    "structuralEquity": {
      "title": "Structural Equity and Barriers",
      "severity": "<flag | warn | good>",
      "items": [{"icon":"<🚩|⚠️|✅>","severity":"<flag|warn|good>","title":"<issue>","explanation":"<1-2 sentences>","before":"<exact quote or state>","after":"<specific fix>","citation":"<one sentence + source>"}]
    }
  }
}

DOCUMENT TO AUDIT:
${input}`;
}

// ─── PROMPT 2: DOCUMENTS ONLY ─────────────────────────────────────────────────
function documentsPrompt(input) {
  return `You are an equity-centered HR expert. Using the job document below, generate a complete internal Job Description and a complete external Job Posting. Return ONLY valid JSON — no markdown, no backticks, no text before or after. You MUST close every bracket and brace. Fit in 5000 tokens.

Mark every gap as [MISSING — DATA REQUIRED: explain what is needed]. Use second person (you/your) throughout the Job Posting. Include accommodation and EEO statements in both documents.

Return this exact JSON:

{
  "jobDescription": {
    "requiredFields": ["<specific missing field and why it is needed>"],
    "document": "JOB DESCRIPTION\n\nPOSITION TITLE: [from document or MISSING — DATA REQUIRED: insert official title]\nDEPARTMENT: [from document or MISSING — DATA REQUIRED]\nREPORTS TO: [from document or MISSING — DATA REQUIRED]\nFLSA STATUS: [Exempt or Non-Exempt or MISSING — DATA REQUIRED: confirm with HR or legal counsel]\nPAY BAND: [from document or MISSING — DATA REQUIRED: insert approved salary range]\nLOCATION: [from document or MISSING — DATA REQUIRED: insert location and remote or hybrid status]\nEFFECTIVE DATE: [MISSING — DATA REQUIRED: insert date this description takes effect]\n\nPOSITION SUMMARY\n[2-3 sentences from document content describing role and purpose.]\n\nESSENTIAL FUNCTIONS\n[Numbered list from document. Use actual duties — no generic placeholders.]\n\nMINIMUM QUALIFICATIONS\n[Required qualifications. Include experience substitution options where degree is not required.]\n\nPREFERRED QUALIFICATIONS\n[Qualifications that strengthen candidacy but are not required.]\n\nCOMPETENCIES\n[3-5 competencies from the role responsibilities.]\n\nWORKING CONDITIONS\n[Schedule, remote or hybrid options, travel. From document or MISSING — DATA REQUIRED.]\n\nACCOMMODATION STATEMENT\nReasonable accommodations may be made to enable individuals with disabilities to perform the essential functions of this position. To request an accommodation, contact [MISSING — DATA REQUIRED: insert HR contact email or phone].\n\nEEO STATEMENT\nWe are an equal opportunity employer. We do not discriminate on the basis of race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any other characteristic protected by applicable law."
  },
  "jobPosting": {
    "requiredFields": ["<specific missing field and why it must be completed before posting>"],
    "document": "JOB POSTING\n\n[Position Title]\n[Organization Name — from document or MISSING — DATA REQUIRED]\n[Location and work arrangement — from document or MISSING — DATA REQUIRED]\n[Salary — from document or MISSING — DATA REQUIRED: salary transparency increases qualified applications and reduces pay discrimination]\n\nABOUT THIS ROLE\n[3-4 sentences in second person. Welcoming. From document content.]\n\nWHAT YOU WILL DO\n[Bulleted list using you and your. From document duties.]\n\nWHAT WE ARE LOOKING FOR\n[Required qualifications clearly separated from preferred. Experience substitution options included.]\n\nWHAT WE OFFER\n[MISSING — DATA REQUIRED: insert salary range, benefits, paid time off, retirement, health coverage, mental health benefits, remote options, accommodation process]\n\nOUR COMMITMENT TO EQUAL OPPORTUNITY\nWe are an equal opportunity employer committed to a workplace where every person is treated with dignity and respect. We welcome applicants of all backgrounds, identities, and abilities. We comply with all applicable federal, state, and local equal employment opportunity laws.\n\nHOW TO APPLY\n[Clear instructions. Deadline if known. Note accommodations available. Include alternative method such as email or phone for those who cannot use online portal.]\n\nACCOMMODATION NOTICE\nWe are committed to an accessible application process. If you need an accommodation to apply or interview, please contact [MISSING — DATA REQUIRED: insert HR contact email or phone] before the application deadline."
  }
}

DOCUMENT TO PROCESS:
${input}`;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body      = await request.json();
    const { input } = body;
    const apiKey    = env.ANTHROPIC_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    if (!input)  return new Response(JSON.stringify({ error: 'No input provided' }),      { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Run both calls in parallel — faster than sequential, each safely under token limit
    const [auditText, docsText] = await Promise.all([
      callClaude(apiKey, auditPrompt(input),    6000),
      callClaude(apiKey, documentsPrompt(input), 6000)
    ]);

    let auditResult, docsResult;

    try {
      auditResult = parseJSON(auditText);
    } catch(e) {
      return new Response(JSON.stringify({ error: 'Audit parse error. Model returned: ' + auditText.substring(0, 300) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      docsResult = parseJSON(docsText);
    } catch(e) {
      return new Response(JSON.stringify({ error: 'Documents parse error. Model returned: ' + docsText.substring(0, 300) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Merge into one response for the frontend
    const result = {
      ...auditResult,
      jobDescription: docsResult.jobDescription,
      jobPosting:     docsResult.jobPosting
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Function error: ' + err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
