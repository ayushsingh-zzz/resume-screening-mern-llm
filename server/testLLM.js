require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testConnection() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const result = await model.generateContent(
      'Reply with exactly one sentence confirming this API connection works.'
    );

    console.log('✅ API connection successful!');
    console.log('Response:', result.response.text());
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
  }
}

testConnection();