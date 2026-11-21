
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
      description: 'Completed a training internship in web development.'
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

// Test 1: Valid evidence
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

// Test 2: Fabricated evidence
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

// Test 3: Real quote, wrong section
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

function runTest(name, evaluation, shouldPass) {
  try {
    validateEvidence(
      evaluation,
      resumeText,
      resumeData
    );

    if (!shouldPass) {
      console.log(`FAIL: ${name} should have been rejected.`);
      return;
    }

    console.log(`PASS: ${name}`);

  } catch (error) {
    if (shouldPass) {
      console.log(`FAIL: ${name} - ${error.message}`);
      return;
    }

    console.log(`PASS: ${name} correctly rejected.`);
    console.log(error.message);
  }
}

runTest('Valid evidence', validEvaluation, true);
runTest('Fabricated evidence', fabricatedEvaluation, false);
runTest('Wrong source section', wrongSectionEvaluation, false);
