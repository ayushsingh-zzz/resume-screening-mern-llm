
const SECTION_FIELDS = {
  skills: ['skills'],
  work_experience: ['work_experience'],
  internships: ['internships'],
  projects: ['projects'],
  education: ['education']
};

// Normalize whitespace and Unicode for reliable text comparison.
function normalizeText(value) {
  return String(value)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Collect all string values from a structured resume section.
function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    if (value.trim()) {
      output.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }

  return output;
}

function buildSectionText(resumeData, section) {
  const fields = SECTION_FIELDS[section];

  if (!fields) {
    throw new Error(`Unsupported evidence section: ${section}`);
  }

  const values = [];

  for (const field of fields) {
    collectStrings(resumeData[field], values);
  }

  return normalizeText(values.join(' '));
}

function validateEvidence(evaluationData, resumeText, resumeData) {
  if (
    !evaluationData ||
    !Array.isArray(evaluationData.evaluations)
  ) {
    throw new Error('Invalid evaluation data.');
  }

  if (
    typeof resumeText !== 'string' ||
    !resumeText.trim()
  ) {
    throw new Error('Original resume text is missing.');
  }

  if (!resumeData || typeof resumeData !== 'object') {
    throw new Error('Structured resume data is missing.');
  }

  const originalText = normalizeText(resumeText);
  const errors = [];

  for (const evaluation of evaluationData.evaluations) {
    if (!Array.isArray(evaluation.evidence)) {
      errors.push(
        `${evaluation.requirement_id}: evidence must be an array.`
      );
      continue;
    }

    for (let i = 0; i < evaluation.evidence.length; i++) {
      const item = evaluation.evidence[i];

      if (
        !item ||
        typeof item.evidence_quote !== 'string' ||
        !item.evidence_quote.trim()
      ) {
        errors.push(
          `${evaluation.requirement_id}: evidence ${i + 1} has an invalid quote.`
        );
        continue;
      }

      const quote = normalizeText(item.evidence_quote);

      // Check whether the quote exists in the original resume.
      if (!originalText.includes(quote)) {
        errors.push(
          `${evaluation.requirement_id}: quote not found in original resume: "${item.evidence_quote}"`
        );
        continue;
      }

      // Check whether the quote belongs to the claimed section.
      const sectionText = buildSectionText(
        resumeData,
        item.source_section
      );

      if (!sectionText.includes(quote)) {
        errors.push(
          `${evaluation.requirement_id}: quote does not match section "${item.source_section}": "${item.evidence_quote}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Evidence validation failed:\n- ' + errors.join('\n- ')
    );
  }

  return true;
}

module.exports = {
  validateEvidence,
  normalizeText,
  buildSectionText
};
