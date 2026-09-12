require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const jobDescription = `
We are hiring a Frontend Developer with 2+ years of experience in React.js.
Required skills: React, JavaScript, HTML, CSS, REST APIs.
Preferred: experience with Redux and TypeScript.
Bachelor's degree in Computer Science or related field.
`;

const resumeText = `
John Doe
B.Tech in Computer Science, XYZ University, 2022

Skills: JavaScript, React, HTML, CSS, Node.js, MongoDB

Experience:
Frontend Developer Intern - ABC Company (6 months)
Built responsive UI components using React and integrated REST APIs.

Projects:
- E-commerce website using React and Node.js
- Personal portfolio site built with HTML/CSS/JavaScript
`;

const prompt = `
You are screening a candidate's resume against a job description.

Job Description:
${jobDescription}

Candidate Resume:
${resumeText}

Evaluate this candidate using the following weighted rubric:
- Skills Match (0-40 points): How well do the candidate's stated skills align with the required skills in the job description?
- Experience Relevance (0-30 points): Are the candidate's years of experience and past roles relevant to this position?
- Education Fit (0-15 points): Does the candidate's degree/field align with what the job requires?
- Project Relevance (0-15 points): Do the candidate's projects demonstrate hands-on experience relevant to this role?

Rules:
- Only include skills that are explicitly mentioned in the resume text. Do not infer or assume skills that aren't written.
- Base your score strictly on the rubric above — do not add extra criteria.
- Be concise in the summary — 2 lines maximum.

Return ONLY valid JSON in this exact format, with no other text before or after:
{
  "score": <integer 0-100, sum of the four categories>,
  "breakdown": {
    "skills": <0-40>,
    "experience": <0-30>,
    "education": <0-15>,
    "projects": <0-15>
  },
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "summary": "<2-line explanation of the score>"
}
`;

async function testScoring() {
  try {
    const interaction = await ai.interactions.create({
      model: 'gemini-3.6-flash',
      input: prompt
    });

    console.log('✅ Response received!\n');
    console.log(interaction.output_text);

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

testScoring();