
const { GoogleGenAI } = require('@google/genai');

const apiKey =
  process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Google Gemini API key is missing from .env');
}

const ai = new GoogleGenAI({ apiKey });

// Generate embeddings for multiple text inputs.
async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('A non-empty array of texts is required.');
  }

  if (!texts.every(text => typeof text === 'string' && text.trim())) {
    throw new Error('All embedding inputs must be non-empty strings.');
  }

  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: texts,
    config: {
      taskType: 'SEMANTIC_SIMILARITY'
    }
  });

  if (
    !response.embeddings ||
    response.embeddings.length !== texts.length
  ) {
    throw new Error('Embedding generation returned an unexpected result.');
  }

  return response.embeddings.map(embedding => embedding.values);
}

// Calculate cosine similarity between two vectors.
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    throw new Error('Invalid embedding vectors.');
  }

  const dotProduct = a.reduce(
    (sum, value, index) => sum + value * b[index],
    0
  );

  const magnitudeA = Math.sqrt(
    a.reduce((sum, value) => sum + value * value, 0)
  );

  const magnitudeB = Math.sqrt(
    b.reduce((sum, value) => sum + value * value, 0)
  );

  if (!magnitudeA || !magnitudeB) {
    throw new Error('Invalid embedding magnitude.');
  }

  return Number(
    Math.max(
      -1,
      Math.min(1, dotProduct / (magnitudeA * magnitudeB))
    ).toFixed(4)
  );
}

// Existing two-text similarity function.
async function calculateSemanticSimilarity(text1, text2) {
  const vectors = await generateEmbeddings([text1, text2]);

  return Number(
    Math.max(0, cosineSimilarity(vectors[0], vectors[1])).toFixed(4)
  );
}

module.exports = {
  generateEmbeddings,
  cosineSimilarity,
  calculateSemanticSimilarity
};
