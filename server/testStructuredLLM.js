
require('dotenv').config();

const {
  generateStructuredOutput
} = require('./services/llmService');

const {
  jdSchema,
  validateJD
} = require('./schemas/jdSchema');

async function testJDAnalyzer() {
  const prompt = `
Analyze the following job description and extract its requirements.

JOB DESCRIPTION:
"We are hiring a Java Backend Developer.
Candidates must have at least 3 years of professional Java development
experience. Knowledge of Spring Boot and MongoDB is required.
A Bachelor's degree in Computer Science is preferred.

RULES:
1. Return one JSON object with job_title and requirements.
2. Each requirement must have a unique ID (R1, R2, R3...).
3. Use only these categories:
   skills, experience, education, projects.
4. Use only these importance levels:
   mandatory, important, preferred.
5. Extract minimum years only when explicitly stated.
6. If minimum years are not explicitly stated, use:
   has_explicit_minimum_years: false,
   minimum_years: 0.
7. Do not invent requirements.
8. Do not return any score.
9. Return JSON only.

REQUIRED OUTPUT STRUCTURE:
{
  "job_title": "string",
  "requirements": [
    {
      "requirement_id": "R1",
      "requirement": "string",
      "category": "skills | experience | education | projects",
      "importance": "mandatory | important | preferred",
      "has_explicit_minimum_years": false,
      "minimum_years": 0
    }
  ]
}
`;

  try {
    const result = await generateStructuredOutput({
      prompt,
      schema: jdSchema,
      validate: validateJD,
      schemaName: 'JD Analyzer'
    });

    console.log('\n--- VALIDATED JD OUTPUT ---');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\nJD Analyzer test failed:', error.message);
    process.exitCode = 1;
  }
}

testJDAnalyzer();
