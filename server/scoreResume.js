
const { generateWithLLM } = require('./services/llmService');
const {
  matchRequirements
} = require('./services/semanticMatcher');

const ScoreCache = require('./models/ScoreCache');
const crypto = require('crypto');

// Increment whenever scoring logic or the evaluation process changes.
const SCORING_VERSION = 'v5';

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

// Generate a unique cache key for each resume and job description.
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

async function scoreResume(resumeText, jobDescription) {

  // 1. Validate inputs.
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    throw new Error('Resume text is empty.');
  }

  if (
    typeof jobDescription !== 'string' ||
    !jobDescription.trim()
  ) {
    throw new Error('Job description is required.');
  }

  // 2. Create a unique cache key.
  const cacheKey = createCacheKey(
    resumeText,
    jobDescription
  );

  // 3. Check MongoDB before calling the LLM.
  try {
    const cached = await ScoreCache.findOne({
      cacheKey
    }).lean();

    console.log('Cache key:', cacheKey);
    console.log('Cache lookup:', cached ? 'HIT' : 'MISS');

    if (cached) {
      console.log('Using persistent cached resume evaluation.');
      return cached.result;
    }

  } catch (error) {
    console.error(
      'Could not read persistent cache:',
      error.message
    );
  }

  // 4. Ask the LLM to evaluate the resume.
  const prompt = `
You are an evidence-based resume screening assistant.

Evaluate the resume against the recruiter's job description.
The recruiter can describe any job in natural language.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

TASK:
1. Extract relevant requirements from the job description.
2. Classify each requirement into exactly one category:
   skills, experience, education, or projects.
3. Classify importance as mandatory, important, or preferred.
   Use mandatory only when explicitly required or essential.
4. Assess status:
   met: clear evidence supports the requirement.
   partial: evidence supports only part of it.
   missing: no sufficient evidence was found.
5. Provide concise evidence from the resume.
6. Do not invent qualifications or infer unsupported experience.
7. List matched_skills and missing_skills as arrays of strings.
8. Write a brief, evidence-based summary.

Return ONLY valid JSON in this structure:
{
  "requirements": [
    {
      "name": "Requirement name",
      "category": "skills",
      "importance": "mandatory",
      "status": "met",
      "evidence": "Evidence from resume"
    }
  ],
  "matched_skills": [],
  "missing_skills": [],
  "summary": ""
}

Rules:
- Use only the specified category, importance and status values.
- Include relevant requirements, not arbitrary requirements.
- Treat equivalent evidence as a potential match even when
  the exact keyword is absent.
- Do not award credit based on unsupported assumptions.
- Do not return scores; the application calculates them.
- Return no Markdown or code fences.
`;

  // 5. Generate the LLM response.
  const responseText = await generateWithLLM(prompt);

  // 6. Parse the LLM response.
  const cleanedText = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  let aiResult;

  try {
    aiResult = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      'The AI returned an invalid JSON response.'
    );
  }

  const {
    requirements,
    matched_skills,
    missing_skills,
    summary
  } = aiResult;

  // 7. Validate the response structure.
const responseValid =
  Array.isArray(requirements) &&
  Array.isArray(matched_skills) &&
  Array.isArray(missing_skills) &&
  matched_skills.every(
    skill => typeof skill === 'string'
  ) &&
  missing_skills.every(
    skill => typeof skill === 'string'
  ) &&
  typeof summary === 'string';

