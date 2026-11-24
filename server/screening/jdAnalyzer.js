
const {
  generateStructuredOutput
} = require('../services/llmService');

const {
  jdSchema,
  validateJD
} = require('../schemas/jdSchema');


async function analyzeJobDescription(jobDescription) {
  if (
    typeof jobDescription !== 'string' ||
    !jobDescription.trim()
  ) {
    throw new Error('Job description is empty or invalid.');
  }

  if (jobDescription.trim().length < 20) {
    throw new Error(
      'Job description is too short to extract reliable requirements.'
    );
  }

  const prompt = `
You are an expert recruitment analyst.

Analyze the supplied job description and extract its distinct,
verifiable job requirements.

JOB DESCRIPTION:
${jobDescription.trim()}

EXTRACTION RULES:

1. Extract only requirements explicitly stated or clearly
   implied by the job description.

2. Do not invent skills, qualifications, responsibilities,
   years of experience or other requirements.

3. Assign sequential unique IDs:
   R1, R2, R3, and so on.
   Do not skip numbers or reuse IDs.

4. Keep each requirement specific and independently evaluable.
   Split unrelated skills or qualifications into separate
   requirements.

5. Do not create duplicate requirements from repeated wording.

6. Preserve the original meaning and technical terminology.
   Do not unnecessarily rewrite or broaden requirements.

CATEGORY RULES:

Classify every requirement into exactly one category:

- skills:
  Technologies, programming languages, tools, frameworks,
  technical knowledge and general practical abilities.

- experience:
  Professional employment experience, industry experience,
  internships, work history and explicitly stated duration
  requirements.

- education:
  Degrees, academic qualifications, certifications and
  educational specializations.

- projects:
  Explicit project-related requirements and project experience.

IMPORTANT:
Do not classify every requirement containing the word
"experience" as professional employment.

Examples:
- "Experience with React" -> skills
- "Hands-on experience with MongoDB" -> skills
- "2 years of professional software development" -> experience
- "Previous internship experience" -> experience
- "Experience developing academic projects" -> projects

The downstream pipeline performs additional category
normalization. Preserve the meaning of the original requirement.

IMPORTANCE RULES:

Use only:

- mandatory
- important
- preferred

Interpret wording carefully:

- "must", "required", "mandatory", "essential" -> mandatory
- "should", "strong knowledge", "expected" -> important
- "preferred", "desirable", "nice to have", "optional" -> preferred

Do not mark every requirement mandatory by default.
Use the surrounding wording and context.

MINIMUM EXPERIENCE RULES:

1. Extract minimum years only when a numerical duration is
   explicitly stated in the job description.

2. Examples:
   - "Minimum 3 years" -> true, 3
   - "At least 2 years" -> true, 2
   - "3+ years" -> true, 3
   - "18 months" -> true, 1.5
   - "Experience with Python" -> false, 0

3. Do not infer years from seniority, job title or wording
   such as "experienced developer".

4. If no explicit minimum duration exists:
   has_explicit_minimum_years must be false
   and minimum_years must be 0.

5. If multiple numerical durations are stated for one
   requirement, use the minimum duration explicitly required.

JOB TITLE RULES:

- Extract the job title when it is stated.
- If it is not stated, return "Not specified".
- Do not invent a job title based on assumptions.

FINAL VALIDATION:

- Return at least one genuine requirement.
- Every requirement must have all required fields.
- IDs must be sequential starting from R1.
- Do not return scores, candidate evaluations or explanations.
- Do not return markdown or code fences.
- Return valid JSON only.

OUTPUT STRUCTURE:

{
  "job_title": "Python Backend Developer",
  "requirements": [
    {
      "requirement_id": "R1",
      "requirement": "Minimum 2 years of professional Python development experience.",
      "category": "experience",
      "importance": "mandatory",
      "has_explicit_minimum_years": true,
      "minimum_years": 2
    },
    {
      "requirement_id": "R2",
      "requirement": "Strong knowledge of Django or FastAPI.",
      "category": "skills",
      "importance": "mandatory",
      "has_explicit_minimum_years": false,
      "minimum_years": 0
    }
  ]
}
`;

  return generateStructuredOutput({
    prompt,
    schema: jdSchema,
    schemaName: 'JD Analyzer',
    validate: validateJD
  });
}


module.exports = {
  analyzeJobDescription
};
