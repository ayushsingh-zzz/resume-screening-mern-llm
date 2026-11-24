
const { validateJD } = require('./schemas/jdSchema');

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

function validJD() {
  return {
    job_title: 'Python Backend Developer',
    requirements: [
      {
        requirement_id: 'R1',
        requirement: 'Minimum 2 years of professional Python experience.',
        category: 'experience',
        importance: 'mandatory',
        has_explicit_minimum_years: true,
        minimum_years: 2
      },
      {
        requirement_id: 'R2',
        requirement: 'Knowledge of Django.',
        category: 'skills',
        importance: 'important',
        has_explicit_minimum_years: false,
        minimum_years: 0
      }
    ]
  };
}

runTest('Valid JD accepted', () => {
  validateJD(validJD());
});

runTest('Empty requirements rejected', () => {
  const jd = validJD();
  jd.requirements = [];
  validateJD(jd);
}, false);

runTest('Duplicate IDs rejected', () => {
  const jd = validJD();
  jd.requirements[1].requirement_id = 'R1';
  validateJD(jd);
}, false);

runTest('Non-sequential IDs rejected', () => {
  const jd = validJD();
  jd.requirements[1].requirement_id = 'R3';
  validateJD(jd);
}, false);

runTest('Invalid category rejected', () => {
  const jd = validJD();
  jd.requirements[0].category = 'technology';
  validateJD(jd);
}, false);

runTest('Invalid importance rejected', () => {
  const jd = validJD();
  jd.requirements[0].importance = 'high';
  validateJD(jd);
}, false);

runTest('Explicit zero years rejected', () => {
  const jd = validJD();
  jd.requirements[0].minimum_years = 0;
  validateJD(jd);
}, false);

runTest('Unspecified non-zero years rejected', () => {
  const jd = validJD();
  jd.requirements[1].minimum_years = 2;
  validateJD(jd);
}, false);

runTest('Negative years rejected', () => {
  const jd = validJD();
  jd.requirements[0].minimum_years = -2;
  validateJD(jd);
}, false);

runTest('Missing job title rejected', () => {
  const jd = validJD();
  jd.job_title = '';
  validateJD(jd);
}, false);

runTest('Empty requirement text rejected', () => {
  const jd = validJD();
  jd.requirements[0].requirement = ' ';
  validateJD(jd);
}, false);

console.log('\n==============================');
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('==============================');

if (failed > 0) {
  process.exitCode = 1;
}