if (!responseValid) {
  console.error('Invalid AI response structure:', {
    requirementsType: typeof requirements,
    requirementsIsArray: Array.isArray(requirements),

    matchedSkillsType: typeof matched_skills,
    matchedSkillsIsArray: Array.isArray(matched_skills),

    missingSkillsType: typeof missing_skills,
    missingSkillsIsArray: Array.isArray(missing_skills),

    summaryType: typeof summary,

    responsePreview: JSON.stringify(aiResult).slice(0, 2000)
  });

  throw new Error(
    'The AI response does not match the expected result format. Check server logs for details.'
  );
}

  // 8. Validate each requirement.
  for (const requirement of requirements) {
    if (
      !requirement ||
      typeof requirement.name !== 'string' ||
      !requirement.name.trim() ||
      !Object.prototype.hasOwnProperty.call(
        CATEGORY_MAX,
        requirement.category
      ) ||
      !Object.prototype.hasOwnProperty.call(
        IMPORTANCE_WEIGHT,
        requirement.importance
      ) ||
      !Object.prototype.hasOwnProperty.call(
        STATUS_VALUE,
        requirement.status
      ) ||
      typeof requirement.evidence !== 'string'
    ) {
      throw new Error(
        'The AI returned an invalid requirement assessment.'
      );
    }
  }

    // 9. Retrieve relevant resume evidence using semantic matching.
  try {
    const semanticResults = await matchRequirements(
      resumeText,
      requirements
    );

    for (const requirement of requirements) {
      const semanticMatch = semanticResults.find(
        match =>
          match.requirement.toLowerCase() ===
          requirement.name.toLowerCase()
      );

      requirement.semantic_similarity =
        semanticMatch?.similarity ?? null;

      requirement.semantic_evidence =
        semanticMatch?.evidence ?? '';

      requirement.semantic_evidence_relevant =
        semanticMatch?.evidence_relevant ?? false;

      requirement.semantic_lexical_overlap =
        semanticMatch?.lexical_overlap ?? 0;
    }

    console.log(
      'Semantic evidence retrieved for',
      semanticResults.filter(
        match => match.evidence_relevant
      ).length,
      'of',
      semanticResults.length,
      'requirements.'
    );

  } catch (error) {
    console.error(
      'Semantic matching unavailable:',
      error.message
    );

    for (const requirement of requirements) {
      requirement.semantic_similarity = null;
      requirement.semantic_evidence = '';
      requirement.semantic_evidence_relevant = false;
      requirement.semantic_lexical_overlap = 0;
    }
  }

  // 10. Calculate scores using the existing rubric.
  const breakdown = {};

  for (const [category, maximum] of Object.entries(CATEGORY_MAX)) {

    const categoryRequirements = requirements.filter(
      requirement => requirement.category === category
    );

    let earned = 0;
    let possible = 0;

    for (const requirement of categoryRequirements) {
      const weight =
        IMPORTANCE_WEIGHT[requirement.importance];

      const statusScore =
        STATUS_VALUE[requirement.status];

      earned += weight * statusScore;
      possible += weight;
    }

    breakdown[category] =
      possible === 0
        ? 0
        : roundToTwo(
            Math.min(
              maximum,
              (earned / possible) * maximum
            )
          );
  }

  // 11. Calculate the total score.
  const score = roundToTwo(
    Object.values(breakdown).reduce(
      (total, points) => total + points,
      0
    )
  );

  const result = {
    score,
    breakdown,
    matched_skills,
    missing_skills,
    summary,
    requirements
  };

  // 12. Save the result in MongoDB.
  try {
    await ScoreCache.updateOne(
      { cacheKey },
      {
        $setOnInsert: {
          cacheKey,
          result
        }
      },
      { upsert: true }
    );

    // Retrieve the stored result.
    // This also helps concurrent identical requests
    // return the same saved evaluation.
    const savedCache = await ScoreCache.findOne({
      cacheKey
    }).lean();

    if (savedCache) {
      console.log(
        'Persistent cache saved/retrieved successfully.'
      );

      return savedCache.result;
    }

  } catch (error) {

    if (error.code === 11000) {
      // Another request may have inserted the same key.
      const existingCache = await ScoreCache.findOne({
        cacheKey
      }).lean();

      if (existingCache) {
        console.log(
          'Using concurrently saved cache result.'
        );

        return existingCache.result;
      }
    }

    console.error(
      'Could not save persistent cache:',
      error.message
    );
  }

  return result;
}

module.exports = {
  scoreResume
};
