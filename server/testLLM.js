require('dotenv').config();

const { generateWithLLM } = require('./services/llmService');

async function testLLM() {
  try {
    const prompt = `
You are testing an AI resume screening system.

Reply with exactly this JSON:

{
  "status": "success",
  "message": "LLM connection working"
}
`;

    console.log('🚀 Testing LLM...\n');

    const response = await generateWithLLM(prompt);

    console.log('\n========== LLM RESPONSE ==========');
    console.log(response);
    console.log('===================================\n');

  } catch (error) {
    console.error('❌ LLM TEST FAILED');
    console.error(error.message);
  }
}

testLLM();