const { generateWithLLM } = require('./services/llmService');
const { matchRequirements } = require('./services/semanticMatcher');
const ScoreCache = require('./models/ScoreCache');
const crypto = require('crypto');

// Change this whenever the evaluation or scoring logic changes.
const SCORING_VERSION = 'v11-category-name-test-3';

const CATEGORY_MAX = {
  skills: 40,
  experience: 30,
  education: 15,
  projects: 15
};

const IMPORTANCE_WEIGHT = {
  mandatory: 3,
  important: 2,
  preferred: 1
};

const STATUS_VALUE = {
  met: 1,
  partial: 0.5,
  missing: 0
};

function createCacheKey(resumeText, jobDescription) {
  return crypto
    .createHash('sha256')
    .update(
      `${SCORING_VERSION}\n${resumeText.trim()}\n---JOB DESCRIPTION---\n${jobDescription.trim()}`
    )
    .digest('hex');
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeEvidenceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Evidence must be traceable to the submitted resume. This deliberately
// avoids fuzzy/90%-word-overlap matching, which can accept unrelated text.
function verifyResumeEvidence(resumeText, evidence) {
  if (typeof evidence !== 'string' || !evidence.trim()) return false;

  const normalizedResume = normalizeEvidenceText(resumeText);
  const normalizedEvidence = normalizeEvidenceText(evidence);

  if (normalizedEvidence.length < 8) return false;
  return normalizedResume.includes(normalizedEvidence);
}

function findSummaryTenureEvidence(resumeText, requirement) {
  if (requirement?.category !== 'experience') return '';

  const requirementName = String(requirement.name || '');

  // Only apply to requirements specifying a minimum number of years.
  const requiredMatch = requirementName.match(
    /\b(?:at\s+least|min(?:imum)?(?:\s+of)?)?\s*(\d+(?:\.\d+)?)\s*\+?\s+years?\b/i
  );

  if (!requiredMatch) return '';

  const requiredYears = Number(requiredMatch[1]);
  const lines = String(resumeText || '').split(/\r?\n/);

  let offset = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (getSectionAtPosition(resumeText, offset) === 'summary') {
      const claim = trimmedLine.match(
        /\b(\d+(?:\.\d+)?)\s*\+?\s+years?\s+of\s+(?:professional\s+)?experience\b/i
      );

      if (claim && Number(claim[1]) >= requiredYears) {
        if (verifyResumeEvidence(resumeText, trimmedLine)) {
          return trimmedLine;
        }
      }
    }

    offset += line.length + 1;
  }

  return '';
}

