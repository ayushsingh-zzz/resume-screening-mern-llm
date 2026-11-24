
const CATEGORY_MAX = {
  skills: 40,
  experience: 30,
  education: 15,
  projects: 15
};

const IMPORTANCE_WEIGHT = {
  mandatory: 3,
  important: 2,
  preferred: 1
};

const STATUS_VALUE = {
  MET: 1,
  PARTIAL: 0.5,
  MISSING: 0
};

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildSummary(requirements) {
  const counts = {
    met: 0,
    partial: 0,
    missing: 0
  };

  for (const item of requirements) {
    counts[item.validated_status]++;
  }

  const parts = [];

  if (counts.met) {
    parts.push(`${counts.met} requirement${counts.met === 1 ? '' : 's'} met`);
  }

  if (counts.partial) {
    parts.push(`${counts.partial} partially met`);
  }

  if (counts.missing) {
    parts.push(`${counts.missing} not demonstrated in the submitted resume`);
  }

  if (!parts.length) {
    return 'No requirements could be assessed from the submitted resume.';
  }

  return `Based on the information stated in the submitted resume, ${parts.join(', ')}. These results describe evidence presented in the resume; they do not independently authenticate candidate claims.`;
}

function calculateScores({ jobData, evaluationData }) {
  if (!Array.isArray(jobData?.requirements)) {
    throw new Error('Invalid job requirements.');
  }

  if (!Array.isArray(evaluationData?.evaluations)) {
    throw new Error('Invalid evaluation results.');
  }

  const requirements = jobData.requirements;
  const evaluations = evaluationData.evaluations;

  const evaluationMap = new Map();

  for (const evaluation of evaluations) {
    if (
      !evaluation.requirement_id ||
      evaluationMap.has(evaluation.requirement_id)
    ) {
      throw new Error(
        `Invalid or duplicate evaluation: ${evaluation.requirement_id}`
      );
    }

    evaluationMap.set(evaluation.requirement_id, evaluation);
  }

  const seenRequirements = new Set();

  const assessedRequirements = requirements.map(requirement => {
    const {
      requirement_id,
      requirement: requirementName,
      category,
      importance
    } = requirement;

    if (!requirement_id || seenRequirements.has(requirement_id)) {
      throw new Error(
        `Invalid or duplicate requirement: ${requirement_id}`
      );
    }

    seenRequirements.add(requirement_id);

    if (!Object.hasOwn(CATEGORY_MAX, category)) {
      throw new Error(
        `Invalid category for ${requirement_id}: ${category}`
      );
    }

    if (!Object.hasOwn(IMPORTANCE_WEIGHT, importance)) {
      throw new Error(
        `Invalid importance for ${requirement_id}: ${importance}`
      );
    }

    const evaluation = evaluationMap.get(requirement_id);

    if (!evaluation) {
      throw new Error(
        `Missing evaluation for ${requirement_id}`
      );
    }

    if (!Object.hasOwn(STATUS_VALUE, evaluation.status)) {
      throw new Error(
        `Invalid status for ${requirement_id}: ${evaluation.status}`
      );
    }

    return {
      ...requirement,
      ...evaluation,
      name: requirementName,
      proposed_status: evaluation.status,
      validated_status: evaluation.status.toLowerCase(),
      status: evaluation.status.toLowerCase()
    };
  });

  if (evaluationMap.size !== requirements.length) {
    throw new Error('Evaluation results contain unknown requirements.');
  }

  // Fixed v11 category maximums.
  const breakdown = {};
  const categoryRequirementCounts = {};
  const categoryApplicable = {};
  const categoryMaximums = {};

  for (const [category, maximum] of Object.entries(CATEGORY_MAX)) {
    const categoryItems = assessedRequirements.filter(
      item => item.category === category
    );

    categoryRequirementCounts[category] = categoryItems.length;
    categoryApplicable[category] = categoryItems.length > 0;
    categoryMaximums[category] = maximum;

    // An empty category contributes zero.
    // Its maximum is never removed from the 100-point scale.
    if (categoryItems.length === 0) {
      breakdown[category] = 0;
      continue;
    }

    let earned = 0;
    let possible = 0;

    for (const item of categoryItems) {
      const weight = IMPORTANCE_WEIGHT[item.importance];

      earned += weight * STATUS_VALUE[item.proposed_status];
      possible += weight;
    }

    breakdown[category] = roundToTwo(
      Math.min(maximum, (earned / possible) * maximum)
    );
  }

  // All four category maximums total exactly 100.
  const applicableMaximum = Object.values(CATEGORY_MAX)
    .reduce((total, maximum) => total + maximum, 0);

  const score = roundToTwo(
    Object.values(breakdown)
      .reduce((total, value) => total + value, 0)
  );

  // Build skill lists from validated statuses.
  const skillRequirements = assessedRequirements.filter(
    item => item.category === 'skills'
  );

  const matchedSkills = [
    ...new Set(
      skillRequirements
        .filter(item => item.validated_status === 'met')
        .map(item => item.name)
    )
  ];

  const partiallyMatchedSkills = [
    ...new Set(
      skillRequirements
        .filter(item => item.validated_status === 'partial')
        .map(item => item.name)
    )
  ];

  const missingSkills = [
    ...new Set(
      skillRequirements
        .filter(item => item.validated_status === 'missing')
        .map(item => item.name)
    )
  ];

  return {
    score,
    breakdown,
    summary: buildSummary(assessedRequirements),
    category_requirement_counts: categoryRequirementCounts,
    category_applicable: categoryApplicable,
    category_maximums: categoryMaximums,
    applicable_maximum: applicableMaximum,
    matched_skills: matchedSkills,
    partially_matched_skills: partiallyMatchedSkills,
    missing_skills: missingSkills,
    requirements: assessedRequirements
  };
}

module.exports = {
  calculateScores
};
