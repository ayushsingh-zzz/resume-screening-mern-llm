
const jdSchema = {
  type: 'object',
  properties: {
    job_title: {
      type: 'string'
    },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement_id: {
            type: 'string'
          },
          requirement: {
            type: 'string'
          },
          category: {
            type: 'string',
            enum: ['skills', 'experience', 'education', 'projects']
          },
          importance: {
            type: 'string',
            enum: ['mandatory', 'important', 'preferred']
          },
          has_explicit_minimum_years: {
            type: 'boolean'
          },
          minimum_years: {
            type: 'number'
          }
        },
        required: [
          'requirement_id',
          'requirement',
          'category',
          'importance',
          'has_explicit_minimum_years',
          'minimum_years'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['job_title', 'requirements'],
  additionalProperties: false
};


function validateJD(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('JD analysis must be a JSON object.');
  }

  if (
    typeof data.job_title !== 'string' ||
    !data.job_title.trim()
  ) {
    throw new Error('Invalid or missing job_title.');
  }

  if (!Array.isArray(data.requirements)) {
    throw new Error('JD requirements must be an array.');
  }

  if (data.requirements.length === 0) {
    throw new Error('No valid job requirements were extracted.');
  }

  const validCategories = [
    'skills',
    'experience',
    'education',
    'projects'
  ];

  const validImportance = [
    'mandatory',
    'important',
    'preferred'
  ];

  const seenIds = new Set();

  for (let i = 0; i < data.requirements.length; i++) {
    const item = data.requirements[i];

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid requirement object.');
    }

    const expectedId = `R${i + 1}`;

    if (
      typeof item.requirement_id !== 'string' ||
      item.requirement_id !== expectedId
    ) {
      throw new Error(
        `Invalid requirement ID. Expected ${expectedId}.`
      );
    }

    if (seenIds.has(item.requirement_id)) {
      throw new Error(
        `Duplicate requirement ID: ${item.requirement_id}`
      );
    }

    seenIds.add(item.requirement_id);

    if (
      typeof item.requirement !== 'string' ||
      !item.requirement.trim()
    ) {
      throw new Error(
        `Invalid requirement text: ${item.requirement_id}`
      );
    }

    if (!validCategories.includes(item.category)) {
      throw new Error(
        `Invalid category: ${item.requirement_id}`
      );
    }

    if (!validImportance.includes(item.importance)) {
      throw new Error(
        `Invalid importance: ${item.requirement_id}`
      );
    }

    if (typeof item.has_explicit_minimum_years !== 'boolean') {
      throw new Error(
        `Invalid experience flag: ${item.requirement_id}`
      );
    }

    if (
      typeof item.minimum_years !== 'number' ||
      !Number.isFinite(item.minimum_years) ||
      item.minimum_years < 0
    ) {
      throw new Error(
        `Invalid minimum years: ${item.requirement_id}`
      );
    }

    if (
      item.has_explicit_minimum_years &&
      item.minimum_years <= 0
    ) {
      throw new Error(
        `Explicit minimum years must be greater than 0: ${item.requirement_id}`
      );
    }

    if (
      !item.has_explicit_minimum_years &&
      item.minimum_years !== 0
    ) {
      throw new Error(
        `Minimum years must be 0 when not explicitly specified: ${item.requirement_id}`
      );
    }
  }

  return true;
}


module.exports = {
  jdSchema,
  validateJD
};
