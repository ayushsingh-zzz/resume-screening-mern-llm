
const {
  analyzeJobDescription
} = require('./jdAnalyzer');

const {
  parseResumeWithLLM
} = require('./resumeParser');

const {
  evaluateRequirements
} = require('./requirementEvaluator');

const {
  validateAndEnforceEvaluation
} = require('./evaluationValidator');

const {
  calculateScores
} = require('./scoringEngine');


// Distinguish professional employment requirements
// from general practical technology requirements.
function isProfessionalExperienceRequirement(requirement) {
  const text = String(requirement.requirement || '').toLowerCase();

  return (
    requirement.has_explicit_minimum_years === true ||
    /\bprofessional experience\b/.test(text) ||
    /\b(?:professional )?work experience\b/.test(text) ||
    /\bemployment history\b/.test(text) ||
    /\bwork history\b/.test(text) ||
    /\bindustry experience\b/.test(text) ||
    /\binternships?\b/.test(text) ||
    /\bfreelance work\b/.test(text) ||
    /\bcontract work\b/.test(text) ||
    /\bclient-facing work\b/.test(text) ||
    /\b\d+\s*[-–]\s*\d+\s*years?\b/.test(text)
  );
}


// Normalize generic "experience with X" requirements into Skills.
function normalizeRequirementCategories(jobData) {
  for (const requirement of jobData.requirements) {
    if (
      requirement.category === 'experience' &&
      !isProfessionalExperienceRequirement(requirement)
    ) {
      requirement.original_category = requirement.category;
      requirement.category = 'skills';
    }
  }

  return jobData;
}


function getCurrentMonthYear() {
  const date = new Date();

  const monthNames = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}


async function runScreeningPipeline({
  resumeText,
  jobDescription,
  asOfDate = getCurrentMonthYear()
}) {
  if (
    typeof resumeText !== 'string' ||
    !resumeText.trim()
  ) {
    throw new Error('Resume text is required.');
  }

  if (
    typeof jobDescription !== 'string' ||
    !jobDescription.trim()
  ) {
    throw new Error('Job description is required.');
  }

  // STEP 1: Analyze the job description.
  console.log('\n[Pipeline 1/5] Analyzing job description...');

  let jobData = await analyzeJobDescription(jobDescription);

  // Correct category classification before evaluation.
  jobData = normalizeRequirementCategories(jobData);

  console.log(
    'Requirement categories:',
    jobData.requirements.map(item => ({
      requirement: item.requirement,
      category: item.category
    }))
  );

  // STEP 2: Parse the resume.
  console.log('\n[Pipeline 2/5] Parsing resume...');

  const resumeData = await parseResumeWithLLM(resumeText);

  // STEP 3: Evaluate requirements.
  console.log('\n[Pipeline 3/5] Evaluating requirements...');

  const evaluationData = await evaluateRequirements(
    jobData,
    resumeData
  );

  // STEP 4: Validate evidence and experience.
  console.log('\n[Pipeline 4/5] Validating evaluation...');

  const validatedEvaluation = validateAndEnforceEvaluation({
    evaluationData,
    jobData,
    resumeData,
    resumeText,
    asOfDate
  });

  // STEP 5: Calculate scores.
  console.log('\n[Pipeline 5/5] Calculating final scores...');

  const scoringResult = calculateScores({
    jobData,
    evaluationData: {
      evaluations: validatedEvaluation.evaluations
    }
  });

  console.log('\n[Pipeline] Screening completed successfully.');

  return {
    ...scoringResult,

    professional_experience:
      validatedEvaluation.professional_experience,

    screening_details: {
      job_analysis: jobData,
      parsed_resume: resumeData,
      evaluations: validatedEvaluation.evaluations
    }
  };
}


module.exports = {
  runScreeningPipeline
};
