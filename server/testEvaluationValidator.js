
const {
  validateAndEnforceEvaluation
} = require('./screening/evaluationValidator');

const resumeText = `
Rahul Sharma

SKILLS:
Java, Spring Boot, MongoDB

WORK EXPERIENCE:
Software Developer at TechNova Solutions
January 2023 - December 2024
Developed REST APIs using Java and Spring Boot.
Worked with MongoDB and SQL databases.
`;

const resumeData = {
  candidate_name: 'Rahul Sharma',
  skills: [
    { skill: 'Java', context: '' },
    { skill: 'Spring Boot', context: '' },
    { skill: 'MongoDB', context: '' }
  ],
  work_experience: [
    {
      role: 'Software Developer',
      company: 'TechNova Solutions',
      start_date: 'January 2023',
      end_date: 'December 2024',
      is_current: false,
      description:
        'Developed REST APIs using Java and Spring Boot. Worked with MongoDB and SQL databases.'
    }
  ],
  internships: [],
  projects: [],
  education: []
};

const jobData = {
  job_title: 'Java Backend Developer',
  requirements: [
    {
      requirement_id: 'R1',
      requirement: 'At least 3 years of professional Java experience',
      category: 'experience',
      importance: 'mandatory',
      has_explicit_minimum_years: true,
      minimum_years: 3
    }
  ]
};

const evaluationData = {
  evaluations: [
    {
      requirement_id: 'R1',
      status: 'MET',
      evidence: [
        {
          source_section: 'work_experience',
          evidence_quote:
            'Developed REST APIs using Java and Spring Boot.'
        }
      ],
      relevant_work_experience_indices: [0],
      relevant_internship_indices: [],
      explanation: 'Candidate meets the experience requirement.'
    }
  ]
};

const asOfDate = 'November 2026';

try {
  // TEST 1: Insufficient verified experience

  const result = validateAndEnforceEvaluation({
    evaluationData,
    jobData,
    resumeData,
    resumeText,
    asOfDate
  });

  const evaluation = result.evaluations[0];

  console.log('\n--- TEST 1: INSUFFICIENT EXPERIENCE ---');
  console.log(JSON.stringify(result, null, 2));

  const test1 =
    evaluation.status === 'PARTIAL' &&
    evaluation.verified_experience.total_months === 24 &&
    evaluation.verified_experience.verification_status === 'insufficient';

  console.log(
    '\nInsufficient experience test:',
    test1 ? 'PASS' : 'FAIL'
  );


  // TEST 2: Missing employment dates

  const resumeWithMissingDates = {
    ...resumeData,
    work_experience: [
      {
        ...resumeData.work_experience[0],
        start_date: '',
        end_date: ''
      }
    ]
  };

  const missingDateResult = validateAndEnforceEvaluation({
    evaluationData,
    jobData,
    resumeData: resumeWithMissingDates,
    resumeText,
    asOfDate
  });

  const missingDateEvaluation =
    missingDateResult.evaluations[0];

  console.log('\n--- TEST 2: MISSING EMPLOYMENT DATES ---');
  console.log(
    JSON.stringify(missingDateResult, null, 2)
  );

  const test2 =
    missingDateEvaluation.status === 'PARTIAL' &&
    missingDateEvaluation.verified_experience.verification_status === 'unverified' &&
    missingDateEvaluation.verified_experience.needs_manual_review === true;

  console.log(
    '\nMissing dates test:',
    test2 ? 'PASS' : 'FAIL'
  );


  // FINAL RESULT

  console.log('\n==============================');
  console.log(
    'FINAL RESULT:',
    test1 && test2 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'
  );
  console.log('==============================');

  if (!test1 || !test2) {
    process.exitCode = 1;
  }

} catch (error) {
  console.error(
    'Evaluation validation failed:',
    error.message
  );
  process.exitCode = 1;
}
