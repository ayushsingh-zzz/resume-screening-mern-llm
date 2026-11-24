
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================

const GEMINI_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

const GEMINI_TIMEOUT =
  Number(process.env.GEMINI_TIMEOUT_MS) || 20000;

const RETRY_ATTEMPTS =
  Number(process.env.LLM_RETRY_ATTEMPTS) || 2;

const RETRY_BASE_MS =
  Number(process.env.LLM_RETRY_BASE_MS) || 5000;

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

const MAX_RETRY_AFTER_MS = 120000;


// ============================================
// DELAY HELPER
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================
// PARSE RETRY DELAY
// ============================================

function parseRetryDelay(value) {
  if (!value) return null;

  const trimmed = String(value).trim();

  const seconds = Number(trimmed);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(trimmed);

  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  const durationMatch = trimmed.match(
    /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i
  );

  if (durationMatch && (durationMatch[1] || durationMatch[2])) {
    const minutes = Number(durationMatch[1] || 0);
    const remainingSeconds = Number(durationMatch[2] || 0);

    return (minutes * 60 + remainingSeconds) * 1000;
  }

  return null;
}


// ============================================
// PROVIDER RETRY DELAY
// ============================================

function getProviderRetryDelay(headers) {
  const headerNames = [
    'retry-after',
    'x-ratelimit-reset-tokens',
    'x-ratelimit-reset-requests'
  ];

  for (const headerName of headerNames) {
    const value = headers?.get?.(headerName);

    const delay = parseRetryDelay(value);

    if (delay !== null) {
      return delay;
    }
  }

  return null;
}


// ============================================
// NETWORK ERROR DETECTION
// ============================================

function isRetryableNetworkError(error) {
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.name === 'TypeError'
  );
}


// ============================================
// SHARED FETCH WITH RETRY
// ============================================

async function fetchWithRetry(
  provider,
  url,
  options,
  retries = RETRY_ATTEMPTS
) {
  for (let attempt = 0; ; attempt++) {
    let response;

    try {
      // Create fresh request options for every attempt.
      // Important for Gemini timeout signals.

      const requestOptions =
        typeof options === 'function'
          ? options()
          : options;

      response = await fetch(url, requestOptions);

    } catch (error) {
      const retryable = isRetryableNetworkError(error);

      if (!retryable || attempt >= retries) {
        throw error;
      }

      const delay =
        RETRY_BASE_MS * (2 ** attempt) +
        Math.random() * 500;

      console.warn(
        `[${provider}] Network error: ${error.message}. ` +
        `Retry ${attempt + 1}/${retries} in ${Math.ceil(delay / 1000)}s`
      );

      await sleep(delay);

      continue;
    }

    if (response.ok) {
      return response;
    }

    const responseBody = await response.text();

    const error = new Error(
      `${provider} API error ${response.status}: ${responseBody}`
    );

    error.status = response.status;
    error.responseBody = responseBody;
    error.headers = response.headers;

    const retryable = RETRYABLE_STATUS_CODES.includes(
      response.status
    );

    if (!retryable || attempt >= retries) {
      throw error;
    }

    const providerDelay = getProviderRetryDelay(
      response.headers
    );

    const delay =
      providerDelay !== null
        ? providerDelay
        : RETRY_BASE_MS * (2 ** attempt) +
          Math.random() * 500;

    if (delay > MAX_RETRY_AFTER_MS) {
      console.warn(
        `[${provider}] Provider requested a retry delay of ` +
        `${Math.ceil(delay / 1000)}s. Moving to fallback.`
      );

      throw error;
    }

    console.warn(
      `[${provider}] HTTP ${response.status}. ` +
      `Retry ${attempt + 1}/${retries} in ${Math.ceil(delay / 1000)}s`
    );

    await sleep(delay);
  }
}


// ============================================
// GEMINI REST HELPER
// ============================================

async function generateWithGemini(prompt, schema = null) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing.');
  }

  console.log(`Using Gemini model: ${GEMINI_MODEL}`);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // Convert JSON Schema types to Gemini REST schema types.

  function convertSchema(node) {
    if (!node || typeof node !== 'object') {
      return node;
    }

    const converted = {};

    for (const [key, value] of Object.entries(node)) {
      if (key === 'type') {
        converted.type = value.toUpperCase();

      } else if (key === 'properties') {
        converted.properties = Object.fromEntries(
          Object.entries(value).map(([name, property]) => [
            name,
            convertSchema(property)
          ])
        );

      } else if (key === 'items') {
        converted.items = convertSchema(value);

      } else if (key === 'additionalProperties') {
        continue;

      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  const generationConfig = {
    temperature: 0,
    responseMimeType: schema ? 'application/json' : 'text/plain'
  };

  if (schema) {
    generationConfig.responseSchema = convertSchema(schema);
  }

  // Function creates a NEW timeout signal for every retry.

  const response = await fetchWithRetry(
    'Gemini',
    url,
    () => ({
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },

      signal: AbortSignal.timeout(GEMINI_TIMEOUT),

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig
      })
    })
  );

  const body = await response.text();

  let data;

  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Gemini returned an invalid API response.');
  }

  const output = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('');

  if (!output) {
    throw new Error(
      'Gemini returned an empty response. ' +
      `Finish reason: ${data?.candidates?.[0]?.finishReason || 'unknown'}`
    );
  }

  return output;
}


// ============================================
// GENERATE WITH LLM
// NON-STRUCTURED OUTPUT
// ============================================

async function generateWithLLM(prompt) {
  // PRIMARY: GROQ

  if (process.env.GROQ_API_KEY) {
    try {
      console.log('Trying Groq...');

      const model =
        process.env.GROQ_MODEL ||
        'llama-3.3-70b-versatile';

      const response = await fetchWithRetry(
        'Groq',
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },

          body: JSON.stringify({
            model,

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

      const data = await response.json();

      if (data?.choices?.[0]?.finish_reason === 'length') {
        throw new Error('Groq response was truncated.');
      }

      const output = data?.choices?.[0]?.message?.content;

      if (!output) {
        throw new Error('Groq returned an empty response.');
      }

      console.log('Groq generation successful.');

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

      const output = await generateWithGemini(prompt);

      console.log('Gemini fallback successful.');

      return output;

    } catch (error) {
      console.error('Gemini failed:', error.message);

      throw new Error(
        'Both Groq and Gemini providers failed. ' +
        error.message
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

      const model =
        process.env.GROQ_MODEL ||
        'llama-3.3-70b-versatile';

      console.log(`Groq model: ${model}`);

      const response = await fetchWithRetry(
        'Groq',
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },

          body: JSON.stringify({
            model,

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

      console.log('Switching to Gemini fallback...');
    }
  }

  // ==========================================
  // FALLBACK: GEMINI FLASH-LITE
  // ==========================================

  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(
        `Trying Gemini fallback for ${schemaName}...`
      );

      const output = await generateWithGemini(
        structuredPrompt,
        schema
      );

      const result = parseAndValidateJSON(
        output,
        validate,
        'Gemini'
      );

      console.log(
        `Gemini ${schemaName} successful.`
      );

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
