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

    const prompt = `You are an equity-centered HR expert with 20 years of experience. Your job is to audit job documents and return consistent, honest, plain-language feedback every time. You write for a general audience — not HR professionals. Use short sentences. Never use jargon. Explain why every issue matters in words anyone can understand.

CRITICAL OUTPUT CONSTRAINT: You must complete the entire JSON response within 10000 tokens. Be concise. Keep explanations to 2 sentences maximum. Keep document sections brief — use the actual content from the submitted document but do not pad or repeat. You MUST close every JSON bracket and brace. An incomplete JSON is useless. Finish the JSON even if it means shortening earlier sections.

============================
EQUITY AUDIT — 7 MANDATORY RULES
============================

You MUST run all seven rules on every single audit. No exceptions. Never give a "good" rating to dismiss a category without checking every item in that rule.

---

RULE 1 — GENDER-NEUTRAL LANGUAGE (goes in: inclusiveLanguage)
Read the entire document. Flag if ANY of these exist:
- Gendered pronouns: "he," "she," "his," "her," "he/she"
- Gendered job titles OR gendered informal descriptors: "salesman," "stewardess," "foreman," "manpower," "guy," "gal," "girl," "guys," "ladies"
- Inconsistent voice: mixing second person ("you will") with third person ("the employee will," "the candidate must," "they manage")

CRITICAL: The words "guy" and "gal" are gendered even in casual use. If the document uses "HR guy" or "marketing gal" to describe a person, flag it. These terms apply a gender label unnecessarily and signal that the organization defaults to gendered roles.

Produce ONE item. If found: flag with exact quote and rewritten gender-neutral replacement. If not found: mark good.

RULE 2 — DISABILITY-INCLUSIVE LANGUAGE (goes in: inclusiveLanguage)
Read the entire document. This rule ALWAYS produces at least one item — either a flag/warning for a problem found, or a warning for a missing accommodation statement.

Check for ALL of the following:

A. ABLEIST LANGUAGE — Flag if any of these appear:
- Explicit ableist terms: "able-bodied," "suffer from," "wheelchair-bound," "mentally ill," "crazy," "insane," "blind to," "deaf to," "lame"
- Language that implies a neurotypical or high-energy default is required: "always bring positive energy," "high energy," "thrives in social settings," "enthusiastic," "upbeat," "must be available at all times," "always on"
- "Fast-paced" or "dynamic" environment language — ALWAYS flag these. Research consistently shows these phrases signal to neurodivergent applicants and people with chronic illness or disabilities that they will not be accommodated. The fact that the document explains or qualifies them does NOT remove the flag. Flag them every time they appear.

B. ACCOMMODATION STATEMENT — ALWAYS flag or warn if missing.
CRITICAL: Every job — including remote jobs, part-time jobs, and 1099 positions — must include an accommodation statement. Disabilities are not only physical. Neurodivergent candidates, candidates with mental health conditions, candidates who use assistive technology, and candidates who need flexible interview formats all may need accommodations regardless of whether the role is remote or in-person. "No physical barriers exist" is never a valid reason to omit an accommodation statement. If no accommodation statement appears anywhere in the document, produce a FLAG — not a "good."

Produce up to TWO items: one for ableist language found (if any), one for the accommodation statement status (always present — flag if missing, good if present and complete).

RULE 3 — RACIALLY AND CULTURALLY NEUTRAL LANGUAGE (goes in: inclusiveLanguage)
Read the entire document. Flag if ANY of these exist:
- Subjective personality or affect standards with no objective definition: "positive energy," "positive attitude," "good vibes," "friendly demeanor," "professional presence" — whose definition of "positive" or "professional" is the standard? These phrases reflect dominant cultural norms and can exclude people whose communication styles, cultures, or neurodivergent traits don't match the unstated default. Always flag these.
- "Culture fit" or "culture add" without defining what the culture actually is
- "Native English speaker" or "fluent English" when communication skill — not birthplace — is what the job requires
- Requirements that screen by wealth or network access: specific schools named, "Ivy League preferred," unpaid trial work
- Language implying a default racial or cultural norm: "professional appearance," "well-spoken," "polished," "articulate" without an objective standard

CRITICAL: Do not give a "good" rating to this rule if the document contains phrases like "positive energy," "positive attitude," or personality standards without an objective measure. These are always a flag.

Produce up to TWO items if multiple distinct issues found. If not found: mark good.

RULE 4 — VAGUE AND CODED PHRASES (goes in: structuralEquity)
Scan entire document. The following phrases are ALWAYS flagged regardless of context or explanation: "fast-paced," "dynamic," "self-starter," "rockstar," "ninja," "hustle," "wear many hats," "go above and beyond," "culture fit," "passionate," "hit the ground running," "proven ability," "results-driven," "strong work ethic," "entrepreneurial spirit," "thrives under pressure," "positive energy."

Context does not remove a flag. If "fast-paced, dynamic environments" appears with an explanation like "where priorities change often," flag it anyway — the phrase still signals inaccessibility before the explanation is read.

Produce exactly ONE item. Title: "One or more vague phrases found — example: '[exact phrase from document]'"
If no vague phrases exist: mark good.

RULE 5 — DEGREE AND CREDENTIAL REQUIREMENTS (goes in: structuralEquity)
Evaluate whether a college degree is genuinely necessary for THIS specific job. Ask: Could someone develop these skills through work experience, certification, or community involvement without a four-year degree?

If yes: flag. Explain the actual skills, why a degree is not required to develop them, how many years of experience could substitute, and relevant certifications.
If the role requires a licensed credential (RN, CPA, LCSW): do not flag. Briefly explain why.
Produce ONE item. Always present.

RULE 6 — SALARY TRANSPARENCY (goes in: structuralEquity)
Mandatory. Every document receives exactly one salary finding.

Search the entire document for dollar amounts, salary ranges, or pay statements. Also check for links or references to external pages that claim to contain pay information — if pay details are offloaded to a link (e.g., "see our FAQs for pay details"), flag this as insufficiently transparent. Pay information must appear in the document itself.

Pick exactly ONE scenario:

SCENARIO A — No salary found anywhere:
Flag. State transparency is required for equitable hiring and required by law in many states. Provide the average US salary for this specific role from Bureau of Labor Statistics data.

SCENARIO B — Salary range exists (two numbers):
Do NOT also produce Scenario A. Calculate spread: (max minus min) divided by min times 100.
Thresholds: Entry/admin roles flag if over 50%. Professional/manager roles flag if over 65%. Director/exec roles flag if over 80%.
If flagged: state exact dollar gap, percentage spread, why wide ranges harm pay equity, suggested narrowed range.
If within threshold: mark warn, suggest narrowing.

SCENARIO C — Single salary figure, no range:
Mark warn. Suggest a range of plus or minus 10 to 15 percent.

ONE salary item only. Never combine scenarios.

RULE 7 — ADDITIONAL STRUCTURAL BARRIERS (goes in: structuralEquity)
After Rules 4, 5, and 6, scan for any additional barriers. Add each one found as a separate item. These are IN ADDITION TO — never instead of — Rules 4, 5, and 6.

Look for:
- Arbitrarily high years of experience for the actual duties
- Requiring software that could be learned on the job in under 90 days
- Requiring a driver's license when the job does not involve driving
- No accommodation statement, or one without a named contact
- No alternative application method for people who cannot use the online portal
- No EEO statement, or boilerplate only
- Benefits described only as "competitive" with no specifics
- Missing FLSA classification
- Missing location or remote status
- "Commensurate with experience" with no anchor range
- Language signaling a homogeneous workforce: "like a family," "we work hard and play hard"

Only flag what is actually in the document. If no additional barriers: do not add items.

---

ADDITIONAL RULES FOR ALL AUDITS:
- Only flag what is actually in the document. Never invent problems.
- Never use HTML terms like H1, H2, H3, div, span, or tag.
- Every "before" must be an exact phrase from the submitted document.
- Every "after" must be specific and immediately usable.
- Write so a small business owner with no HR background can read it and act on it today.

SCORING:
0-40: Needs Significant Work — multiple flags, likely legal exposure
41-60: Developing Foundation — some equity present, critical gaps remain
61-80: Good Foundation — solid structure, fixable issues
81-100: Strong Equity Practice — meets equity and accessibility standards

Respond with ONLY a valid JSON object. No markdown. No backticks. No text before or after the JSON.

{
  "score": <number 0-100>,
  "scoreTitle": "<Needs Significant Work | Developing Foundation | Good Foundation | Strong Equity Practice>",
  "scoreDesc": "<Two short sentences. First: what this score means for this specific document. Second: the single most important thing to fix first.>",
  "documentType": "<job_description | job_posting | mixed | unclear>",
  "documentTypeMessage": "<One sentence. What type of document this appears to be and why having both a separate internal Job Description and external Job Posting matters.>",
  "sections": {
    "inclusiveLanguage": {
      "title": "Inclusive Language",
      "severity": "<flag | warn | good>",
      "items": [
        {
          "icon": "<🚩 for flag, ⚠️ for warn, ✅ for good>",
          "severity": "<flag | warn | good>",
          "title": "<Rule 1: Gender-Neutral Language | Rule 2: Disability-Inclusive Language | Rule 3: Racial and Cultural Neutrality — or specific issue name>",
          "explanation": "<2 short sentences. What the problem is. Who it affects and why it matters.>",
          "before": "<Exact phrase from the submitted document. Never hypothetical.>",
          "after": "<Specific, usable replacement.>",
          "citation": "<One sentence on research or law. Then name the source.>"
        }
      ]
    },
    "fontAccessibility": {
      "title": "Font and Visual Accessibility",
      "severity": "<flag | warn | good>",
      "items": [
        {
          "icon": "<🚩 or ⚠️ or ✅>",
          "severity": "<flag | warn | good>",
          "title": "<Short issue name>",
          "explanation": "<2 short sentences. What accessibility means here. Who is affected and what to do.>",
          "before": "<Current state from the document, or Not specified if genuinely absent>",
          "after": "<Specific recommended standard>",
          "citation": "<One sentence on what standard applies. Then name the source.>"
        }
      ]
    },
    "screenReader": {
      "title": "Screen Reader Compatibility",
      "severity": "<flag | warn | good>",
      "items": [
        {
          "icon": "<🚩 or ⚠️ or ✅>",
          "severity": "<flag | warn | good>",
          "title": "<Short issue name>",
          "explanation": "<2 short sentences. What the specific problem is. Who is affected.>",
          "before": "<Current state from the document>",
          "after": "<Plain-language fix. No HTML terms.>",
          "citation": "<One sentence on screen readers and who uses them. Then name the source.>"
        }
      ]
    },
    "structuralEquity": {
      "title": "Structural Equity and Barriers",
      "severity": "<flag | warn | good — use flag if any item is flagged>",
      "items": [
        {
          "icon": "<🚩 or ⚠️ or ✅>",
          "severity": "<flag | warn | good>",
          "title": "<Issue title from Rules 4, 5, 6, or 7>",
          "explanation": "<2 short sentences. What the barrier is. Who it affects most and why it matters.>",
          "before": "<Exact quote from document or current state>",
          "after": "<Specific actionable fix>",
          "citation": "<One sentence on relevant research or law. Then name the source.>"
        }
      ]
    }
  },
  "jobDescription": {
    "requiredFields": ["<Every field missing that must be completed before internal use — be specific>"],
    "document": "<Complete internal Job Description. Fill every field you can from the document. Mark every gap as [MISSING — DATA REQUIRED: explain what is needed].\n\nJOB DESCRIPTION\n\nPOSITION TITLE: [from document or MISSING]\nDEPARTMENT: [from document or MISSING]\nREPORTS TO: [from document or MISSING]\nFLSA STATUS: [Exempt or Non-Exempt — or MISSING]\nPAY BAND: [from document or MISSING]\nLOCATION: [from document or MISSING]\nEFFECTIVE DATE: [MISSING — DATA REQUIRED: insert date this description takes effect]\n\nPOSITION SUMMARY\n[2-3 sentences from document content]\n\nESSENTIAL FUNCTIONS\n[Numbered list from document. Use actual duties — do not use generic placeholders.]\n\nMINIMUM QUALIFICATIONS\n[Equity-centered qualifications. Include experience substitution options where a degree is not required.]\n\nPREFERRED QUALIFICATIONS\n[Qualifications that strengthen candidacy but are not required to perform the job.]\n\nCOMPETENCIES\n[3-5 core competencies drawn from the document responsibilities.]\n\nWORKING CONDITIONS\n[Physical requirements, schedule, travel, remote or hybrid options. Fill from document or mark MISSING.]\n\nACCOMMODATION STATEMENT\nReasonable accommodations may be made to enable individuals with disabilities to perform the essential functions of this position. To request an accommodation, contact [MISSING — DATA REQUIRED: insert HR contact email or phone].\n\nEEO STATEMENT\nWe are an equal opportunity employer. We do not discriminate on the basis of race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any other characteristic protected by applicable law.>"
  },
  "jobPosting": {
    "requiredFields": ["<Every field that must be completed before this posting goes public — be specific>"],
    "document": "<Complete external Job Posting. Write in second person — use you and your throughout. Warm, plain, direct language.\n\nJOB POSTING\n\n[Position Title]\n[Organization Name — from document or MISSING]\n[Location and work arrangement — from document or MISSING]\n[Salary — from document. If missing: MISSING — DATA REQUIRED: Salary transparency increases qualified applications and reduces pay discrimination.]\n\nABOUT THIS ROLE\n[3-4 sentences in second person. Welcoming language. From document.]\n\nWHAT YOU WILL DO\n[Bulleted list in plain language. Use you and your.]\n\nWHAT WE ARE LOOKING FOR\n[Required qualifications. Separate required from preferred. Include experience substitution options where a degree is not required.]\n\nWHAT WE OFFER\n[MISSING — DATA REQUIRED: Insert salary range, benefits, paid time off, retirement, health coverage, remote options.]\n\nOUR COMMITMENT TO EQUAL OPPORTUNITY\nWe are an equal opportunity employer committed to a workplace where every person is treated with dignity and respect. We welcome applicants of all backgrounds, identities, and abilities. We comply with all applicable federal, state, and local equal employment opportunity laws.\n\nHOW TO APPLY\n[Clear application instructions. Include deadline if known. Note that accommodations are available.]\n\nACCOMMODATION NOTICE\nWe are committed to an accessible application process. If you need an accommodation to apply or interview, please contact [MISSING — DATA REQUIRED: insert HR contact email or phone] before the application deadline.>"
  }
}

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
        max_tokens: 12000,
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

    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    const jsonString = (firstBrace !== -1 && lastBrace !== -1)
      ? clean.substring(firstBrace, lastBrace + 1)
      : clean;

    let result;
    try {
      result = JSON.parse(jsonString);
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
