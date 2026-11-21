
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 45000
  }
});


// ============================================
// GENERATE WITH LLM (EXISTING FUNCTION)
// ============================================

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
        throw new Error('Groq response was truncated.');
      }

      const output = data?.choices?.[0]?.message?.content;

      if (!output) {
        throw new Error('Groq returned an empty response.');
      }

      console.log('Groq evaluation successful.');

      return output;

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
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        input: prompt
      });

      const output = interaction.output_text;

      if (!output) {
        throw new Error('Gemini returned an empty response.');
      }

      console.log('Gemini fallback successful.');

      return output;

    } catch (error) {
      console.error('Gemini failed:', error.message);

      throw new Error(
        'Both Groq and Gemini providers failed.'
      );
    }
  }

  throw new Error('No working LLM provider is configured.');
}


// ============================================
// JSON PARSING AND VALIDATION
// ============================================

function parseAndValidateJSON(text, validate, provider) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${provider} returned invalid JSON.`);
  }

  if (typeof validate !== 'function') {
    throw new Error('A validation function is required.');
  }

  validate(parsed);

  return parsed;
}


// ============================================
// STRUCTURED OUTPUT GENERATION
// ============================================

async function generateStructuredOutput({
  prompt,
  schema,
  validate,
  schemaName = 'structured_output',
  maxTokens = 8192
}) {

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('A valid prompt is required.');
  }

  if (typeof validate !== 'function') {
    throw new Error('A validation function is required.');
  }

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('A valid JSON schema is required.');
  }


  const structuredPrompt = `
${prompt}

IMPORTANT: YOUR OUTPUT MUST FOLLOW THIS JSON SCHEMA EXACTLY.

${JSON.stringify(schema, null, 2)}

Requirements:
- Include every required property.
- Use the exact property names defined in the schema.
- Do not introduce alternative property names.
- Do not add properties that are not defined in the schema.
- Return JSON only.
`;


  const errors = [];


  // ==========================================
  // PRIMARY: GROQ
  // ==========================================

  if (process.env.GROQ_API_KEY) {
    try {
      console.log(`Trying Groq for ${schemaName}...`);

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
                role: 'system',
                content:
                  'Return only valid JSON. Follow the requested output structure exactly. Do not include markdown or explanations outside the JSON.'
              },
              {
                role: 'user',
                content: structuredPrompt
              }
            ],
            temperature: 0,
            max_completion_tokens: maxTokens,
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
        throw new Error('Groq response was truncated.');
      }

      const output = data?.choices?.[0]?.message?.content;

      if (!output) {
        throw new Error('Groq returned an empty response.');
      }

      const result = parseAndValidateJSON(
        output,
        validate,
        'Groq'
      );

      console.log(`Groq ${schemaName} successful.`);

      return result;

    } catch (error) {
      errors.push(`Groq: ${error.message}`);

      console.error(
        'Groq structured generation failed:',
        error.message
      );
    }
  }


  // ==========================================
  // FALLBACK: GEMINI
  // ==========================================

  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(`Trying Gemini fallback for ${schemaName}...`);

      const interaction = await gemini.interactions.create({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        input: structuredPrompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: schema
        }
      });

      const output = interaction.output_text;

      if (!output) {
        throw new Error('Gemini returned an empty response.');
      }

      const result = parseAndValidateJSON(
        output,
        validate,
        'Gemini'
      );

      console.log(`Gemini ${schemaName} successful.`);

      return result;

    } catch (error) {
      errors.push(`Gemini: ${error.message}`);

      console.error(
        'Gemini structured generation failed:',
        error.message
      );
    }
  }


  // ==========================================
  // BOTH PROVIDERS FAILED
  // ==========================================

  throw new Error(
    `Structured generation failed for ${schemaName}. ` +
    errors.join(' | ')
  );
}


// ============================================
// EXPORTS
// ============================================

module.exports = {
  generateWithLLM,
  generateStructuredOutput
};
