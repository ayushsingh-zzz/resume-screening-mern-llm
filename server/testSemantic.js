
require('dotenv').config();

const {
  calculateSemanticSimilarity
} = require('./services/embeddingService');

async function test() {
  try {
    const similarity = await calculateSemanticSimilarity(
      'Developed predictive machine learning models using Python and Scikit-learn.',
      'Experience with machine learning, predictive analytics and Python.'
    );

    console.log('Semantic similarity:', similarity);
    console.log(
      'Similarity percentage:',
      (similarity * 100).toFixed(2) + '%'
    );

  } catch (error) {
    console.error('Semantic test failed:', error.message);
  }
}

test();