// Identify the resume section containing a quoted passage. Experience-category
// credit is restricted to employment, internships, freelance and other work
// sections; academic/personal projects are reserved for the Projects category.
function getSectionAtPosition(resumeText, position) {
  const sectionPatterns = [
    { type: 'projects', re: /^(?:PROJECTS?|PROJECT EXPERIENCE|ACADEMIC PROJECTS?|PERSONAL PROJECTS?|RESEARCH PROJECTS?|COURSE PROJECTS?)$/i },
    { type: 'professional',  re: /^(?:EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|PROFESSIONAL WORK EXPERIENCE|EMPLOYMENT|EMPLOYMENT HISTORY|WORK HISTORY|CAREER EXPERIENCE|INTERNSHIPS?|INTERNSHIP EXPERIENCE|FREELANCE EXPERIENCE|CONTRACT EXPERIENCE|VOLUNTEER EXPERIENCE)$/i},
    { type: 'education', re: /^(?:EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS)$/i },
    { type: 'skills', re: /^(?:TECHNICAL SKILLS|SKILLS|CORE COMPETENCIES|TECHNOLOGIES|TOOLS)$/i },
    { type: 'summary', re: /^(?:PROFESSIONAL SUMMARY|SUMMARY|PROFILE|CAREER OBJECTIVE|OBJECTIVE)$/i },
    { type: 'other', re: /^(?:CERTIFICATIONS?|ADDITIONAL|ACHIEVEMENTS?|PUBLICATIONS?)$/i }
  ];

  let currentSection = 'unknown';
  let offset = 0;
  for (const line of String(resumeText || '').split(/\r?\n/)) {
    if (offset > position) break;
    const heading = line.trim().replace(/^#+\s*/, '').replace(/:$/, '').trim();
    const match = sectionPatterns.find(item => item.re.test(heading));
    if (match) currentSection = match.type;
    offset += line.length + 1;
  }
  return currentSection;
}

function classifyEvidenceSource(resumeText, evidence) {
  if (!evidence || typeof evidence !== 'string') return 'none';

  // Check every exact occurrence. The same skill may appear in both a skills
  // list and a project; prefer the most specific section that contains it.
  const lowerResume = String(resumeText || '').toLowerCase();
  const lowerEvidence = evidence.toLowerCase();
  let from = 0;
  const exactSources = [];
  while (lowerEvidence && (from = lowerResume.indexOf(lowerEvidence, from)) !== -1) {
    exactSources.push(getSectionAtPosition(resumeText, from));
    from += Math.max(1, lowerEvidence.length);
  }
if (exactSources.includes('professional')) return 'professional';
if (exactSources.includes('projects')) return 'projects';
if (exactSources.includes('education')) return 'education';
if (exactSources.includes('skills')) return 'skills';

// An explicit professional tenure claim in the summary
// can establish total professional experience.
if (
  exactSources.includes('summary') &&
  /\b\d+\+?\s+years?\s+of\s+experience\b/i.test(evidence)
) {
  return 'professional';
}

if (exactSources.length) return exactSources[0];

  // PDF extraction can alter whitespace and punctuation. Use normalized text
  // and inspect nearby section headings without treating a summary as work history.
  const normalizedResume = normalizeEvidenceText(resumeText);
  const normalizedQuote = normalizeEvidenceText(evidence);
  const normalizedIndex = normalizedResume.indexOf(normalizedQuote);
  if (normalizedIndex >= 0) {
    const before = normalizedResume.slice(0, normalizedIndex);
    const headings = [
      { type: 'projects', re: /\b(project experience|projects|academic projects|personal projects|research projects|course projects)\b/g },
      { type: 'professional', re: /\b(experience|work experience|professional experience|professional work experience|employment|employment history|work history|career experience|internships?|internship experience|freelance experience|contract experience|volunteer experience)\b/g },
      { type: 'education', re: /\b(education|academic background|qualifications)\b/g },
      { type: 'summary', re: /\b(professional summary|summary|profile|career objective|objective)\b/g },
      { type: 'skills', re: /\b(technical skills|core competencies|skills|technologies|tools)\b/g }
    ];
    let latestHeading = -1;
    let latestType = 'unknown';
    for (const heading of headings) {
      let match;
      while ((match = heading.re.exec(before)) !== null) {
        if (match.index > latestHeading) {
          latestHeading = match.index;
          latestType = heading.type;
        }
      }
    }
    if (latestHeading >= 0) return latestType;
  }

  // A summary only establishes professional experience when it explicitly
  // states a professional role, employer, or work tenure. Academic/project
  // experience is never silently upgraded to professional experience.
  if (/\b\d+\+?\s+years?\b.{0,60}\b(professional|work|industry|employment)\s+experience\b/i.test(evidence) ||
      /\b(professional|work|industry|employment)\s+experience\b.{0,60}\b\d+\+?\s+years?\b/i.test(evidence) ||
      /\b(intern|internship|employed|employment|freelance|contract role|worked at|working at)\b/i.test(evidence)) {
    return 'professional';
  }
  if (/\b(academic|course|personal|capstone|research)\s+projects?\b|\bproject experience\b/i.test(evidence)) return 'projects';
  return 'unknown';
}


function isProfessionalExperienceRequirement(requirement) {
  const text = String(requirement.name || '').toLowerCase();

  return (
    /\bprofessional experience\b/.test(text) ||
    /\b(?:professional )?work experience\b/.test(text) ||
    /\bemployment history\b/.test(text) ||
    /\bwork history\b/.test(text) ||
    /\bindustry experience\b/.test(text) ||
    /\binternships?\b/.test(text) ||
    /\bfreelance work\b/.test(text) ||
    /\bcontract work\b/.test(text) ||
    /\bclient-facing work\b/.test(text) ||
    /\b\d+\s*[-–]\s*\d+\s*years?\b/.test(text) ||
    /\b(?:at least|minimum(?: of)?)?\s*\d+(?:\.\d+)?\s*\+?\s+years?\s+of\s+(?:professional\s+)?(?:[\w/-]+\s+){0,5}experience\b/.test(text)
  );
}



function normalizeRequirementCategory(requirement) {
  const category = requirement.category;

  // Keep education and projects unchanged.
  if (category !== 'skills' && category !== 'experience') {
    return category;
  }

  // Explicit professional-work requirements belong to Experience,
  // regardless of the category initially assigned by the LLM.
  if (isProfessionalExperienceRequirement(requirement)) {
    return 'experience';
  }

  // General technology knowledge and proficiency belong to Skills.
  return 'skills';
}


function isCompletedDegreeRequirement(requirement) {
  return /\b(degree|bachelor|b\.tech|b\.sc|b\.a\.|master|qualification|graduate)\b/i.test(requirement.name || '');
}

function isOngoingDegreeEvidence(text) {
  return /\b(expected|currently pursuing|pursuing|in progress|ongoing|anticipated)\b/i.test(text) ||
    /\b(20\d{2})\s*[-–]\s*(20\d{2})\s*\(\s*expected\s*\)/i.test(text);
}

function isCompletedDegreeEvidence(text) {
  if (isOngoingDegreeEvidence(text)) return false;
  return /\b(completed|graduated|degree awarded|awarded in|graduation:|20\d{2}\s*\(\s*completed\s*\))\b/i.test(text);
}

function explainExperienceEligibility(sourceType) {
  if (sourceType === 'projects') {
    return 'This evidence comes from an academic or personal project. It demonstrates practical capability and may support project relevance, but it does not establish professional employment experience.';
  }
  return 'The submitted evidence does not establish employment, an internship, freelance work, or another professional engagement for this requirement.';
}

function cleanJsonResponse(responseText) {
  if (typeof responseText !== 'string' || !responseText.trim()) {
    throw new Error('The AI returned an empty response.');
  }

  let cleaned = responseText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // Recover a JSON object if a provider adds a short preamble or suffix.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function validateAIResult(aiResult) {
  if (!aiResult || typeof aiResult !== 'object' || Array.isArray(aiResult)) {
    throw new Error('The AI response is not a JSON object.');
  }

  const { requirements, matched_skills, missing_skills, summary } = aiResult;

  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new Error('The AI did not return any job requirements.');
  }

  if (
    !Array.isArray(matched_skills) ||
    !Array.isArray(missing_skills) ||
    !matched_skills.every(item => typeof item === 'string') ||
    !missing_skills.every(item => typeof item === 'string')
  ) {
    throw new Error('The AI returned invalid skill lists.');
  }

  if (typeof summary !== 'string') {
    throw new Error('The AI returned an invalid summary.');
  }

  const seen = new Set();

  for (const requirement of requirements) {
    if (
      !requirement ||
      typeof requirement.name !== 'string' ||
      !requirement.name.trim() ||
      !Object.prototype.hasOwnProperty.call(CATEGORY_MAX, requirement.category) ||
      !Object.prototype.hasOwnProperty.call(IMPORTANCE_WEIGHT, requirement.importance) ||
      !Object.prototype.hasOwnProperty.call(STATUS_VALUE, requirement.status) ||
      typeof requirement.evidence !== 'string'
    ) {
      throw new Error('The AI returned an invalid requirement assessment.');
    }

    // v7 asked for evidence_strength. Accept older valid responses too and
    // infer a conservative value from status when the field is absent.
    if (
      requirement.evidence_strength !== undefined &&
      !['strong', 'limited', 'none'].includes(requirement.evidence_strength)
    ) {
      throw new Error(`Invalid evidence strength for: ${requirement.name}`);
    }

    const key = requirement.name.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`The AI returned a duplicate requirement: ${requirement.name}`);
    }
    seen.add(key);
  }
}

