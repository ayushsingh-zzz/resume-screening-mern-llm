
const {
  validateEvidence
} = require('./screening/evidenceValidator');

const resumeText = `
Rahul Sharma

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

PROJECTS:
Student Management System
Academic project. Built using Java, Spring Boot and MySQL.

EDUCATION:
Bachelor of Technology in Computer Science
ABC University
2021 - 2025
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

  internships: [
    {
      role: 'Web Development Trainee',
      organization: 'BrightPath Learning',
      start_date: 'May 2022',
      end_date: 'June 2022',
      is_current: false,
      internship_type: 'training',
      description:
        'Completed a training internship in web development.'
    }
  ],

  projects: [
    {
      name: 'Student Management System',
      project_type: 'academic',
      technologies: ['Java', 'Spring Boot', 'MySQL'],
      description: 'Academic project.'
    }
  ],

  education: [
    {
      qualification: 'Bachelor of Technology',
      institution: 'ABC University',
      field_of_study: 'Computer Science',
      start_date: '2021',
      end_date: '2025',
      status: 'completed'
    }
  ]
};

// TEST 1: Valid evidence
const validEvaluation = {
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
      ]
    }
  ]
};

// TEST 2: Fabricated evidence
const fabricatedEvaluation = {
  evaluations: [
    {
      requirement_id: 'R2',
      status: 'MET',
      evidence: [
        {
          source_section: 'work_experience',
          evidence_quote:
            'Led a team of 10 Java developers.'
        }
      ]
    }
  ]
};

// TEST 3: Valid quote, wrong source section
const wrongSectionEvaluation = {
  evaluations: [
    {
      requirement_id: 'R3',
      status: 'MET',
      evidence: [
        {
          source_section: 'education',
          evidence_quote:
            'Developed REST APIs using Java and Spring Boot.'
        }
      ]
    }
  ]
};

// TEST 4: Empty evidence quote
const emptyEvidenceEvaluation = {
  evaluations: [
    {
      requirement_id: 'R4',
      status: 'MET',
      evidence: [
        {
          source_section: 'work_experience',
          evidence_quote: ''
        }
      ]
    }
  ]
};

// TEST 5: Altered evidence wording
const alteredEvidenceEvaluation = {
  evaluations: [
    {
      requirement_id: 'R5',
      status: 'MET',
      evidence: [
        {
          source_section: 'work_experience',
          evidence_quote:
            'Developed REST API endpoints using Java and Spring Boot.'
        }
      ]
    }
  ]
};

// TEST 6: Quote exists in resume but not in declared section
const wrongLocationEvaluation = {
  evaluations: [
    {
      requirement_id: 'R6',
      status: 'MET',
      evidence: [
        {
          source_section: 'work_experience',
          evidence_quote: 'Rahul Sharma'
        }
      ]
    }
  ]
};

// Test helper
function runTest(
  name,
  evaluation,
  expectedStatus,
  expectedEvidenceCount
) {
  try {
    validateEvidence(
      evaluation,
      resumeText,
      resumeData
    );

    const result = evaluation.evaluations[0];

    const passed =
      result.status === expectedStatus &&
      result.evidence.length === expectedEvidenceCount;

    console.log(
      `${passed ? 'PASS' : 'FAIL'}: ${name}`
    );

    console.log(`Status: ${result.status}`);
    console.log(
      `Valid evidence count: ${result.evidence.length}`
    );

    if (!passed) {
      console.log(
        `Expected status: ${expectedStatus}, evidence count: ${expectedEvidenceCount}`
      );

      process.exitCode = 1;
    }

  } catch (error) {
    console.log(`FAIL: ${name} - ${error.message}`);
    process.exitCode = 1;
  }
}

// Run all tests
console.log('\n=== EVIDENCE VALIDATOR TESTS ===');

runTest(
  'Valid evidence',
  validEvaluation,
  'MET',
  1
);

runTest(
  'Fabricated evidence',
  fabricatedEvaluation,
  'MISSING',
  0
);

runTest(
  'Wrong source section',
  wrongSectionEvaluation,
  'MISSING',
  0
);

runTest(
  'Empty evidence quote',
  emptyEvidenceEvaluation,
  'MISSING',
  0
);

runTest(
  'Altered evidence wording',
  alteredEvidenceEvaluation,
  'MISSING',
  0
);

runTest(
  'Quote outside declared section',
  wrongLocationEvaluation,
  'MISSING',
  0
);

// Final result
console.log('\n==============================');

if (process.exitCode) {
  console.log('SOME EVIDENCE TESTS FAILED');
} else {
  console.log('ALL EVIDENCE TESTS PASSED');
}

console.log('==============================');
