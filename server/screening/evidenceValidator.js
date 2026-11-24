const SECTION_FIELDS = {
  skills: ['skills'],
  work_experience: ['work_experience'],
  internships: ['internships'],
  projects: ['projects'],
  education: ['education']
};

// Normalize Unicode, whitespace and case for reliable text comparison.
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

// A quote must exist continuously inside one actual field value.
function quoteExistsInSection(resumeData, section, quote) {
  const fields = SECTION_FIELDS[section];

  if (!fields) {
    return false;
  }

  const values = [];

  for (const field of fields) {
    collectStrings(resumeData[field], values);
  }

  return values.some(value =>
    normalizeText(value).includes(quote)
  );
}

function appendExplanation(evaluation, message) {
  evaluation.explanation = [
    evaluation.explanation,
    message
  ].filter(Boolean).join(' ');
}

// Temporary diagnostic logging.
function logRejectedEvidence(evaluation, item, reason) {
  console.warn('[Evidence Validator] Rejected evidence:', {
    requirementId:
      evaluation.requirement_id ??
      evaluation.requirementId ??
      evaluation.id ??
      'unknown',
    quote: item?.evidence_quote ?? null,
    sourceSection: item?.source_section ?? null,
    reason
  });
}

function validateEvidence(
  evaluationData,
  resumeText,
  resumeData
) {
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

  let rejectedEvidenceCount = 0;

  for (const evaluation of evaluationData.evaluations) {
    let evaluationRejectedCount = 0;

    if (!Array.isArray(evaluation.evidence)) {
      logRejectedEvidence(
        evaluation,
        null,
        'Evidence is not an array'
      );

      evaluation.evidence = [];
      rejectedEvidenceCount++;
      evaluationRejectedCount++;

      appendExplanation(
        evaluation,
        'Evidence validation: invalid evidence data was discarded.'
      );
    }

    const validEvidence = [];

    for (const item of evaluation.evidence) {
      if (
        !item ||
        typeof item.evidence_quote !== 'string' ||
        !item.evidence_quote.trim()
      ) {
        logRejectedEvidence(
          evaluation,
          item,
          'Invalid or empty evidence quote'
        );

        rejectedEvidenceCount++;
        evaluationRejectedCount++;
        continue;
      }

      const quote = normalizeText(item.evidence_quote);

      if (!quote) {
        logRejectedEvidence(
          evaluation,
          item,
          'Evidence quote became empty after normalization'
        );

        rejectedEvidenceCount++;
        evaluationRejectedCount++;
        continue;
      }

      // Verify the quote exists in the original resume.
      if (!originalText.includes(quote)) {
        logRejectedEvidence(
          evaluation,
          item,
          'Quote not found in original resume text'
        );

        rejectedEvidenceCount++;
        evaluationRejectedCount++;
        continue;
      }

      // Verify the declared section is valid.
      if (!SECTION_FIELDS[item.source_section]) {
        logRejectedEvidence(
          evaluation,
          item,
          'Invalid source section'
        );

        rejectedEvidenceCount++;
        evaluationRejectedCount++;
        continue;
      }

      // Verify the quote exists in the claimed section
      // and within one continuous field value.
      if (
        !quoteExistsInSection(
          resumeData,
          item.source_section,
          quote
        )
      ) {
        logRejectedEvidence(
          evaluation,
          item,
          'Quote not found continuously in declared structured resume section'
        );

        rejectedEvidenceCount++;
        evaluationRejectedCount++;
        continue;
      }

      // Keep the original quote unchanged.
      validEvidence.push(item);
    }

    evaluation.evidence = validEvidence;

    // A MET or PARTIAL result cannot survive without
    // at least one valid supporting evidence quote.
    const currentStatus = String(
      evaluation.status || ''
    ).toUpperCase();

    if (
      validEvidence.length === 0 &&
      (
        currentStatus === 'MET' ||
        currentStatus === 'PARTIAL'
      )
    ) {
      evaluation.status = 'MISSING';

      appendExplanation(
        evaluation,
        'Evidence validation: no valid supporting resume evidence remained after verification. The requirement was marked MISSING.'
      );
    } else if (
      evaluationRejectedCount > 0 &&
      validEvidence.length > 0
    ) {
      appendExplanation(
        evaluation,
        'Evidence validation: unsupported evidence entries were discarded; the remaining quotes were verified against the resume.'
      );
    }
  }

  if (rejectedEvidenceCount > 0) {
    console.warn(
      `[Evidence Validator] Discarded ${rejectedEvidenceCount} invalid evidence entr${rejectedEvidenceCount === 1 ? 'y' : 'ies'}.`
    );
  }

  return true;
}

module.exports = {
  validateEvidence,
  normalizeText,
  buildSectionText
};