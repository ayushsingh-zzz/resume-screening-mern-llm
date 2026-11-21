
const {
  generateStructuredOutput
} = require('../services/llmService');

const {
  resumeSchema,
  validateResume
} = require('../schemas/resumeSchema');

async function parseResumeWithLLM(resumeText) {
  if (
    typeof resumeText !== 'string' ||
    !resumeText.trim()
  ) {
    throw new Error('Resume text is empty or invalid.');
  }

  const prompt = `
Extract structured information from the following resume.

RESUME TEXT:
${resumeText}

RULES:
1. Extract only information explicitly present.
2. Separate professional work experience from internships.
3. Preserve training internships as training.
4. Never classify academic projects as employment.
5. Classify projects as academic, personal, professional, or unknown.
6. Keep education completion status accurate.
7. Do not invent dates, skills, qualifications or experience.
8. Use empty strings for unavailable string values.
9. Use empty arrays for sections with no entries.
10. Return only JSON matching the required schema.
`;

  return generateStructuredOutput({
    prompt,
    schema: resumeSchema,
    schemaName: 'Resume Parser',
    validate: validateResume
  });
}

module.exports = {
  parseResumeWithLLM
};
