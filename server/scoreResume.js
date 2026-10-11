
const { generateWithLLM } = require('./services/llmService');

async function scoreResume(resumeText, jobDescription) {
  if (!resumeText || !resumeText.trim()) {
    throw new Error('Resume text is empty.');
  }

  if (!jobDescription || !jobDescription.trim()) {
    throw new Error('Job description is required.');
  }

  const prompt = `
You are an AI resume screening assistant.

Evaluate the resume against the job description.
Use only evidence present in the resume. Do not invent qualifications.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

SCORING RUBRIC (100 points total):
1. Skills Match: 0-40 points
2. Experience Relevance: 0-30 points
3. Education Fit: 0-15 points
4. Project Relevance: 0-15 points

Return ONLY valid JSON in this exact structure:
{
  "score": 0,
  "breakdown": {
    "skills": 0,
    "experience": 0,
    "education": 0,
    "projects": 0
  },
  "matched_skills": [],
  "missing_skills": [],
  "summary": ""
}

Rules:
- score must equal the sum of the four breakdown values.
- Do not exceed any category's maximum points.
- matched_skills and missing_skills must be arrays of strings.
- summary must briefly explain the evaluation.
- Return no Markdown or code fences.
`;

  const responseText = await generateWithLLM(prompt);

  const cleanedText = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  let result;

  try {
    result = JSON.parse(cleanedText);
  } catch {
    throw new Error('The AI returned an invalid JSON response.');
  }

  const { score, breakdown, matched_skills, missing_skills, summary } = result;

  if (
    typeof score !== 'number' ||
    !breakdown ||
    typeof breakdown !== 'object' ||
    !Array.isArray(matched_skills) ||
    !Array.isArray(missing_skills) ||
    typeof summary !== 'string'
  ) {
    throw new Error('The AI response does not match the expected result format.');
  }

  const categories = [
    ['skills', 40],
    ['experience', 30],
    ['education', 15],
    ['projects', 15]
  ];

  for (const [category, maximum] of categories) {
    const points = breakdown[category];

    if (
      typeof points !== 'number' ||
      points < 0 ||
      points > maximum
    ) {
      throw new Error(`Invalid score for ${category}.`);
    }
  }

  const calculatedScore = categories.reduce(
    (total, [category]) => total + breakdown[category],
    0
  );

  if (
    score < 0 ||
    score > 100 ||
    score !== calculatedScore
  ) {
    throw new Error('The total score does not match the score breakdown.');
  }

  return result;
}

module.exports = { scoreResume };
