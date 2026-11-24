
function classifyExperienceRequirement(requirement) {
  const text = String(
    requirement?.requirement || ''
  ).toLowerCase();

  // Internship requirements are always classified separately.
  if (/\binternships?\b/.test(text)) {
    return 'internship';
  }

  // Freelance and contract work are not professional employment.
  if (
    /\bfreelance\b/.test(text) ||
    /\bcontract work\b/.test(text) ||
    /\bcontractor\b/.test(text)
  ) {
    return 'non_professional';
  }

  // Explicit professional employment requirements.
  if (
    requirement?.has_explicit_minimum_years === true ||
    /\bprofessional experience\b/.test(text) ||
    /\bprofessional\b.*\bemployment\b/.test(text) ||
    /\bemployment\b.*\bprofessional\b/.test(text) ||
    /\bemployment experience\b/.test(text) ||
    /\bindustry experience\b/.test(text) ||
    /\bemployment history\b/.test(text) ||
    /\bwork history\b/.test(text) ||
    /\b(?:full-time|part-time) employment\b/.test(text) ||
    /\bwork experience\b/.test(text) ||
    /\b\d+\s*[-–]\s*\d+\s*years?\b/.test(text)
  ) {
    return 'professional_employment';
  }

  return 'general_experience';
}

module.exports = {
  classifyExperienceRequirement
};
