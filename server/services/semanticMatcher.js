
const {
  generateEmbeddings,
  cosineSimilarity
} = require('./embeddingService');

const BATCH_SIZE = 40;

// Words that do not meaningfully identify a requirement.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to',
  'for', 'with', 'by', 'from', 'as', 'is', 'are', 'be',
  'have', 'has', 'had', 'using', 'used', 'use', 'work',
  'worked', 'working', 'ability', 'knowledge', 'familiarity',
  'experience', 'good', 'strong', 'minimum', 'at', 'least',
  'understanding', 'related', 'field'
]);

const SECTION_HEADINGS = new Set([
  'skills',
  'technical skills',
  'professional skills',
  'experience',
  'work experience',
  'professional experience',
  'education',
  'projects',
  'personal projects',
  'academic projects',
  'certifications',
  'achievements',
  'languages',
  'interests',
  'summary',
  'profile',
  'objective',
  'references'
]);

// Requirement-specific evidence rules.
// Each group must have at least one matching phrase.
const REQUIREMENT_RULES = [
  {
    pattern: /\bnode\.?js\b|\bnodejs\b/i,
    groups: [
      ['node.js', 'nodejs', 'node js']
    ]
  },
  {
    pattern: /\bexpress\.?js\b|\bexpressjs\b/i,
    groups: [
      ['express.js', 'expressjs', 'express js']
    ]
  },
  {
    pattern: /\bmongodb\b/i,
    groups: [
      ['mongodb', 'mongo db']
    ]
  },
  {
    pattern: /\bcloud\b|\bdeploy(?:ment|ing|ed)?\b/i,
    groups: [
      [
        'aws', 'amazon web services',
        'google cloud', 'gcp',
        'microsoft azure', 'azure',
        'vercel', 'netlify',
        'heroku', 'render',
        'digitalocean', 'cloud platform'
      ],
      [
        'deploy', 'deployed', 'deployment',
        'hosting', 'hosted', 'published',
        'production environment'
      ]
    ]
  },
  {
    pattern: /client.server|server.client|client side.*server|server side.*client/i,
    groups: [
      [
        'client', 'client side', 'frontend',
        'front end', 'react', 'browser',
        'user interface'
      ],
      [
        'server', 'server side', 'backend',
        'back end', 'rest api', 'rest apis',
        'http', 'request', 'response'
      ]
    ]
  },
  {
    pattern: /problem.solv|debugg/i,
    groups: [
      [
        'problem solving', 'solved problems',
        'analytical thinking', 'logical thinking',
        'troubleshooting', 'debugging',
        'debugged', 'bug fixing',
        'resolved errors', 'resolved issues'
      ]
    ]
  },
  {
    pattern: /clean.*maintainable.*code|maintainable.*code|clean.*code/i,
    groups: [
      [
        'clean code', 'maintainable code',
        'readable code', 'modular code',
        'code quality', 'code refactoring',
        'reusable components', 'coding standards'
      ]
    ]
  },
  {
    pattern: /communication|teamwork|team work/i,
    groups: [
      [
        'teamwork', 'team work',
        'collaborated', 'collaboration',
        'cross functional team',
        'worked in a team',
        'team projects',
        'communication skills'
      ]
    ]
  },
  {
    pattern: /authentication|authorization/i,
    groups: [
      [
        'authentication', 'authorization',
        'user authentication',
        'access control',
        'jwt', 'json web token',
        'oauth', 'login system',
        'role based access'
      ]
    ]
  },
  {
    pattern: /data structures|algorithms|\bDSA\b/i,
    groups: [
      [
        'data structures', 'algorithms',
        'data structure and algorithms',
        'sorting algorithms',
        'searching algorithms',
        'linked lists', 'trees',
        'graphs', 'dynamic programming',
        'leetcode', 'competitive programming'
      ]
    ]
  },
  {
    pattern: /at least.*years|years of experience|minimum.*years/i,
    groups: [
      [
        'year of experience',
        'years of experience',
        'years experience',
        'professional experience'
      ]
    ]
  }
];

