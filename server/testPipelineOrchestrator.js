
const {
  runScreeningPipeline
} = require('./screening/screeningPipeline');

const resumeText = `
Rahul Sharma

PROFESSIONAL SUMMARY:
Software Developer with 2 years of experience.

SKILLS:
Java, Spring Boot, MongoDB, SQL

WORK EXPERIENCE:
Software Developer - TechNova Solutions
January 2023 - December 2024
Developed REST APIs using Java and Spring Boot.
Worked with MongoDB and SQL databases.

INTERNSHIP:
Trainee - BrightPath Learning
May 2022 - June 2022
Completed technical training.

PROJECTS:
Student Management System
Academic project developed using Java and MySQL.

EDUCATION:
B.Tech in Computer Science
Completed in 2024.
`;

const jobDescription = `
Java Backend Developer

Requirements:
- At least 3 years of professional Java experience.
- Strong knowledge of Spring Boot.
- Experience working with MongoDB.
- Bachelor's degree in Computer Science preferred.
`;

async function testPipeline() {
  try {
    const result = await runScreeningPipeline({
      resumeText,
      jobDescription,
      asOfDate: 'November 2026'
    });

    console.log('\n========== FINAL PIPELINE RESULT ==========');

    console.log(
      JSON.stringify({
        score: result.score,
        breakdown: result.breakdown,
        summary: result.summary,
        category_requirement_counts:
          result.category_requirement_counts,
        category_applicable:
          result.category_applicable,
        professional_experience:
          result.professional_experience,
        requirements: result.requirements
      }, null, 2)
    );

    console.log('\n========== PIPELINE CHECKS ==========');

    const checks = [
      {
        name: 'Final score generated',
        passed: Number.isFinite(result.score)
      },
      {
        name: 'All four categories returned',
        passed:
          Object.keys(result.breakdown).length === 4
      },
      {
        name: 'Requirements evaluated',
        passed: result.requirements.length > 0
      },
      {
        name: 'Professional experience calculated',
        passed:
          Number.isFinite(
            result.professional_experience.total_months
          )
      },
      {
        name: 'Screening details retained',
        passed:
          Boolean(result.screening_details?.parsed_resume) &&
          Boolean(result.screening_details?.job_analysis)
      }
    ];

    for (const check of checks) {
      console.log(
        `${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`
      );
    }

    const allPassed = checks.every(check => check.passed);

    console.log(
      '\nFINAL RESULT:',
      allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'
    );

    if (!allPassed) {
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\nPipeline test failed:', error.message);
    process.exitCode = 1;
  }
}

testPipeline();
