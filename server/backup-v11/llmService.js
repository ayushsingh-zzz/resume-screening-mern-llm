
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function generateWithLLM(prompt) {
  // PRIMARY: GROQ
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('Trying Groq...');

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL ||
              'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0,
            max_completion_tokens: 8192,
            response_format: {
              type: 'json_object'
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      if (data?.choices?.[0]?.finish_reason === 'length') {
      throw new Error('Groq response was truncated by the output token limit.');
      }

      console.log('\n--- GROQ RESPONSE DETAILS ---');
      console.log('Finish reason:', data?.choices?.[0]?.finish_reason);
      console.log('Completion tokens:', data?.usage?.completion_tokens);
      console.log('Prompt tokens:', data?.usage?.prompt_tokens);

      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('Groq returned an empty response.');
      }

      console.log('Groq evaluation successful.');

      return text;

    } catch (error) {
      console.error('Groq failed:', error.message);
      console.log('Switching to Gemini fallback...');
    }
  }

  // FALLBACK: GEMINI
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('Using Gemini fallback...');

      const interaction = await gemini.interactions.create({
        model: 'gemini-3.6-flash',
        input: prompt
      });

      const text = interaction.output_text;

      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      console.log('Gemini fallback successful.');

      return text;

    } catch (error) {
      console.error('Gemini failed:', error.message);

      throw new Error(
        'Both Groq and Gemini providers failed.'
      );
    }
  }

  throw new Error('No working LLM provider is configured.');
}

module.exports = {
  generateWithLLM
};
