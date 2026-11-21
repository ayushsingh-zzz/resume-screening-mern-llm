
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

function validateResume(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resume data must be a JSON object.');
  }

  const arrayFields = [
    'skills',
    'work_experience',
    'internships',
    'projects',
    'education'
  ];

  if (typeof data.candidate_name !== 'string') {
    throw new Error('Invalid candidate_name.');
  }

  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) {
      throw new Error(`${field} must be an array.`);
    }
  }

  const isString = value => typeof value === 'string';

  for (const skill of data.skills) {
    if (!isString(skill.skill) || !isString(skill.context)) {
      throw new Error('Invalid skill entry.');
    }
  }

  for (const job of data.work_experience) {
    if (
      !isString(job.role) ||
      !isString(job.company) ||
      !isString(job.start_date) ||
      !isString(job.end_date) ||
      typeof job.is_current !== 'boolean' ||
      !isString(job.description)
    ) {
      throw new Error('Invalid work experience entry.');
    }
  }

  const internshipTypes = [
    'professional',
    'training',
    'academic',
    'unknown'
  ];

  for (const internship of data.internships) {
    if (
      !isString(internship.role) ||
      !isString(internship.organization) ||
      !isString(internship.start_date) ||
      !isString(internship.end_date) ||
      typeof internship.is_current !== 'boolean' ||
      !internshipTypes.includes(internship.internship_type) ||
      !isString(internship.description)
    ) {
      throw new Error('Invalid internship entry.');
    }
  }

  const projectTypes = [
    'academic',
    'personal',
    'professional',
    'unknown'
  ];

  for (const project of data.projects) {
    if (
      !isString(project.name) ||
      !projectTypes.includes(project.project_type) ||
      !Array.isArray(project.technologies) ||
      !project.technologies.every(isString) ||
      !isString(project.description)
    ) {
      throw new Error('Invalid project entry.');
    }
  }

  const educationStatuses = [
    'completed',
    'ongoing',
    'incomplete',
    'unknown'
  ];

  for (const education of data.education) {
    if (
      !isString(education.qualification) ||
      !isString(education.institution) ||
      !isString(education.field_of_study) ||
      !isString(education.start_date) ||
      !isString(education.end_date) ||
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
