// ─────────────────────────────────────────────────────────────────────────────
// EquiDraft Audit Worker — Two-call architecture
// Call 1: Equity audit + scoring (sections only)
// Call 2: Generate both documents
// Run in parallel — both fit in 6000 tokens each, never truncate
// ─────────────────────────────────────────────────────────────────────────────

function parseJSON(text) {
  // Strip ALL markdown fences anywhere in the text
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const first = clean.indexOf('{');
  const last  = clean.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('No JSON object found in: ' + clean.substring(0, 100));
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

════════════════════════════════════════
MANDATORY LANGUAGE RULES — APPLY IN BOTH DOCUMENTS
Do not copy problematic language from the original. Rewrite every instance.
════════════════════════════════════════

RULE A — REMOVE ALL GENDERED LANGUAGE
Never use: "he," "she," "his," "her," "he/she," "guy," "gal," "girl," "guys," "ladies."
Rewrite gendered descriptions with neutral alternatives.
Example: "HR guy Matt and marketing gal Callie" → "HR professional Matt and marketing professional Callie"

RULE B — REMOVE ALL VAGUE AND CODED PHRASES
Never use these words anywhere in either document. Replace every instance with specific, plain-language alternatives:
- "fast-paced" → describe the actual work: "you will manage multiple client accounts simultaneously with shifting weekly priorities"
- "dynamic" → describe what actually changes: "priorities and client needs shift week to week"
- "self-starter" → "you manage your own schedule and deadlines without daily supervision"
- "passionate" → name the actual skill or commitment required
- "rockstar," "ninja," "hustle" → remove entirely, describe the actual work
- "go above and beyond" → describe the actual expectation specifically
- "strong work ethic" → name the observable behavior
- "positive energy" → remove entirely — this is a subjective, culturally-defined standard that excludes candidates with depression, chronic illness, or different cultural communication styles. Do not include it in either document in any form.
- "entrepreneurial spirit" → describe the actual independent work expected
- "thrives under pressure" → describe the actual working conditions specifically
- "wear many hats" → list the actual variety of responsibilities

RULE C — REMOVE NEUROTYPICAL AND ABLEIST DEFAULTS
Never imply a high-energy, always-available, or neurotypical default is required.
Remove or rewrite: "always bring positive energy," "high energy," "always on," "upbeat," "enthusiastic" as a requirement.

════════════════════════════════════════
DOCUMENT STRUCTURE RULES
These two documents serve different audiences and must be structured accordingly.
════════════════════════════════════════

JOB DESCRIPTION — INTERNAL HR DOCUMENT ONLY
- Purpose: internal filing, HRIS, compensation benchmarking, performance management
- Audience: HR team, hiring manager, legal — NOT candidates
- Do NOT include: company origin story, founder bios, marketing copy, culture descriptions, "about us" narrative
- DO include: all administrative fields, competencies, working conditions, legal statements
- Tone: precise, functional, compliance-focused

JOB POSTING — EXTERNAL CANDIDATE-FACING DOCUMENT
- Purpose: attract qualified, diverse applicants
- Audience: candidates — write in second person (you/your) throughout
- DO include: company story and context (1-2 sentences), reporting structure (who they report to), salary or salary range, schedule and hours, FLSA status, work arrangement (remote/hybrid/on-site), benefits
- Tone: warm, plain, direct, welcoming

Mark every gap as [MISSING — DATA REQUIRED: explain specifically what is needed and why].
Include accommodation and EEO statements in BOTH documents.

Return this exact JSON:

{
  "jobDescription": {
    "requiredFields": ["<specific missing field and why it is needed internally>"],
    "document": "JOB DESCRIPTION\n\nPOSITION TITLE: [from document or MISSING — DATA REQUIRED: insert official position title]\nDEPARTMENT: [from document or MISSING — DATA REQUIRED: insert department name]\nREPORTS TO: [from document or MISSING — DATA REQUIRED: insert direct supervisor title]\nFLSA STATUS: [Exempt or Non-Exempt based on salary and duties — or MISSING — DATA REQUIRED: confirm with HR or legal counsel before filing]\nPAY BAND: [from document or MISSING — DATA REQUIRED: insert approved salary range before filing — required for compensation benchmarking]\nLOCATION: [from document or MISSING — DATA REQUIRED: insert work location and remote, hybrid, or on-site status]\nEFFECTIVE DATE: [MISSING — DATA REQUIRED: insert the date this description takes effect]\n\nPOSITION SUMMARY\n[2-3 sentences describing the role, its purpose, and how it fits the organization. Use document content. No marketing language.]\n\nESSENTIAL FUNCTIONS\n[Numbered list of core responsibilities drawn directly from the document. Use actual duties — no generic placeholders. Rewrite any vague language into specific, observable tasks.]\n\nMINIMUM QUALIFICATIONS\n[Required education, experience, and skills. Where a degree is not legally required for this work, include: 'Or equivalent combination of education and experience.' List relevant certifications as alternatives to degree where appropriate.]\n\nPREFERRED QUALIFICATIONS\n[Qualifications that strengthen a candidacy but are not required to perform the core functions.]\n\nCOMPETENCIES\n[3-5 observable, measurable competencies drawn from the actual role responsibilities. No personality traits.]\n\nWORKING CONDITIONS\n[Schedule, hours per week, remote or hybrid arrangement, travel requirements. From document or MISSING — DATA REQUIRED.]\n\nACCOMMODATION STATEMENT\nReasonable accommodations may be made to enable individuals with disabilities to perform the essential functions of this position. To request an accommodation, contact [MISSING — DATA REQUIRED: insert HR contact name, email, and phone number].\n\nEEO STATEMENT\nWe are an equal opportunity employer. We do not discriminate on the basis of race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any other characteristic protected by applicable law."
  },
  "jobPosting": {
    "requiredFields": ["<specific missing field that must be completed before this posting goes public>"],
    "document": "JOB POSTING\n\n[Position Title]\n[Organization Name — from document or MISSING — DATA REQUIRED]\n[Location | Work arrangement: Remote, Hybrid, or On-Site — from document or MISSING — DATA REQUIRED]\n[Salary or salary range — from document or MISSING — DATA REQUIRED: candidates deserve to know compensation before investing time in an application. Salary transparency reduces pay gaps and increases qualified applicants.]\n[Schedule and hours — from document or MISSING — DATA REQUIRED: e.g. Full-time, Part-time, expected hours per week]\n[FLSA Status: Exempt or Non-Exempt — from document or MISSING — DATA REQUIRED: required by law to disclose]\n[Reports to: supervisor title — from document or MISSING — DATA REQUIRED]\n\nABOUT [ORGANIZATION NAME]\n[1-2 sentences describing what the organization does, who it serves, and why the work matters. From document content. Warm, plain language. No jargon.]\n\nABOUT THIS ROLE\n[3-4 sentences in second person describing what you will do and why this role matters. Welcoming language. Drawn from document. No vague phrases.]\n\nWHAT YOU WILL DO\n[Bulleted list of key responsibilities in plain language. Use you and your throughout. Drawn from document duties. Rewrite any vague language into specific, observable tasks.]\n\nWHAT WE ARE LOOKING FOR\nRequired:\n[Required qualifications listed clearly. Where a degree is not legally required, include: Or equivalent combination of relevant experience and training.]\n\nPreferred:\n[Qualifications that would strengthen your application but are not required.]\n\nWHAT WE OFFER\n[MISSING — DATA REQUIRED: insert salary or salary range, health insurance details, paid time off, retirement plan, mental health benefits, disability coverage, remote work stipend or equipment, professional development budget, and any other benefits. Candidates cannot assess whether this role is right for them without this information.]\n\nOUR COMMITMENT TO EQUAL OPPORTUNITY\nWe are an equal opportunity employer committed to a workplace where every person is treated with dignity and respect. We welcome applicants of all backgrounds, identities, and abilities. We comply with all applicable federal, state, and local equal employment opportunity laws.\n\nHOW TO APPLY\n[Clear application instructions. Include deadline if known. State that accommodations are available during the application and interview process. Include an alternative application method — email or phone — for candidates who cannot use the online portal.]\n\nACCOMMODATION NOTICE\nWe are committed to an accessible application and interview process. If you need an accommodation at any stage, please contact [MISSING — DATA REQUIRED: insert HR contact name, email, and phone] before the application deadline. We will work with you to meet your needs."
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
