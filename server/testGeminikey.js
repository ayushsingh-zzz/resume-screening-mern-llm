
require('dotenv').config();

async function testKey(name, key) {
  if (!key) {
    console.log(`${name}: NOT CONFIGURED`);
    return;
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      {
        headers: {
          'x-goog-api-key': key
        }
      }
    );

    console.log(`${name}: HTTP ${response.status}`);

    if (!response.ok) {
      const error = await response.json();
      console.log('Error:', JSON.stringify(error.error));
    } else {
      console.log(`${name}: Authentication successful.`);
    }
  } catch (error) {
    console.log(`${name}: ${error.message}`);
  }
}

async function run() {
  const googleKey = process.env.GOOGLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log(
    'Both keys identical:',
    Boolean(googleKey && geminiKey && googleKey === geminiKey)
  );

  await testKey('GOOGLE_API_KEY', googleKey);
  await testKey('GEMINI_API_KEY', geminiKey);
}

run();