function normalizeToken(token) {
  let word = token.toLowerCase().replace(/[^a-z0-9+#.]/g, '');

  if (word.length > 3 && word.endsWith('ies')) {
    word = word.slice(0, -3) + 'y';
  } else if (
    word.length > 3 &&
    word.endsWith('s') &&
    !word.endsWith('ss')
  ) {
    word = word.slice(0, -1);
  }

  return word;
}

function getMeaningfulTokens(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .map(normalizeToken)
      .filter(
        word =>
          word.length > 1 &&
          !STOP_WORDS.has(word)
      )
  );
}

function isSectionHeading(line) {
  const normalized = line
    .replace(/[:\-–—]/g, '')
    .trim()
    .toLowerCase();

  if (SECTION_HEADINGS.has(normalized)) {
    return true;
  }

  return (
    line.length <= 35 &&
    /^[A-Z\s&/]+$/.test(line.trim()) &&
    line.trim().length > 1
  );
}

// Join wrapped resume lines into more complete passages.
function splitResumeIntoChunks(resumeText) {
  const lines = resumeText
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  function saveCurrent() {
    if (current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
  }

  for (const line of lines) {
    if (isSectionHeading(line)) {
      saveCurrent();
      continue;
    }

    const startsWithLowercase = /^[a-z]/.test(line);

    if (current && startsWithLowercase) {
      current += ' ' + line;
    } else {
      saveCurrent();
      current = line;
    }

    if (current.length > 500) {
      const sentences = current.match(/[^.!?]+[.!?]?/g) || [current];

      for (const sentence of sentences) {
        if (sentence.trim()) {
          chunks.push(sentence.trim());
        }
      }

      current = '';
    }
  }

  saveCurrent();

  return chunks;
}

// Generate embeddings in smaller batches.
async function generateAllEmbeddings(texts) {
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(batch);

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

function calculateLexicalOverlap(requirement, evidence) {
  const requirementTokens = getMeaningfulTokens(requirement);
  const evidenceTokens = getMeaningfulTokens(evidence);

  if (requirementTokens.size === 0) {
    return {
      overlap: 0,
      ratio: 0
    };
  }

  let overlap = 0;

  for (const token of requirementTokens) {
    if (evidenceTokens.has(token)) {
      overlap++;
    }
  }

  return {
    overlap,
    ratio: Number(
      (overlap / requirementTokens.size).toFixed(4)
    )
  };
}

// Safely check whether a phrase appears as a complete term.
function containsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,
    'i'
  );

  return pattern.test(text);
}

// Find a requirement-specific evidence rule.
function getRequirementRule(requirement) {
  return REQUIREMENT_RULES.find(rule =>
    rule.pattern.test(requirement)
  );
}

// Check whether evidence satisfies all required concept groups.
function satisfiesRequirementRule(requirement, evidence) {
  const rule = getRequirementRule(requirement);

  if (!rule) {
    return null;
  }

  const normalizedEvidence = evidence.toLowerCase();

  return rule.groups.every(group =>
    group.some(phrase =>
      containsPhrase(normalizedEvidence, phrase)
    )
  );
}

// Generic fallback for requirements without a special rule.
// A single shared generic word is not sufficient.
function satisfiesGenericEvidence(requirement, evidence) {
  const lexical = calculateLexicalOverlap(
    requirement,
    evidence
  );

  if (lexical.overlap >= 2) {
    return true;
  }

  const requirementTokens = getMeaningfulTokens(requirement);

  return (
    requirementTokens.size === 1 &&
    lexical.overlap === 1
  );
}

// Decide whether a resume passage is relevant evidence.
function isRelevantEvidence(requirement, evidence) {
  const ruleResult = satisfiesRequirementRule(
    requirement,
    evidence
  );

  if (ruleResult !== null) {
    return ruleResult;
  }

  return satisfiesGenericEvidence(requirement, evidence);
}

// Find relevant resume evidence for each requirement.
async function matchRequirements(resumeText, requirements) {
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    throw new Error('Resume text is required.');
  }

  if (!Array.isArray(requirements) || requirements.length === 0) {
    return [];
  }

  const chunks = splitResumeIntoChunks(resumeText);

  const validRequirements = requirements.filter(
    requirement =>
      requirement &&
      typeof requirement.name === 'string' &&
      requirement.name.trim()
  );

  if (!chunks.length || !validRequirements.length) {
    return [];
  }

  console.log('Resume chunks:', chunks.length);
  console.log(
    'Requirements to compare:',
    validRequirements.length
  );

  const resumeEmbeddings = await generateAllEmbeddings(chunks);

  const requirementTexts = validRequirements.map(
    requirement => requirement.name.trim()
  );

  const requirementEmbeddings =
    await generateAllEmbeddings(requirementTexts);

  const results = validRequirements.map(
    (requirement, requirementIndex) => {

      let bestSemanticSimilarity = -1;
      let bestRelevantSimilarity = -1;
      let bestEvidence = '';
      let bestOverlap = 0;
      let bestOverlapRatio = 0;

      resumeEmbeddings.forEach((resumeVector, chunkIndex) => {
        const similarity = cosineSimilarity(
          requirementEmbeddings[requirementIndex],
          resumeVector
        );

        const evidence = chunks[chunkIndex];

        const lexical = calculateLexicalOverlap(
          requirement.name,
          evidence
        );

        bestSemanticSimilarity = Math.max(
          bestSemanticSimilarity,
          similarity
        );

        // A passage must pass the evidence relevance check.
        if (
          isRelevantEvidence(requirement.name, evidence) &&
          similarity > bestRelevantSimilarity
        ) {
          bestRelevantSimilarity = similarity;
          bestEvidence = evidence;
          bestOverlap = lexical.overlap;
          bestOverlapRatio = lexical.ratio;
        }
      });

      const evidenceRelevant = Boolean(bestEvidence);

      return {
        requirement: requirement.name,
        category: requirement.category,
        importance: requirement.importance,

        // Retrieval similarity only. Not a qualification score.
        similarity: Number(
          Math.max(0, bestSemanticSimilarity).toFixed(4)
        ),

        evidence: bestEvidence,
        evidence_relevant: evidenceRelevant,
        lexical_overlap: bestOverlap,
        lexical_overlap_ratio: bestOverlapRatio
      };
    }
  );

  return results;
}

module.exports = {
  matchRequirements,
  splitResumeIntoChunks,
  calculateLexicalOverlap
};
