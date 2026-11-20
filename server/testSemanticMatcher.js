
require('dotenv').config();

const {
  matchRequirements
} = require('./services/semanticMatcher');

const resumeText = `
PROJECTS

Developed a machine learning prediction system
using Python, Pandas and Scikit-learn.

Built REST APIs using Node.js and Express.
Connected MongoDB for storing application data.

EXPERIENCE

Worked on backend development and database
management during a software development project.
`;

const requirements = [
  {
    name: 'Machine Learning',
    category: 'skills',
    importance: 'mandatory'
  },
  {
    name: 'REST API development',
    category: 'skills',
    importance: 'important'
  },
  {
    name: 'Database management',
    category: 'experience',
    importance: 'important'
  },
  {
    name: 'Cloud infrastructure management',
    category: 'skills',
    importance: 'preferred'
  }
];

async function test() {
  try {
    const results = await matchRequirements(
      resumeText,
      requirements
    );

    console.log('\nSEMANTIC MATCHING RESULTS\n');

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.requirement}`);

      console.log(
        'Similarity:',
        (result.similarity * 100).toFixed(2) + '%'
      );

      console.log('Evidence:', result.evidence);
      console.log('-------------------------');
    });

  } catch (error) {
    console.error('Semantic matching failed:', error.message);
  }
}

test();
