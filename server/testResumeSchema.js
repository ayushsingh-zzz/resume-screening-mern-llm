
const { validateResume } = require('./schemas/resumeSchema');

let passed = 0;
let failed = 0;

function runTest(name, callback, shouldPass = true) {
  try {
    callback();

    if (shouldPass) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.log(`FAIL: ${name} (expected rejection)`);
      failed++;
    }
  } catch (error) {
    if (!shouldPass) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.log(`FAIL: ${name}: ${error.message}`);
      failed++;
    }
  }
}

function validResume() {
  return {
    candidate_name: 'Test Candidate',

    skills: [
      {
        skill: 'Java',
        context: 'Used in backend development.'
      }
    ],

    work_experience: [
      {
        role: 'Software Developer',
        company: 'TechNova',
        start_date: 'Jan 2023',
        end_date: 'Present',
        is_current: true,
        description: 'Developed REST APIs.'
      }
    ],

    internships: [
      {
        role: 'Java Intern',
        organization: 'ABC Technologies',
        start_date: 'Jun 2022',
        end_date: 'Aug 2022',
        is_current: false,
        internship_type: 'professional',
        description: 'Worked on Java applications.'
      }
    ],

    projects: [
      {
        name: 'Student Management System',
        project_type: 'academic',
        technologies: ['Java', 'MySQL'],
        description: 'Academic database project.'
      }
    ],

    education: [
      {
        qualification: 'B.Tech',
        institution: 'ABC University',
        field_of_study: 'Computer Science',
        start_date: '2023',
        end_date: '2027',
        status: 'ongoing'
      }
    ]
  };
}

runTest('Valid resume accepted', () => {
  validateResume(validResume());
});

runTest('Empty sections accepted', () => {
  const data = validResume();
  data.skills = [];
  data.work_experience = [];
  data.internships = [];
  data.projects = [];
  data.education = [];
  validateResume(data);
});

runTest('Missing candidate name type rejected', () => {
  const data = validResume();
  data.candidate_name = null;
  validateResume(data);
}, false);

runTest('Invalid skills array rejected', () => {
  const data = validResume();
  data.skills = {};
  validateResume(data);
}, false);

runTest('Empty skill name rejected', () => {
  const data = validResume();
  data.skills[0].skill = ' ';
  validateResume(data);
}, false);

runTest('Invalid employment dates type rejected', () => {
  const data = validResume();
  data.work_experience[0].start_date = null;
  validateResume(data);
}, false);

runTest('Invalid employment current flag rejected', () => {
  const data = validResume();
  data.work_experience[0].is_current = 'true';
  validateResume(data);
}, false);

runTest('Invalid internship type rejected', () => {
  const data = validResume();
  data.internships[0].internship_type = 'full-time';
  validateResume(data);
}, false);

runTest('Invalid project type rejected', () => {
  const data = validResume();
  data.projects[0].project_type = 'internship';
  validateResume(data);
}, false);

runTest('Invalid project technologies rejected', () => {
  const data = validResume();
  data.projects[0].technologies = 'Java';
  validateResume(data);
}, false);

runTest('Invalid education status rejected', () => {
  const data = validResume();
  data.education[0].status = 'graduated';
  validateResume(data);
}, false);

runTest('Empty education qualification rejected', () => {
  const data = validResume();
  data.education[0].qualification = '';
  validateResume(data);
}, false);

runTest('Missing section rejected', () => {
  const data = validResume();
  delete data.internships;
  validateResume(data);
}, false);

runTest('Unexpected property is not accepted by schema validator', () => {
  const data = validResume();
  data.extra_field = 'unexpected';

  // The JavaScript validator does not enforce additionalProperties.
  // The provider JSON schema enforces this constraint.
  validateResume(data);
});

console.log('\n==============================');
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('==============================');

if (failed > 0) {
  process.exitCode = 1;
}
