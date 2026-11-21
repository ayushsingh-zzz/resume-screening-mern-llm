
require('dotenv').config();

const {
  generateStructuredOutput
} = require('./services/llmService');

const {
  resumeSchema,
  validateResume
} = require('./schemas/resumeSchema');

async function testResumeParser() {
  const resumeText = `
Rahul Sharma
Java Developer

SKILLS:
Java, Spring Boot, MongoDB, SQL, Git

WORK EXPERIENCE:
Software Developer at TechNova Solutions
January 2023 - December 2024
Developed REST APIs using Java and Spring Boot.
Worked with MongoDB and SQL databases.

INTERNSHIP:
Web Development Trainee at BrightPath Learning
May 2022 - June 2022
Completed a training internship in web development.
Learned HTML, CSS and JavaScript.

PROJECTS:
Student Management System
Academic project.
Built using Java, Spring Boot and MySQL.

Personal Portfolio Website
Personal project.
Built using HTML, CSS and JavaScript.

EDUCATION:
Bachelor of Technology in Computer Science
ABC University
2021 - 2025
Status: Completed.
`;

  const prompt = `
Extract structured information from the following resume.

RESUME:
${resumeText}

RULES:
1. Extract only explicitly stated information.
2. Keep professional employment separate from internships.
3. Classify BrightPath Learning as a training internship.
4. Classify Student Management System as academic.
5. Classify Personal Portfolio Website as personal.
6. Never convert projects into professional work experience.
7. Preserve dates as written.
8. Do not invent missing information.
9. Use empty arrays for unavailable sections.
10. Use empty strings for unavailable string values.
11. Return JSON only.
`;

  try {
    console.log('Starting structured resume parsing...');

    const result = await generateStructuredOutput({
      prompt,
      schema: resumeSchema,
      validate: validateResume,
      schemaName: 'Resume Parser'
    });

    console.log('\n--- VALIDATED RESUME OUTPUT ---');
    console.log(JSON.stringify(result, null, 2));

    console.log('\nResume Parser test passed.');

  } catch (error) {
    console.error('\nResume Parser test failed:', error.message);
    process.exitCode = 1;
  }
}

testResumeParser();
