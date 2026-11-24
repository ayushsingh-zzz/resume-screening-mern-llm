
const resumeSchema = {
  type: 'object',
  properties: {
    candidate_name: {
      type: 'string'
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          context: { type: 'string' }
        },
        required: ['skill', 'context'],
        additionalProperties: false
      }
    },
    work_experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          is_current: { type: 'boolean' },
          description: { type: 'string' }
        },
        required: [
          'role',
          'company',
          'start_date',
          'end_date',
          'is_current',
          'description'
        ],
        additionalProperties: false
      }
    },
    internships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          organization: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          is_current: { type: 'boolean' },
          internship_type: {
            type: 'string',
            enum: ['professional', 'training', 'academic', 'unknown']
          },
          description: { type: 'string' }
        },
        required: [
          'role',
          'organization',
          'start_date',
          'end_date',
          'is_current',
          'internship_type',
          'description'
        ],
        additionalProperties: false
      }
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          project_type: {
            type: 'string',
            enum: ['academic', 'personal', 'professional', 'unknown']
          },
          technologies: {
            type: 'array',
            items: { type: 'string' }
          },
          description: { type: 'string' }
        },
        required: [
          'name',
          'project_type',
          'technologies',
          'description'
        ],
        additionalProperties: false
      }
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          qualification: { type: 'string' },
          institution: { type: 'string' },
          field_of_study: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          status: {
            type: 'string',
            enum: ['completed', 'ongoing', 'incomplete', 'unknown']
          }
        },
        required: [
          'qualification',
          'institution',
          'field_of_study',
          'start_date',
          'end_date',
          'status'
        ],
        additionalProperties: false
      }
    }
  },
  required: [
    'candidate_name',
    'skills',
    'work_experience',
    'internships',
    'projects',
    'education'
  ],
  additionalProperties: false
};


function isString(value) {
  return typeof value === 'string';
}

function hasText(value) {
  return isString(value) && value.trim().length > 0;
}

function validateStringFields(record, fields, section) {
  for (const field of fields) {
    if (!isString(record[field])) {
      throw new Error(
        `Invalid ${field} in ${section}.`
      );
    }
  }
}

function validateResume(data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error('Resume data must be a JSON object.');
  }

  if (!isString(data.candidate_name)) {
    throw new Error('Invalid candidate_name.');
  }

  const arrayFields = [
    'skills',
    'work_experience',
    'internships',
    'projects',
    'education'
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) {
      throw new Error(`${field} must be an array.`);
    }
  }

  // Skills
  for (const skill of data.skills) {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
      throw new Error('Invalid skill entry.');
    }

    validateStringFields(
      skill,
      ['skill', 'context'],
      'skills'
    );

    if (!hasText(skill.skill)) {
      throw new Error('Skill name cannot be empty.');
    }
  }

  // Professional employment
  for (const job of data.work_experience) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      throw new Error('Invalid work experience entry.');
    }

    validateStringFields(
      job,
      [
        'role',
        'company',
        'start_date',
        'end_date',
        'description'
      ],
      'work_experience'
    );

    if (
      typeof job.is_current !== 'boolean' ||
      !hasText(job.role) ||
      !hasText(job.company)
    ) {
      throw new Error('Invalid work experience entry.');
    }
  }

  // Internships
  const internshipTypes = [
    'professional',
    'training',
    'academic',
    'unknown'
  ];

  for (const internship of data.internships) {
    if (
      !internship ||
      typeof internship !== 'object' ||
      Array.isArray(internship)
    ) {
      throw new Error('Invalid internship entry.');
    }

    validateStringFields(
      internship,
      [
        'role',
        'organization',
        'start_date',
        'end_date',
        'description'
      ],
      'internships'
    );

    if (
      typeof internship.is_current !== 'boolean' ||
      !internshipTypes.includes(internship.internship_type) ||
      !hasText(internship.role) ||
      !hasText(internship.organization)
    ) {
      throw new Error('Invalid internship entry.');
    }
  }

  // Projects
  const projectTypes = [
    'academic',
    'personal',
    'professional',
    'unknown'
  ];

  for (const project of data.projects) {
    if (
      !project ||
      typeof project !== 'object' ||
      Array.isArray(project)
    ) {
      throw new Error('Invalid project entry.');
    }

    validateStringFields(
      project,
      ['name', 'description'],
      'projects'
    );

    if (
      !hasText(project.name) ||
      !projectTypes.includes(project.project_type) ||
      !Array.isArray(project.technologies) ||
      !project.technologies.every(
        technology => isString(technology)
      )
    ) {
      throw new Error('Invalid project entry.');
    }
  }

  // Education
  const educationStatuses = [
    'completed',
    'ongoing',
    'incomplete',
    'unknown'
  ];

  for (const education of data.education) {
    if (
      !education ||
      typeof education !== 'object' ||
      Array.isArray(education)
    ) {
      throw new Error('Invalid education entry.');
    }

    validateStringFields(
      education,
      [
        'qualification',
        'institution',
        'field_of_study',
        'start_date',
        'end_date'
      ],
      'education'
    );

    if (
      !hasText(education.qualification) ||
      !educationStatuses.includes(education.status)
    ) {
      throw new Error('Invalid education entry.');
    }
  }

  return true;
}


module.exports = {
  resumeSchema,
  validateResume
};
