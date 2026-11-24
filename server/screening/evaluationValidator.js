
const {
  validateEvidence,
  normalizeText
} = require('./evidenceValidator');

const {
  calculateExperience,
  parseMonthYear
} = require('./experienceCalculator');

const {
  classifyExperienceRequirement
} = require('./experienceRequirementClassifier');


function validateWorkExperienceIndices(evaluation, resumeData) {
  const indices = evaluation.relevant_work_experience_indices;

  if (!Array.isArray(indices)) {
    throw new Error(
      `Invalid work experience references: ${evaluation.requirement_id}`
    );
  }

  for (const index of indices) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= resumeData.work_experience.length
    ) {
      throw new Error(
        `Invalid work experience index: ${evaluation.requirement_id}`
      );
    }
  }

  return indices;
}


function validateInternshipIndices(evaluation, resumeData) {
  const indices = evaluation.relevant_internship_indices;

  if (!Array.isArray(indices)) {
    throw new Error(
      `Invalid internship references: ${evaluation.requirement_id}`
    );
  }

  for (const index of indices) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= resumeData.internships.length
    ) {
      throw new Error(
        `Invalid internship index: ${evaluation.requirement_id}`
      );
    }
  }

  return indices;
}


function collectStringValues(value, output = []) {
  if (typeof value === 'string') {
    if (value.trim()) output.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, output);
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStringValues(item, output);
    }
  }

  return output;
}


// Return only employment indices individually supported by evidence.
function getEvidenceSupportedIndices(evaluation, records, indices) {
  if (
    !Array.isArray(evaluation.evidence) ||
    !Array.isArray(records) ||
    !Array.isArray(indices)
  ) {
    return [];
  }

  const workEvidence = evaluation.evidence.filter(
    item =>
      item?.source_section === 'work_experience' &&
      typeof item.evidence_quote === 'string' &&
      item.evidence_quote.trim()
  );

  return indices.filter((index, position) => {
    const record = records[position];

    const recordValues = collectStringValues(record);

    return workEvidence.some(item => {
      const quote = normalizeText(item.evidence_quote);

      return recordValues.some(value =>
        normalizeText(value).includes(quote)
      );
    });
  });
}


function appendExplanation(result, message) {
  result.explanation = [
    result.explanation,
    message
  ].filter(Boolean).join(' ');
}


function validateAndEnforceEvaluation({
  evaluationData,
  jobData,
  resumeData,
  resumeText,
  asOfDate
}) {
  if (!Array.isArray(jobData?.requirements)) {
    throw new Error('Invalid job requirements.');
  }

  if (!Array.isArray(evaluationData?.evaluations)) {
    throw new Error('Invalid evaluation results.');
  }

  if (!Array.isArray(resumeData?.work_experience)) {
    throw new Error('Invalid work experience data.');
  }

  // 1. Validate evidence against the original resume.
  validateEvidence(
    evaluationData,
    resumeText,
    resumeData
  );

  // 2. Establish a fixed reference date.
  const asOfMonth = parseMonthYear(asOfDate);

  if (asOfMonth === null) {
    throw new Error('Invalid experience calculation date.');
  }

  // 3. Calculate total professional employment duration.
  const totalExperience = calculateExperience(
    resumeData.work_experience,
    asOfMonth
  );

  const enforcedEvaluations = evaluationData.evaluations.map(
    evaluation => {
      const requirement = jobData.requirements.find(
        item =>
          item.requirement_id === evaluation.requirement_id
      );

      if (!requirement) {
        throw new Error(
          `Unknown requirement: ${evaluation.requirement_id}`
        );
      }

      const result = { ...evaluation };

      const classification =
        classifyExperienceRequirement(requirement);

      const hasMinimumYears =
        requirement.category === 'experience' &&
        requirement.has_explicit_minimum_years === true;

      // Internship requirements use internship records only.
      if (classification === 'internship') {
        const internshipIndices = validateInternshipIndices(
          result,
          resumeData
        );

        if (internshipIndices.length === 0) {
          result.status = 'MISSING';

          appendExplanation(
            result,
            'Deterministic validation: no relevant internship records were identified. Professional employment, skills and academic projects cannot substitute for internship experience.'
          );
        }

        return result;
      }

      // Skip unrelated non-professional requirements.
      if (
        classification !== 'professional_employment' &&
        !hasMinimumYears
      ) {
        return result;
      }

      // 4. Validate selected employment references.
      const indices = validateWorkExperienceIndices(
        result,
        resumeData
      );

      const selectedRecords = indices.map(
        index => resumeData.work_experience[index]
      );

      // 5. Validate evidence separately for every record.
      const validatedIndices = getEvidenceSupportedIndices(
        result,
        selectedRecords,
        indices
      );

      const validatedRecords = validatedIndices.map(
        index => resumeData.work_experience[index]
      );

      // Preserve only individually evidence-supported references.
      result.relevant_work_experience_indices =
        validatedIndices;

      if (validatedIndices.length === 0) {
        result.status = 'MISSING';

        appendExplanation(
          result,
          'Deterministic validation: no individually supported professional employment records were identified. Each referenced employment record must have its own matching evidence.'
        );

        return result;
      }

      // 6. Professional employment without a duration requirement.
      if (!hasMinimumYears) {
        return result;
      }

      // 7. Calculate duration using only validated records.
      const relevantExperience = calculateExperience(
        validatedRecords,
        asOfMonth
      );

      const requiredMonths =
        requirement.minimum_years * 12;

      const verifiedMonths =
        relevantExperience.total_months;

      const hasUnverifiedRecords =
        relevantExperience.unverified_records.length > 0;

      const sufficient =
        verifiedMonths >= requiredMonths;

      let verificationStatus;

      if (sufficient) {
        verificationStatus = 'verified';
      } else if (hasUnverifiedRecords) {
        verificationStatus = 'unverified';
      } else {
        verificationStatus = 'insufficient';
      }

      // 8. Enforce the final status deterministically.
      if (sufficient) {
        result.status = 'MET';
      } else if (
        verifiedMonths === 0 &&
        !hasUnverifiedRecords
      ) {
        result.status = 'MISSING';
      } else {
        result.status = 'PARTIAL';
      }

      result.verified_experience = {
        total_months: verifiedMonths,
        total_years: relevantExperience.total_years,
        required_months: requiredMonths,
        sufficient,
        verification_status: verificationStatus,
        needs_manual_review:
          verificationStatus === 'unverified',
        unverified_records:
          relevantExperience.unverified_records
      };

      appendExplanation(
        result,
        `Deterministic date check: ${verifiedMonths} verified months against ${requiredMonths} required months.`
      );

      if (result.status === 'MISSING') {
        appendExplanation(
          result,
          'No qualifying professional employment duration was identified.'
        );
      } else if (result.status === 'PARTIAL') {
        appendExplanation(
          result,
          'Relevant professional employment exists, but the available verified duration does not establish the required minimum.'
        );
      }

      if (verificationStatus === 'unverified') {
        appendExplanation(
          result,
          'Some relevant employment records have unverified dates; manual review is required.'
        );
      }

      return result;
    }
  );

  return {
    evaluations: enforcedEvaluations,
    professional_experience: totalExperience
  };
}


module.exports = {
  validateAndEnforceEvaluation
};
