require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { generateWithLLM } = require('./services/llmService');

// ========================================
// JOB DESCRIPTION
// ========================================

const jobDescription = `
We are hiring a Frontend Developer with 2+ years of experience in React.js.

Required skills:
React, JavaScript, HTML, CSS, REST APIs.

Preferred:
Redux and TypeScript.

Education:
Bachelor's degree in Computer Science or related field.
`;

// ========================================
// RESUME TEXT EXTRACTION
// ========================================

async function extractResumeText(fileName) {
  let parser;

  try {
    const filePath = path.join(
      __dirname,
      'test-resumes',
      fileName
    );

    if (!fs.existsSync(filePath)) {
      throw new Error(`Resume file not found: ${fileName}`);
    }

    const extension = path.extname(fileName).toLowerCase();
    const dataBuffer = fs.readFileSync(filePath);

    console.log(`📄 Reading: ${fileName}`);

    // PDF
    if (extension === '.pdf') {
      parser = new PDFParse({
        data: dataBuffer
      });

      const result = await parser.getText();

      await parser.destroy();

      return result.text;
    }

    // DOCX
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({
        buffer: dataBuffer
      });

      return result.value;
    }

    throw new Error(
      'Unsupported file type. Only PDF and DOCX are allowed.'
    );

  } catch (error) {
    if (parser) {
      await parser.destroy();
    }

    throw error;
  }
}

// ========================================
// GEMINI SCORING
// ========================================

async function scoreResume(fileName) {
  try {

    // ------------------------------------
    // STEP 1: Extract resume text
    // ------------------------------------

    const resumeText = await extractResumeText(fileName);

    console.log('✅ Resume text extracted.\n');

    // ------------------------------------
    // STEP 2: Create AI prompt
    // ------------------------------------

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
- Only include skills that are explicitly mentioned in the resume text.
- Do not infer or assume skills that aren't written.
- Base the score strictly on the rubric above.
- Do not add extra criteria.
- Be concise in the summary — 2 lines maximum.

Return ONLY valid JSON in this exact format:

{
  "score": <integer 0-100>,
  "breakdown": {
    "skills": <integer 0-40>,
    "experience": <integer 0-30>,
    "education": <integer 0-15>,
    "projects": <integer 0-15>
  },
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "summary": "<2-line explanation of the score>"
}
`;

  console.log('🤖 Sending resume to AI...\n');

    // ------------------------------------
    // STEP 3: Send to LLM
    // ------------------------------------

  const responseText = await generateWithLLM(prompt);

    // ------------------------------------
    // STEP 4: Clean Gemini response
    // ------------------------------------


    const cleanedResponse = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // ------------------------------------
    // STEP 5: Convert response to JSON
    // ------------------------------------

    const scoreResult = JSON.parse(cleanedResponse);

    // ------------------------------------
    // STEP 6: Display result
    // ------------------------------------

    console.log('✅ AI screening completed!\n');

    console.log('----- SCREENING RESULT -----\n');

    console.log(
      JSON.stringify(scoreResult, null, 2)
    );

    console.log('\n----- END -----');

  } catch (error) {

    console.error(
      '❌ Failed:',
      error.message
    );

  }
}

// ========================================
// TEST RESUME
// ========================================

// Change this filename to test another resume.

scoreResume('sample_resume.docx');