
const evaluationSchema = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement_id: {
            type: 'string'
          },
          status: {
            type: 'string',
            enum: ['MET', 'PARTIAL', 'MISSING']
          },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source_section: {
                  type: 'string',
                  enum: [
                    'skills',
                    'work_experience',
                    'internships',
                    'projects',
                    'education'
                  ]
                },
                evidence_quote: {
                  type: 'string'
                }
              },
              required: ['source_section', 'evidence_quote'],
              additionalProperties: false
            }
          },
          relevant_work_experience_indices: {
            type: 'array',
            items: {
              type: 'integer'
            }
          },
          relevant_internship_indices: {
            type: 'array',
            items: {
              type: 'integer'
            }
          },
          explanation: {
            type: 'string'
          }
        },
        required: [
          'requirement_id',
          'status',
          'evidence',
          'relevant_work_experience_indices',
          'relevant_internship_indices',
          'explanation'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['evaluations'],
  additionalProperties: false
};

function validateEvaluation(data, requirements, resume) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Evaluation must be a JSON object.');
  }

  if (!Array.isArray(data.evaluations)) {
    throw new Error('Evaluations must be an array.');
  }

  const validStatuses = ['MET', 'PARTIAL', 'MISSING'];
  const validSections = [
    'skills',
    'work_experience',
    'internships',
    'projects',
    'education'
  ];

  const requirementIds = new Set(
    requirements.map(item => item.requirement_id)
  );

  const seenIds = new Set();

  for (const item of data.evaluations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid evaluation entry.');
    }

    if (!requirementIds.has(item.requirement_id)) {
      throw new Error(
        `Unknown requirement ID: ${item.requirement_id}`
      );
    }

    if (seenIds.has(item.requirement_id)) {
      throw new Error(
        `Duplicate evaluation: ${item.requirement_id}`
      );
    }

    seenIds.add(item.requirement_id);

    if (!validStatuses.includes(item.status)) {
      throw new Error(
        `Invalid status: ${item.requirement_id}`
      );
    }

    if (!Array.isArray(item.evidence)) {
      throw new Error(
        `Evidence must be an array: ${item.requirement_id}`
      );
    }

    for (const evidence of item.evidence) {
      if (
        !validSections.includes(evidence.source_section) ||
        typeof evidence.evidence_quote !== 'string' ||
        !evidence.evidence_quote.trim()
      ) {
        throw new Error(
          `Invalid evidence: ${item.requirement_id}`
        );
      }
    }

    if (
      item.status === 'MISSING' &&
      item.evidence.length !== 0
    ) {
      throw new Error(
        `MISSING requirement cannot contain evidence: ${item.requirement_id}`
      );
    }

    if (
      item.status !== 'MISSING' &&
      item.evidence.length === 0
    ) {
      throw new Error(
        `Evidence required for ${item.status}: ${item.requirement_id}`
      );
    }

    if (
      !Array.isArray(item.relevant_work_experience_indices) ||
      !Array.isArray(item.relevant_internship_indices)
    ) {
      throw new Error(
        `Invalid experience references: ${item.requirement_id}`
      );
    }

    for (const index of item.relevant_work_experience_indices) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= resume.work_experience.length
      ) {
        throw new Error(
          `Invalid work experience index: ${item.requirement_id}`
        );
      }
    }

    for (const index of item.relevant_internship_indices) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= resume.internships.length
      ) {
        throw new Error(
          `Invalid internship index: ${item.requirement_id}`
        );
      }
    }

    if (typeof item.explanation !== 'string') {
      throw new Error(
        `Invalid explanation: ${item.requirement_id}`
      );
    }
  }

  if (seenIds.size !== requirementIds.size) {
    const missingIds = [...requirementIds].filter(
      id => !seenIds.has(id)
    );

    throw new Error(
      `Missing evaluations for: ${missingIds.join(', ')}`
    );
  }

  return true;
}

module.exports = {
  evaluationSchema,
  validateEvaluation
};
