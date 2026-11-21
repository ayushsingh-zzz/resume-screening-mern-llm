
const {
  validateEvidence
} = require('./evidenceValidator');

const {
  calculateExperience,
  parseMonthYear
} = require('./experienceCalculator');

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

  // 3. Calculate total verified professional experience.
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

      if (
        requirement.category !== 'experience' ||
        !requirement.has_explicit_minimum_years
      ) {
        return result;
      }

      const indices =
        result.relevant_work_experience_indices;

      if (!Array.isArray(indices)) {
        throw new Error(
          `Invalid work experience references: ${result.requirement_id}`
        );
      }

      // Validate every referenced record.
      for (const index of indices) {
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= resumeData.work_experience.length
        ) {
          throw new Error(
            `Invalid work experience index: ${result.requirement_id}`
          );
        }
      }

      const relevantRecords = indices.map(
        index => resumeData.work_experience[index]
      );

      const relevantExperience = calculateExperience(
        relevantRecords,
        asOfMonth
      );

      const requiredMonths =
        requirement.minimum_years * 12;

      const verifiedMonths =
        relevantExperience.total_months;

      const hasUnverifiedRecords =
        relevantExperience.unverified_records.length > 0;

      const sufficient = verifiedMonths >= requiredMonths;

      let verificationStatus;

      if (sufficient) {
        verificationStatus = 'verified';
      } else if (hasUnverifiedRecords) {
        verificationStatus = 'unverified';
      } else {
        verificationStatus = 'insufficient';
      }

      // Never allow an unsupported MET decision.
      if (!sufficient) {
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

      result.explanation +=
        ` Deterministic date check: ${verifiedMonths} verified months against ${requiredMonths} required months.`;

      if (verificationStatus === 'unverified') {
        result.explanation +=
          ' Additional relevant employment records have unverified dates; manual review is required.';
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
