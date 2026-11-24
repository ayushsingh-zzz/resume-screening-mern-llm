require('dotenv').config();
const {
  analyzeJobDescription
} = require('./screening/jdAnalyzer');

const {
  parseResumeWithLLM
} = require('./screening/resumeParser');

const {
  evaluateRequirements
} = require('./screening/requirementEvaluator');

async function testScreeningPipeline() {
  const jobDescription = `
Java Backend Developer

Requirements:
- At least 3 years of professional Java development experience.
- Strong knowledge of Spring Boot.
- Knowledge of MongoDB.
- Bachelor's degree in Computer Science is preferred.
`;

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

EDUCATION:
Bachelor of Technology in Computer Science
ABC University
2021 - 2025
Status: Completed.
`;

  try {
    console.log('\n========== STAGE 1: JD ANALYSIS ==========');

    const jobData = await analyzeJobDescription(jobDescription);

    console.log(JSON.stringify(jobData, null, 2));

    console.log('\n========== STAGE 2: RESUME PARSING ==========');

    const resumeData = await parseResumeWithLLM(resumeText);

    console.log(JSON.stringify(resumeData, null, 2));

    console.log('\n========== STAGE 3: REQUIREMENT EVALUATION ==========');

    const evaluation = await evaluateRequirements(
      jobData,
      resumeData,
      [],
      resumeText
    );

    console.log(JSON.stringify(evaluation, null, 2));

    console.log('\n========== PIPELINE TEST COMPLETED ==========');

  } catch (error) {
    console.error('\nPIPELINE TEST FAILED:', error.message);
    process.exitCode = 1;
  }
}

testScreeningPipeline();