function inferEvidenceStrength(requirement) {
  if (['strong', 'limited', 'none'].includes(requirement.evidence_strength)) {
    return requirement.evidence_strength;
  }

  if (requirement.status === 'met') return 'strong';
  if (requirement.status === 'partial') return 'limited';
  return 'none';
}

function buildSummary(requirements) {
  const counts = { met: 0, partial: 0, missing: 0 };
  for (const item of requirements) counts[item.validated_status]++;

  const parts = [];
  if (counts.met) parts.push(`${counts.met} requirement${counts.met === 1 ? '' : 's'} met`);
  if (counts.partial) parts.push(`${counts.partial} partially met`);
  if (counts.missing) parts.push(`${counts.missing} not demonstrated in the submitted resume`);

  if (!parts.length) {
    return 'No requirements could be assessed from the submitted resume.';
  }

  return `Based on the information stated in the submitted resume, ${parts.join(', ')}. These results describe evidence presented in the resume; they do not independently authenticate candidate claims.`;
}

async function scoreResume(resumeText, jobDescription) {
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    throw new Error('Resume text is empty.');
  }

  if (typeof jobDescription !== 'string' || !jobDescription.trim()) {
    throw new Error('Job description is required.');
  }

  const cacheKey = createCacheKey(resumeText, jobDescription);

  // Persistent cache lookup.
  try {
    const cached = await ScoreCache.findOne({ cacheKey }).lean();
    console.log('Cache lookup:', cached ? 'HIT' : 'MISS');
    if (cached?.result) return cached.result;
  } catch (error) {
    console.error('Could not read persistent cache:', error.message);
  }

  // Single-call hybrid assessment: extraction and initial evaluation happen
  // together, avoiding the second-call truncation failure introduced in v8.
  const prompt = `
You are an evidence-based resume screening assistant. Evaluate the candidate only against the recruiter's job description and the project-evaluation rules below.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Return one assessment for each distinct, relevant job requirement. Do not invent job requirements. Classify requirements by what they actually measure, not merely by the word "experience":
- skills: knowledge, proficiency, tools, methods and practical capabilities. A skill can be demonstrated in employment, internships, academic projects, personal projects or coursework. A skills-list mention alone usually establishes familiarity, not advanced proficiency.
- experience: professional work history, employment, internships, freelance/contract work, client or industry work, and explicitly stated duration of professional/work experience. Examine employment entries individually, including job title, employer, start date and end date. When dates are provided, calculate the supported duration of relevant professional experience using the employment periods. Do not rely only on the candidate's summary statement if dated employment entries provide clearer evidence. For overlapping employment periods, do not double-count the overlapping time. Distinguish total professional experience from experience in a specific domain, role or technology. For example, general software development experience does not automatically establish Python backend experience or machine learning experience. Do not count academic or personal projects as employment. Do not put generic "experience using a tool" or a practical task into this category unless the job description clearly asks for professional/work experience or a duration of work experience.
- education: degrees, fields of study and formal academic qualifications. Distinguish completed from ongoing/expected qualifications.
- projects: assess practical project relevance only when the job description explicitly asks for projects, a project portfolio, or practical project-based demonstration of relevant responsibilities. Do not create project requirements merely because the resume contains projects. Every project-category requirement must be grounded in an identifiable expectation from the job description. Use a general requirement name describing that expectation; never use a candidate's project title as a job requirement. Candidate projects are evidence that may satisfy job-grounded requirements, not requirements themselves. If the job description contains no project-related expectation, do not create any projects-category requirements. Do not duplicate professional employment requirements here.

For every requirement:
- For every experience-category requirement, actively inspect the PROFESSIONAL EXPERIENCE, WORK EXPERIENCE and EMPLOYMENT HISTORY sections before deciding that evidence is missing.
- For professional experience duration requirements, consider both explicit duration statements in the professional summary and dated employment entries. Quote the exact supporting text from the resume.
- For role-specific professional experience, use exact employment bullet points that demonstrate the required role, technology or responsibility.
- Do not return empty evidence when the resume contains an exact, relevant employment passage.
- A skills-list mention alone does not establish professional experience, but relevant employment bullet points do.
- When multiple employment entries support a requirement, use one exact, contiguous quotation that independently demonstrates relevant evidence. Do not combine separate resume passages into an invented quotation.
- category must be exactly skills, experience, education or projects.
- importance must be mandatory, important or preferred. Use mandatory only when explicitly required or essential.
- status must be met, partial or missing.
- evidence must be an exact quotation copied from the resume. Never paraphrase. If no relevant passage exists, use an empty string.
- evidence_strength must be strong, limited or none.
- met requires strong, relevant evidence at the expected level; partial means relevant but incomplete/depth-limited evidence; missing means the resume does not demonstrate the requirement.
- Do not count academic or personal projects as professional employment, professional tenure or industry experience.
- Academic and personal projects may be used as evidence for job-related requirements. Assess them in the projects category only when the job description contains an explicit project-related expectation. Otherwise, use them as supporting evidence for relevant skills without creating additional requirements.
- Do not count the same academic project as professional experience, even if the project demonstrates practical work.
- A degree marked expected, ongoing or currently pursuing is not completed. If the field is relevant, assess it as partial when the requirement asks for a completed degree.
- Do not require certificates, experience letters, GitHub links or uploaded project files. Assess claims as stated in the resume; do not claim independent authentication.
- A keyword mention alone does not establish proficiency. Basic familiarity does not satisfy an advanced requirement. Evaluate each skill using the actual evidence and demonstrated depth. Recognize equivalent tools and technologies only when the resume supports equivalent capability. Do not mark a skill missing when relevant evidence is explicitly present in another section of the resume. Distinguish basic familiarity, practical academic use, and professional-level proficiency. Do not infer specialized capabilities from generic or loosely related activities.
- Equivalent skills may qualify when the resume demonstrates equivalent capability.
- Missing means not demonstrated in this resume, not that the candidate necessarily lacks the ability.
- - Do not infer experience duration without supporting dates or an explicit duration claim. Employment dates may be used to calculate duration. Treat Present or Current as the assessment date. If dates are incomplete or ambiguous, do not invent missing months or years. Distinguish total professional tenure from role-specific or technology-specific tenure.
- Provide a short explanation that agrees with the status and the quoted evidence.

Return ONLY valid JSON in this exact structure:
{
  "requirements": [
    {
      "name": "Requirement name",
      "category": "skills",
      "importance": "mandatory",
      "status": "partial",
      "evidence": "Exact quotation from resume or empty string",
      "evidence_strength": "limited",
      "explanation": "Briefly explain why the evidence meets, partially meets, or does not demonstrate the requirement."
    }
  ],
  "matched_skills": [],
  "missing_skills": [],
  "summary": "Brief initial summary"
}

Do not return scores. The application calculates scores deterministically. Do not use Markdown or code fences.
`;

  const responseText = await generateWithLLM(prompt);
  let aiResult;

  try {
    aiResult = JSON.parse(cleanJsonResponse(responseText));
  } catch (error) {
    console.error('AI response JSON parse failed:', error.message);
    throw new Error('The AI returned invalid JSON. Please retry the screening.');
  }

  validateAIResult(aiResult);
  const requirements = aiResult.requirements;

  // Normalize ambiguous 'experience with X' requirements into Skills unless
  // the wording explicitly asks for professional/work experience or tenure.
  for (const requirement of requirements) {
    const originalCategory = requirement.category;
    requirement.category = normalizeRequirementCategory(requirement);
    if (originalCategory !== requirement.category) {
      requirement.original_category = originalCategory;
    }
  }

  // Semantic matching retrieves candidate passages. Similarity itself never
  // contributes points and never independently changes a requirement status.
  let semanticResults = [];
  try {
    semanticResults = await matchRequirements(resumeText, requirements);
    console.log(
      'Semantic evidence retrieved for',
      semanticResults.filter(item => item.evidence_relevant).length,
      'of', semanticResults.length,
      'requirements.'
    );
  } catch (error) {
    console.error('Semantic matching unavailable:', error.message);
  }

  const semanticByName = new Map(
    semanticResults.map(item => [String(item.requirement).toLowerCase(), item])
  );

  for (const requirement of requirements) {
    const proposedStatus = requirement.status;
    const evidenceStrength = inferEvidenceStrength(requirement);
    const semanticMatch = semanticByName.get(requirement.name.toLowerCase());

    const llmEvidenceVerified = verifyResumeEvidence(resumeText, requirement.evidence);
    const semanticEvidence = semanticMatch?.evidence || '';
    const semanticEvidenceVerified =
      semanticMatch?.evidence_relevant === true &&
      verifyResumeEvidence(resumeText, semanticEvidence);

    const summaryTenureEvidence = findSummaryTenureEvidence(
     resumeText,
      requirement
    );

    const summaryTenureVerified = Boolean(summaryTenureEvidence);

    const evidenceVerified =
    llmEvidenceVerified ||
    semanticEvidenceVerified ||
    summaryTenureVerified;

    const displayEvidence = llmEvidenceVerified
    ? requirement.evidence
     : semanticEvidenceVerified
      ? semanticEvidence
       : summaryTenureVerified
        ? summaryTenureEvidence
         : '';
    const evidenceSourceType = classifyEvidenceSource(resumeText, displayEvidence);

    let validatedStatus = 'missing';
    let eligibilityExplanation = '';

    // First validate the model's proposed status against traceable evidence.
    if (evidenceVerified && proposedStatus !== 'missing') {
      if (proposedStatus === 'met' && evidenceStrength === 'strong') {
        validatedStatus = 'met';
      } else {
        validatedStatus = 'partial';
      }
    }

    // Evidence-source eligibility is category-specific. Projects may support
    // Skills and Projects, but never professional Experience. Project scores
    // require evidence from a project section/source.
    if (requirement.category === 'experience') {
      // Every requirement in this category represents professional/work
      // experience. Project, skills-list, education and summary evidence cannot
      // satisfy it. Generic practical capability requirements were normalized
      // into Skills before semantic retrieval.
      if (evidenceSourceType !== 'professional') {
        validatedStatus = 'missing';
        eligibilityExplanation = explainExperienceEligibility(evidenceSourceType);
      }
    } else if (requirement.category === 'projects') {
      if (!evidenceVerified || evidenceSourceType !== 'projects') {
        validatedStatus = 'missing';
        eligibilityExplanation = evidenceVerified
          ? 'The cited evidence is not located in an academic, personal, research or other project section, so it cannot establish project relevance.'
          : 'No traceable relevant project evidence was found in the submitted resume.';
      }
    }

    // A relevant degree that is explicitly ongoing/expected is PARTIAL when
    // the requirement asks for a completed degree. It is not MISSING and must
    // never be upgraded to MET until completion is stated.
    if (
      requirement.category === 'education' &&
      isCompletedDegreeRequirement(requirement) &&
      evidenceVerified &&
      isOngoingDegreeEvidence(displayEvidence)
    ) {
      validatedStatus = 'partial';
      eligibilityExplanation = 'A relevant degree is listed, but the resume identifies it as ongoing or expected rather than completed.';
    } else if (
      requirement.category === 'education' &&
      isCompletedDegreeRequirement(requirement) &&
      evidenceVerified &&
      !isCompletedDegreeEvidence(displayEvidence) &&
      proposedStatus === 'met'
    ) {
      // Conservative safeguard: an unqualified degree mention cannot prove
      // that the qualification has already been completed.
      validatedStatus = 'partial';
      eligibilityExplanation = 'The relevant degree is listed, but completion is not explicitly established in the submitted resume.';
    }

    // If the model says MISSING despite a traceable, relevant quotation,
    // retain MISSING except for the explicit ongoing-degree reconciliation
    // above. This avoids silently upgrading unsupported assessments.
    let evidenceSource = 'none';
    if (llmEvidenceVerified && semanticEvidenceVerified) evidenceSource = 'llm_and_semantic';
    else if (llmEvidenceVerified) evidenceSource = 'llm';
    else if (semanticEvidenceVerified) evidenceSource = 'semantic';

    requirement.proposed_status = proposedStatus;
    requirement.validated_status = validatedStatus;
    requirement.status = validatedStatus; // frontend compatibility
    requirement.evidence_strength = evidenceStrength;
    requirement.evidence_verified = evidenceVerified;
    requirement.evidence_source = evidenceSource;
    requirement.evidence_source_type = evidenceSourceType;
    requirement.evidence = displayEvidence;
    requirement.retrieved_semantic_evidence = semanticEvidence;
    requirement.semantic_evidence = displayEvidence;
    requirement.semantic_evidence_relevant = evidenceVerified;
    requirement.semantic_similarity = semanticMatch?.similarity ?? null;
    requirement.semantic_lexical_overlap = semanticMatch?.lexical_overlap ?? 0;
    requirement.explanation = eligibilityExplanation || (typeof requirement.explanation === 'string'
      ? requirement.explanation
      : '');
  }

  // Build skill lists only from validated requirement statuses.
  const skillRequirements = requirements.filter(item => item.category === 'skills');
  const matchedSkills = [...new Set(
    skillRequirements.filter(item => item.validated_status === 'met').map(item => item.name)
  )];
  const partiallyMatchedSkills = [...new Set(
    skillRequirements.filter(item => item.validated_status === 'partial').map(item => item.name)
  )];
  const missingSkills = [...new Set(
    skillRequirements.filter(item => item.validated_status === 'missing').map(item => item.name)
  )];

  // Deterministic weighted scoring. Existing category maximums and importance
  // weights are unchanged. Empty categories remain numeric zero for the current
  // dashboard, while category_applicable/counts make the N/A state explicit for
  // future UI rendering.
  const breakdown = {};
  const categoryRequirementCounts = {};
  const categoryApplicable = {};

  for (const [category, maximum] of Object.entries(CATEGORY_MAX)) {
    const categoryItems = requirements.filter(item => item.category === category);
    categoryRequirementCounts[category] = categoryItems.length;
    categoryApplicable[category] = categoryItems.length > 0;

    let earned = 0;
    let possible = 0;
    for (const item of categoryItems) {
      const weight = IMPORTANCE_WEIGHT[item.importance];
      earned += weight * STATUS_VALUE[item.validated_status];
      possible += weight;
    }

    breakdown[category] = possible === 0
      ? 0
      : roundToTwo(Math.min(maximum, (earned / possible) * maximum));
  }

  const score = roundToTwo(
    Object.values(breakdown).reduce((total, value) => total + value, 0)
  );

  const result = {
    score,
    breakdown,
    category_requirement_counts: categoryRequirementCounts,
    category_applicable: categoryApplicable,
    matched_skills: matchedSkills,
    partially_matched_skills: partiallyMatchedSkills,
    missing_skills: missingSkills,
    summary: buildSummary(requirements),
    requirements
  };

  // Save once; on duplicate-key races, return the already-saved result.
  try {
    await ScoreCache.updateOne(
      { cacheKey },
      { $setOnInsert: { cacheKey, result } },
      { upsert: true }
    );

    const saved = await ScoreCache.findOne({ cacheKey }).lean();
    if (saved?.result) return saved.result;
  } catch (error) {
    if (error.code === 11000) {
      const existing = await ScoreCache.findOne({ cacheKey }).lean();
      if (existing?.result) return existing.result;
    }
    console.error('Could not save persistent cache:', error.message);
  }

  return result;
}

module.exports = { scoreResume };
