
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

const {
  classifyExperienceRequirement
} = require('./experienceRequirementClassifier');


async function retrieveSemanticEvidence(resumeText, requirements) {
  try {
    // Lazy loading keeps semantic retrieval optional.
    const {
      matchRequirements
    } = require('../services/semanticMatcher');

    const matcherRequirements = requirements
      .filter(item =>
        typeof item.requirement === 'string' &&
        item.requirement.trim()
      )
      .map(item => ({
        ...item,
        name: item.requirement
      }));

    if (matcherRequirements.length === 0) {
      return [];
    }

    const results = await matchRequirements(
      resumeText,
      matcherRequirements
    );

    if (!Array.isArray(results)) {
      throw new Error('Semantic matcher returned an invalid result.');
    }

    // The matcher preserves input order. Verify the association
    // before attaching each result to its requirement ID.
    const semanticMatches = [];

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const requirement = matcherRequirements[index];

      if (!requirement || !result) {
        console.warn(
          `[Pipeline] Skipping unmatched semantic result at index ${index}.`
        );
        continue;
      }

      if (result.requirement !== requirement.name) {
        console.warn(
          `[Pipeline] Semantic requirement mismatch for ${requirement.requirement_id}.`
        );
        continue;
      }

      semanticMatches.push({
        requirement_id: requirement.requirement_id,
        requirement: result.requirement,
        evidence: result.evidence,
        evidence_relevant: result.evidence_relevant,
        similarity: result.similarity,
        lexical_overlap: result.lexical_overlap,
        lexical_overlap_ratio: result.lexical_overlap_ratio
      });
    }

    return semanticMatches;

  } catch (error) {
    console.warn(
      '[Pipeline] Semantic retrieval unavailable:',
      error.message
    );

    // Semantic matching is supplementary.
    // Structured evaluation can continue without it.
    return [];
  }
}


// Normalize generic experience-with-X requirements into Skills.
function normalizeRequirementCategories(jobData) {
  for (const requirement of jobData.requirements) {
    const classification =
      classifyExperienceRequirement(requirement);

    requirement.experience_classification = classification;

    const hasExplicitMinimumYears =
      requirement.has_explicit_minimum_years === true;

    if (
      requirement.category === 'experience' &&
      classification !== 'professional_employment' &&
      classification !== 'internship' &&
      !hasExplicitMinimumYears
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

  // STEP 1: Analyze job description.
  console.log('\n[Pipeline 1/6] Analyzing job description...');

  let jobData = await analyzeJobDescription(jobDescription);

  if (!Array.isArray(jobData?.requirements)) {
    throw new Error('JD Analyzer returned invalid requirements.');
  }

  jobData = normalizeRequirementCategories(jobData);

  console.log(
    '[Pipeline] Requirement categories:',
    jobData.requirements.map(item => ({
      requirement_id: item.requirement_id,
      requirement: item.requirement,
      category: item.category,
      experience_classification: item.experience_classification
    }))
  );

  // STEP 2: Parse resume.
  console.log('\n[Pipeline 2/6] Parsing resume...');

  const resumeData = await parseResumeWithLLM(resumeText);

  if (!resumeData || !Array.isArray(resumeData.skills)) {
    throw new Error('Resume parser returned invalid structured data.');
  }

  // STEP 3: Retrieve semantic evidence.
  console.log('\n[Pipeline 3/6] Retrieving semantic evidence...');

  const semanticMatches = await retrieveSemanticEvidence(
    resumeText,
    jobData.requirements
  );

  console.log(
    '[Pipeline] Relevant semantic passages:',
    semanticMatches.filter(item => item.evidence_relevant).length,
    '/',
    semanticMatches.length
  );

  // STEP 4: Evaluate requirements.
  console.log('\n[Pipeline 4/6] Evaluating requirements...');

  const evaluationData = await evaluateRequirements(
     jobData,
     resumeData,
     semanticMatches,
     resumeText
  );

  // STEP 5: Validate evidence and experience.
  console.log('\n[Pipeline 5/6] Validating evaluation...');

  const validatedEvaluation = validateAndEnforceEvaluation({
    evaluationData,
    jobData,
    resumeData,
    resumeText,
    asOfDate
  });

  if (!Array.isArray(validatedEvaluation?.evaluations)) {
    throw new Error('Evaluation validation returned invalid results.');
  }

  // STEP 6: Calculate final scores.
  console.log('\n[Pipeline 6/6] Calculating final scores...');

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
      semantic_matches: semanticMatches,
      evaluations: validatedEvaluation.evaluations
    }
  };
}


module.exports = {
  runScreeningPipeline
};
