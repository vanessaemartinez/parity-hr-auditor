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

    const prompt = `You are an equity-centered HR expert. Audit the job document below. Write for a general audience. Use short sentences. Avoid HR jargon. Explain why each issue matters in plain language.

Respond with ONLY a valid JSON object. No markdown. No backticks. No text before or after the JSON.

Use this exact structure:

{
  "score": <number 0-100>,
  "scoreTitle": "<Needs Significant Work | Developing Foundation | Good Foundation | Strong Equity Practice>",
  "scoreDesc": "<Two short sentences. First: what the score means. Second: the most important thing to fix.>",
  "documentType": "<job_description | job_posting | mixed | unclear>",
  "documentTypeMessage": "<One sentence. Say what type of document this is and why both a Job Description and Job Posting are needed.>",
  "sections": {
    "inclusiveLanguage": {
      "title": "Inclusive Language",
      "severity": "<flag | warn | good>",
      "items": [
        {
          "icon": "<🚩 for flag, ⚠️ for warn, ✅ for good>",
          "severity": "<flag | warn | good>",
          "title": "<Short issue name>",
          "explanation": "<2-3 short sentences. Say what the problem is. Say who it harms. Say why it matters. Use plain words.>",
          "before": "<exact phrase from the document>",
          "after": "<improved version of that phrase>",
          "citation": "<Explain in one sentence why this source matters. Then name it. Example: Research shows this phrase reduces applications from women by 40 percent. Source: Gaucher, Friesen, and Kay, Journal of Personality and Social Psychology, 2011.>"
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
          "explanation": "<2-3 short sentences in plain language. Explain what accessibility means. Say who is affected. Say what to do.>",
          "before": "<current state or Not specified>",
          "after": "<recommended standard>",
          "citation": "<Explain in one sentence what this standard requires and why it protects people. Then name the source. Example: The law requires digital content to work with assistive technology used by people with disabilities. Source: Web Content Accessibility Guidelines (WCAG) 2.1, Level AA.>"
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
          "explanation": "<2-3 short sentences. Explain what a screen reader is if needed. Say what the problem is. Say who is affected.>",
          "before": "<current state>",
          "after": "<improved version>",
          "citation": "<Explain in one sentence what screen readers do and who uses them. Then name the source. Example: Screen readers read text aloud for people who are blind or have low vision. Source: Section 508 of the Rehabilitation Act of 1973.>"
        }
      ]
    },
    "structuralEquity": {
      "title": "Structural Equity and Barriers",
      "severity": "<flag | warn | good>",
      "items": [
        {
          "icon": "<🚩 or ⚠️ or ✅>",
          "severity": "<flag | warn | good>",
          "title": "<Short issue name>",
          "explanation": "<2-3 short sentences. Say what the barrier is. Name the groups most affected. Explain the research or law behind this.>",
          "before": "<exact phrase or practice from the document>",
          "after": "<equitable alternative>",
          "citation": "<Explain in one sentence what research or law applies here and why it matters. Then name the source. Example: Requiring a college degree when it is not necessary for the job screens out qualified candidates without increasing job performance. Source: Equal Employment Opportunity Commission guidance on selection procedures.>"
        }
      ]
    }
  },
  "jobDescription": {
    "requiredFields": ["<List every field that is missing and must be completed before use>"],
    "document": "<A complete, professional internal Job Description. Include ALL of these sections with real content based on what was submitted. Fill in what you can. Mark gaps as [MISSING — DATA REQUIRED: description of what is needed].\n\nJOB DESCRIPTION\n\nPOSITION TITLE: [title]\nDEPARTMENT: [department or REQUIRED]\nREPORTS TO: [supervisor title or REQUIRED]\nFLSA STATUS: [Exempt or Non-Exempt or REQUIRED]\nPAY BAND: [MISSING — DATA REQUIRED: Insert approved salary range before filing]\nLOCATION: [MISSING — DATA REQUIRED]\nEFFECTIVE DATE: [MISSING — DATA REQUIRED]\n\nPOSITION SUMMARY\n[2-3 sentences describing the role, its purpose, and how it supports the organization]\n\nESSENTIAL FUNCTIONS\n1. [Key responsibility]\n2. [Key responsibility]\n3. [Key responsibility]\n4. [Key responsibility]\n5. [Key responsibility]\n\nMINIMUM QUALIFICATIONS\n[List education, experience, and skills required]\n\nPREFERRED QUALIFICATIONS\n[List additional qualifications that are helpful but not required]\n\nCOMPETENCIES\n[List 3-5 core competencies for this role]\n\nWORKING CONDITIONS\n[Describe physical requirements, schedule, travel, or remote options]\n\nACCOMMODATION STATEMENT\nReasonable accommodations may be made to enable individuals with disabilities to perform the essential functions of this position. To request an accommodation, contact [MISSING — DATA REQUIRED: Insert HR contact email].\n\nEEO STATEMENT\nWe are an equal opportunity employer. We do not discriminate on the basis of race, color, religion, sex, national origin, age, disability, genetic information, sexual orientation, gender identity, or any other characteristic protected by law.>"
  },
  "jobPosting": {
    "requiredFields": ["<List every field that must be completed before posting externally>"],
    "document": "<A complete, warm, candidate-facing Job Posting. Write in second person. Use plain language. Include ALL sections.\n\nJOB POSTING\n\n[Position Title]\n[Organization Name or REQUIRED]\n[Location and Remote/Hybrid/On-site status or REQUIRED]\n[Salary Range: MISSING — DATA REQUIRED — Pay transparency builds trust and widens your applicant pool]\n\nABOUT THE ROLE\n[3-4 sentences. Describe what the person will do. Say why this role matters. Use welcoming, inclusive language.]\n\nWHAT YOU WILL DO\n- [Key responsibility in plain language]\n- [Key responsibility in plain language]\n- [Key responsibility in plain language]\n- [Key responsibility in plain language]\n\nWHAT WE ARE LOOKING FOR\n[List required qualifications. Separate required from preferred. Avoid unnecessary degree requirements.]\n\nWHAT WE OFFER\n[MISSING — DATA REQUIRED: List salary range, benefits, PTO, remote options, and other perks]\n\nOUR COMMITMENT TO BELONGING\n[2-3 sentences. Say who is welcome to apply. Include a genuine belonging statement.]\n\nHOW TO APPLY\n[Clear instructions. Include deadline if known. State that accommodations are available.]\n\nACCOMMODATION NOTICE\nWe are committed to providing an accessible application process. If you need an accommodation to apply or interview, please contact [MISSING — DATA REQUIRED: Insert HR contact email] before the application deadline.>"
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
        max_tokens: 8000,
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

    // Strip markdown fences if present (multiple possible formats)
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // Find the first { and last } to extract JSON even if there's stray text
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
