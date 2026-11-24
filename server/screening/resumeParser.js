
const {
  generateStructuredOutput
} = require('../services/llmService');

const {
  resumeSchema,
  validateResume
} = require('../schemas/resumeSchema');


async function parseResumeWithLLM(resumeText) {
  if (
    typeof resumeText !== 'string' ||
    !resumeText.trim()
  ) {
    throw new Error('Resume text is empty or invalid.');
  }

  if (resumeText.trim().length < 30) {
    throw new Error(
      'Resume text is too short for reliable extraction.'
    );
  }

  const prompt = `
You are an expert resume information extraction system.

Extract structured information from the resume below.

RESUME:
${resumeText.trim()}

GENERAL EXTRACTION RULES:

1. Extract only information explicitly supported by the resume.
2. Never invent names, dates, employers, qualifications,
   skills, technologies or responsibilities.
3. Preserve original technical terminology.
4. Do not infer employment from a project or internship.
5. Do not infer degree completion from an expected graduation date.
6. Use empty strings for unavailable string values.
7. Use empty arrays for sections with no entries.
8. Preserve meaningful descriptions without adding assumptions.
9. Do not duplicate the same record across sections.
10. Return JSON matching the supplied schema exactly.

CANDIDATE:

- Extract the candidate's name when available.
- If it is unavailable, use an empty string.

SKILLS:

- Extract explicitly mentioned technical and professional skills.
- Include programming languages, frameworks, databases,
  tools and relevant competencies.
- The context should briefly describe where the skill is
  demonstrated, if the resume provides that information.
- Do not infer a skill merely because it is commonly associated
  with a listed job title.
- If context is unavailable, use an empty string.

PROFESSIONAL WORK EXPERIENCE:

Include only actual employment records supported by the resume.

Examples:
- Full-time employment.
- Part-time employment.

Do not include:
- Internships.
- Academic projects.
- Personal projects.
- Training courses.
- Certifications.
- Freelance or contract work as ordinary employment records.

For each employment record extract:
- role
- company
- start_date
- end_date
- is_current
- description

Keep date values in their original stated format.
Do not invent missing months or years.

If the role or company cannot be established, do not create
an unreliable employment record.

For current employment:
- is_current must be true only when the resume indicates
  that the person is currently employed.
- end_date should be "Present" when explicitly stated,
  otherwise an empty string if unavailable.

For non-current employment:
- is_current must be false.

INTERNSHIPS:

Keep internships separate from professional employment.

Extract internships even when they are training-oriented
or part of an academic programme.

Classify internship_type as:

- professional: an actual industry or professional internship.
- training: primarily a training or learning programme.
- academic: explicitly part of an academic curriculum.
- unknown: the type cannot reliably be determined.

Do not automatically classify every internship as professional.

Extract role, organization, dates, current status and description.
Do not invent missing dates.

PROJECTS:

Extract academic, personal and professional projects.

Classify project_type as:

- academic: college, university, coursework or academic projects.
- personal: independently created personal projects.
- professional: projects performed as part of actual employment.
- unknown: classification is unclear.

A project must never be converted into a work experience record.

Extract:
- name
- project_type
- technologies
- description

Do not add technologies that are not mentioned or clearly
identified in the project description.

EDUCATION:

Extract each qualification separately.

Extract:
- qualification
- institution
- field_of_study
- start_date
- end_date
- status

Use only these statuses:

- completed: explicitly completed or awarded.
- ongoing: currently being pursued.
- incomplete: explicitly discontinued or not completed.
- unknown: completion status cannot be determined.

IMPORTANT:
- An expected graduation date does not mean completed.
- A currently enrolled degree must be ongoing.
- Do not assume a degree is completed just because its
  expected end date has passed.
- Preserve stated dates without inventing missing values.

FINAL CHECK:

Before returning the result, verify:

1. Every section contains only its correct record type.
2. No internship appears in work_experience.
3. No academic or personal project appears in work_experience.
4. Education status reflects the actual stated completion status.
5. Missing information has not been fabricated.
6. Every required schema property is present.
7. Empty sections are represented as empty arrays.

Return valid JSON only.
Do not include markdown, explanations or code fences.
`;

  return generateStructuredOutput({
    prompt,
    schema: resumeSchema,
    schemaName: 'Resume Parser',
    validate: validateResume
  });
}


module.exports = {
  parseResumeWithLLM
};
