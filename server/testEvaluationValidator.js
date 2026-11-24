
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

let passed = 0;
let failed = 0;

function recordTest(name, condition) {
  if (condition) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}`);
  }
}

function runValidation({
  evaluation,
  job,
  resume = resumeData,
  text = resumeText
}) {
  return validateAndEnforceEvaluation({
    evaluationData: evaluation,
    jobData: job,
    resumeData: resume,
    resumeText: text,
    asOfDate
  });
}

try {
  // TEST 1: Insufficient verified experience

  const result1 = runValidation({
    evaluation: evaluationData,
    job: jobData
  });

  const evaluation1 = result1.evaluations[0];

  console.log('\n--- TEST 1: INSUFFICIENT EXPERIENCE ---');
  console.log(JSON.stringify(result1, null, 2));

  recordTest(
    'Insufficient experience',
    evaluation1.status === 'PARTIAL' &&
    evaluation1.verified_experience.total_months === 24 &&
    evaluation1.verified_experience.verification_status === 'insufficient'
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

  const result2 = runValidation({
    evaluation: evaluationData,
    job: jobData,
    resume: resumeWithMissingDates
  });

  const evaluation2 = result2.evaluations[0];

  console.log('\n--- TEST 2: MISSING EMPLOYMENT DATES ---');
  console.log(JSON.stringify(result2, null, 2));

  recordTest(
    'Missing employment dates',
    evaluation2.status === 'PARTIAL' &&
    evaluation2.verified_experience.verification_status === 'unverified' &&
    evaluation2.verified_experience.needs_manual_review === true
  );


  // Shared internship test data

  const internshipQuote =
    'Built REST API endpoints using Java and Spring Boot.';

  const internshipResumeText = `
    Rahul Sharma
    INTERNSHIPS:
    Backend Intern at DevWorks
    June 2024 - August 2024
    ${internshipQuote}
  `;

  const internshipResumeData = {
    ...resumeData,
    internships: [
      {
        role: 'Backend Intern',
        company: 'DevWorks',
        start_date: 'June 2024',
        end_date: 'August 2024',
        description: internshipQuote
      }
    ]
  };

  const internshipJobData = {
    requirements: [
      {
        requirement_id: 'I1',
        requirement: 'Relevant backend development internship experience',
        category: 'experience',
        importance: 'mandatory',
        has_explicit_minimum_years: false
      }
    ]
  };


  // TEST 3: Relevant internship is recognized

  const result3 = runValidation({
    evaluation: {
      evaluations: [
        {
          requirement_id: 'I1',
          status: 'MET',
          evidence: [
            {
              source_section: 'internships',
              evidence_quote: internshipQuote
            }
          ],
          relevant_work_experience_indices: [],
          relevant_internship_indices: [0],
          explanation: 'Relevant internship found.'
        }
      ]
    },
    job: internshipJobData,
    resume: internshipResumeData,
    text: internshipResumeText
  });

  console.log('\n--- TEST 3: RELEVANT INTERNSHIP ---');
  console.log(JSON.stringify(result3.evaluations[0], null, 2));

  recordTest(
    'Relevant internship recognized',
    result3.evaluations[0].status === 'MET'
  );


  // TEST 4: Employment cannot substitute for internship

  const result4 = runValidation({
    evaluation: {
      evaluations: [
        {
          requirement_id: 'I1',
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
          explanation: 'Candidate has professional employment.'
        }
      ]
    },
    job: internshipJobData
  });

  console.log('\n--- TEST 4: EMPLOYMENT CANNOT SUBSTITUTE FOR INTERNSHIP ---');
  console.log(JSON.stringify(result4.evaluations[0], null, 2));

  recordTest(
    'Employment cannot substitute for internship',
    result4.evaluations[0].status === 'MISSING'
  );


  // TEST 5: Invalid internship index is rejected

  let test5 = false;

  try {
    runValidation({
      evaluation: {
        evaluations: [
          {
            requirement_id: 'I1',
            status: 'MET',
            evidence: [
              {
                source_section: 'internships',
                evidence_quote: internshipQuote
              }
            ],
            relevant_work_experience_indices: [],
            relevant_internship_indices: [5],
            explanation: 'Invalid internship reference.'
          }
        ]
      },
      job: internshipJobData,
      resume: internshipResumeData,
      text: internshipResumeText
    });
  } catch (error) {
    test5 = error.message.includes('Invalid internship index');
  }

  console.log('\n--- TEST 5: INVALID INTERNSHIP INDEX ---');

  recordTest(
    'Invalid internship index rejected',
    test5
  );


  // TEST 6: Skills evidence cannot establish professional employment

  const skillsOnlyResume = {
    ...resumeData,
    work_experience: [
      {
        ...resumeData.work_experience[0],
        description: 'Maintained internal documentation.'
      }
    ]
  };

  const skillsOnlyJob = {
    requirements: [
      {
        requirement_id: 'R1',
        requirement: 'Professional Java employment experience',
        category: 'experience',
        importance: 'mandatory',
        has_explicit_minimum_years: false
      }
    ]
  };

  const result6 = runValidation({
    evaluation: {
      evaluations: [
        {
          requirement_id: 'R1',
          status: 'MET',
          evidence: [
            {
              source_section: 'skills',
              evidence_quote: 'Java'
            }
          ],
          relevant_work_experience_indices: [0],
          relevant_internship_indices: [],
          explanation: 'Candidate has Java skills.'
        }
      ]
    },
    job: skillsOnlyJob,
    resume: skillsOnlyResume
  });

  console.log('\n--- TEST 6: SKILLS CANNOT PROVE PROFESSIONAL EMPLOYMENT ---');
  console.log(JSON.stringify(result6.evaluations[0], null, 2));

  recordTest(
    'Skills evidence cannot establish professional employment',
    result6.evaluations[0].status === 'MISSING'
  );


  // TEST 7: Skills evidence cannot establish an internship

  const result7 = runValidation({
    evaluation: {
      evaluations: [
        {
          requirement_id: 'I1',
          status: 'MET',
          evidence: [
            {
              source_section: 'skills',
              evidence_quote: 'Java'
            }
          ],
          relevant_work_experience_indices: [],
          relevant_internship_indices: [],
          explanation: 'Candidate has Java skills.'
        }
      ]
    },
    job: internshipJobData,
    resume: skillsOnlyResume
  });

  console.log('\n--- TEST 7: SKILLS CANNOT PROVE INTERNSHIP ---');
  console.log(JSON.stringify(result7.evaluations[0], null, 2));

  recordTest(
    'Skills evidence cannot establish internship',
    result7.evaluations[0].status === 'MISSING'
  );


  // TEST 8: Evidence must belong to the referenced employment record

  const twoEmploymentResume = {
    ...resumeData,
    work_experience: [
      {
        ...resumeData.work_experience[0],
        role: 'Junior Developer',
        company: 'Company A',
        description:
          'Developed REST APIs using Java and Spring Boot.'
      },
      {
        role: 'Software Developer',
        company: 'Company B',
        start_date: 'January 2023',
        end_date: 'December 2024',
        is_current: false,
        description:
          'Maintained internal documentation.'
      }
    ]
  };

  const twoEmploymentText = `
    ${resumeText}

    WORK EXPERIENCE:
    Junior Developer at Company A.
    Developed REST APIs using Java and Spring Boot.

    Software Developer at Company B.
    Maintained internal documentation.
  `;

  const twoEmploymentResult = runValidation({
    evaluation: {
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
          relevant_work_experience_indices: [1],
          relevant_internship_indices: [],
          explanation:
            'Candidate has professional Java experience.'
        }
      ]
    },
    job: skillsOnlyJob,
    resume: twoEmploymentResume,
    text: twoEmploymentText
  });

  console.log(
    '\n--- TEST 8: EVIDENCE MUST MATCH REFERENCED EMPLOYMENT ---'
  );

  console.log(
    JSON.stringify(twoEmploymentResult.evaluations[0], null, 2)
  );

  recordTest(
    'Evidence must match referenced employment record',
    twoEmploymentResult.evaluations[0].status === 'MISSING'
  );



  // FINAL RESULT

  console.log('\n==============================');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('==============================');

  if (failed > 0) {
    process.exitCode = 1;
    console.log('SOME TESTS FAILED');
  } else {
    console.log('ALL EVALUATION TESTS PASSED');
  }

} catch (error) {
  console.error(
    '\nEvaluation validation failed:',
    error.message
  );

  process.exitCode = 1;
}
