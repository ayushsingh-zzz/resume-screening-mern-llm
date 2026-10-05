require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

// Gemini client
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/**
 * Send a prompt to the configured LLM.
 *
 * Primary provider:
 * Groq
 *
 * Fallback:
 * Gemini
 */
async function generateWithLLM(prompt) {

  // ========================================
  // PRIMARY: GROQ
  // ========================================

  if (process.env.GROQ_API_KEY) {
    try {

      console.log('🤖 Trying Groq...');

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },

          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],

            temperature: 0.2
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Groq API error: ${response.status}`
        );
      }

      const data = await response.json();

      const text =
        data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('Groq returned an empty response');
      }

      console.log('✅ Response received from Groq');

      return text;

    } catch (error) {

      console.error(
        '⚠️ Groq failed:',
        error.message
      );

      console.log('🔄 Falling back to Gemini...');
    }
  }

  // ========================================
  // FALLBACK: GEMINI
  // ========================================

  if (process.env.GEMINI_API_KEY) {

    try {

      console.log('🤖 Using Gemini...');

      const interaction =
        await gemini.interactions.create({
          model: 'gemini-3.6-flash',
          input: prompt
        });

      const text = interaction.output_text;

      if (!text) {
        throw new Error(
          'Gemini returned an empty response'
        );
      }

      console.log('✅ Response received from Gemini');

      return text;

    } catch (error) {

      console.error(
        '❌ Gemini failed:',
        error.message
      );

      throw new Error(
        'All configured LLM providers failed.'
      );
    }
  }

  throw new Error(
    'No LLM API keys configured.'
  );
}

module.exports = {
  generateWithLLM
};