
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

  const prompt = `
Analyze the following job description and extract its requirements.

JOB DESCRIPTION:
${jobDescription}

RULES:
1. Extract distinct, relevant job requirements.
2. Assign unique IDs: R1, R2, R3, and so on.
3. Classify each requirement into exactly one category:
   - skills
   - experience
   - education
   - projects
4. Use only these importance levels:
   - mandatory
   - important
   - preferred
5. Respect explicit wording such as required, must-have,
   preferred, desirable and optional.
6. Extract minimum years only when explicitly stated.
7. For requirements without explicit minimum years:
   has_explicit_minimum_years must be false
   and minimum_years must be 0.
8. Do not invent requirements or qualifications.
9. Do not combine unrelated requirements into one requirement.
10. Do not generate scores or candidate evaluations.
11. Return only JSON matching the required schema.

OUTPUT STRUCTURE:
{
  "job_title": "string",
  "requirements": [
    {
      "requirement_id": "R1",
      "requirement": "string",
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
