
const {
  analyzeJobDescription
} = require('./screening/jdAnalyzer');

async function test() {
  const jobDescription = `
  Job Title: Python Backend Developer

  Requirements:
  - Minimum 2 years of professional Python development experience.
  - Strong knowledge of Django or FastAPI.
  - Experience with REST API development.
  - Knowledge of PostgreSQL.
  - Bachelor's degree in Computer Science is preferred.
  `;

  try {
    const result = await analyzeJobDescription(jobDescription);

    console.log('\n--- JD ANALYZER RESULT ---');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('JD Analyzer failed:', error.message);
    process.exitCode = 1;
  }
}

test();
