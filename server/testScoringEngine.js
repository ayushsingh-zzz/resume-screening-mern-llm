
const {
  calculateScores
} = require('./screening/scoringEngine');

const jobData = {
  requirements: [
    {
      requirement_id: 'R1',
      requirement: 'Java',
      category: 'skills',
      importance: 'mandatory'
    },
    {
      requirement_id: 'R2',
      requirement: 'Spring Boot',
      category: 'skills',
      importance: 'important'
    },
    {
      requirement_id: 'R3',
      requirement: 'Professional experience',
      category: 'experience',
      importance: 'mandatory'
    },
    {
      requirement_id: 'R4',
      requirement: 'Bachelor degree',
      category: 'education',
      importance: 'preferred'
    }
  ]
};

const evaluationData = {
  evaluations: [
    {
      requirement_id: 'R1',
      status: 'MET',
      evidence: []
    },
    {
      requirement_id: 'R2',
      status: 'PARTIAL',
      evidence: []
    },
    {
      requirement_id: 'R3',
      status: 'PARTIAL',
      evidence: []
    },
    {
      requirement_id: 'R4',
      status: 'MET',
      evidence: []
    }
  ]
};

try {
  const result = calculateScores({
    jobData,
    evaluationData
  });

  console.log('\n--- SCORING ENGINE RESULT ---');
  console.log(JSON.stringify(result, null, 2));

  const tests = [
    {
      name: 'Skills score',
      passed: result.breakdown.skills === 32
    },
    {
      name: 'Experience score',
      passed: result.breakdown.experience === 15
    },
    {
      name: 'Education score',
      passed: result.breakdown.education === 15
    },
    {
      name: 'Empty projects category contributes zero',
      passed:
        result.breakdown.projects === 0 &&
        result.category_applicable.projects === false &&
        result.category_maximums.projects === 15
    },
    {
      name: 'Overall score follows frozen v11 denominator',
      passed: result.score === 62
    },
    {
      name: 'Fixed scoring maximum remains 100',
      passed: result.applicable_maximum === 100
    },
    {
      name: 'Matched skills',
      passed: result.matched_skills.includes('Java')
    },
    {
      name: 'Partially matched skills',
      passed: result.partially_matched_skills.includes('Spring Boot')
    }
  ];

  console.log('\n--- TEST RESULTS ---');

  for (const test of tests) {
    console.log(
      `${test.name}: ${test.passed ? 'PASS' : 'FAIL'}`
    );
  }

  const allPassed = tests.every(test => test.passed);

  console.log(
    '\nFINAL RESULT:',
    allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'
  );

  if (!allPassed) {
    process.exitCode = 1;
  }

} catch (error) {
  console.error('Scoring test failed:', error.message);
  process.exitCode = 1;
}
