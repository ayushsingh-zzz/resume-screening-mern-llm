
const {
  classifyExperienceRequirement
} = require('./screening/experienceRequirementClassifier');

const testCases = [
  {
    name: 'Professional employment',
    requirement: '2 years of professional experience',
    expected: 'professional_employment'
  },
  {
    name: 'Internship',
    requirement: '1 year of internship experience',
    expected: 'internship'
  },
  {
    name: 'Freelance work',
    requirement: 'Freelance web development experience',
    expected: 'non_professional'
  },
  {
    name: 'Contract work',
    requirement: 'Contract work in software development',
    expected: 'non_professional'
  },
  {
    name: 'General technical experience',
    requirement: 'Experience with React and Node.js',
    expected: 'general_experience'
  },
  {
    name: 'Academic project experience',
    requirement: 'Experience developing academic projects',
    expected: 'general_experience'
  }
];

let passed = 0;
let failed = 0;

console.log('\n=== EXPERIENCE CLASSIFIER TESTS ===');

for (const test of testCases) {
  const actual = classifyExperienceRequirement({
    requirement: test.requirement
  });

  const success = actual === test.expected;

  console.log(
    `\n${success ? 'PASS' : 'FAIL'}: ${test.name}`
  );
  console.log(`Expected: ${test.expected}`);
  console.log(`Actual:   ${actual}`);

  if (success) {
    passed++;
  } else {
    failed++;
  }
}

console.log('\n==============================');
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('==============================');

if (failed > 0) {
  process.exit(1);
}

console.log('ALL CLASSIFIER TESTS PASSED');
