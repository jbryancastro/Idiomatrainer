export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const SKILLS = ['conversation', 'comprehension', 'response', 'pronunciation', 'grammar'];
export const MAX_RECORDING_SECONDS = 30;

export const nextLevel = (level) => {
  const index = LEVELS.indexOf(level);
  return index >= 0 ? LEVELS[index + 1] ?? null : null;
};

export const calculateProgressPercent = (validSeconds, targetHours) => {
  if (!Number.isFinite(validSeconds) || validSeconds < 0 || !Number.isFinite(targetHours) || targetHours <= 0) {
    throw new RangeError('Invalid progression values');
  }
  return Math.min(100, (validSeconds / (targetHours * 3600)) * 100);
};

export const isValidPracticeWindow = (elapsedSeconds) =>
  Number.isFinite(elapsedSeconds) && elapsedSeconds >= 1 && elapsedSeconds <= 90;

export const creditedPracticeSeconds = (elapsedSeconds, hasVerifiedSpeech) => {
  if (!hasVerifiedSpeech || !isValidPracticeWindow(elapsedSeconds)) return null;
  return Math.min(MAX_RECORDING_SECONDS, Math.floor(elapsedSeconds));
};

export const validRule = (rule, fromLevel) =>
  rule?.from_level === fromLevel &&
  nextLevel(fromLevel) === rule.to_level &&
  Number.isInteger(rule.min_hours) &&
  Number.isInteger(rule.target_hours) &&
  Number.isInteger(rule.max_hours) &&
  rule.min_hours > 0 &&
  rule.min_hours <= rule.target_hours &&
  rule.target_hours <= rule.max_hours &&
  Number.isInteger(rule.criteria?.requiredConsecutiveReadyAssessments) &&
  rule.criteria.requiredConsecutiveReadyAssessments >= 2 &&
  Array.isArray(rule.criteria.requiredEvidenceSkills) &&
  rule.criteria.requiredEvidenceSkills.length > 0 &&
  rule.criteria.requiredEvidenceSkills.every((skill) => SKILLS.includes(skill)) &&
  typeof rule.criteria.descriptor === 'string' &&
  rule.criteria.descriptor.trim().length > 0;

export const hasSufficientEvidence = (assessment, rule) => {
  const estimatedLevel = assessment?.estimatedLevel ?? assessment?.estimated_level;
  const assessedSkills = assessment?.assessedSkills ?? assessment?.assessed_skills;
  const skillEvidence = assessment?.skillEvidence ?? assessment?.skill_evidence;
  if (
    assessment?.recommendation !== 'promote' ||
    estimatedLevel !== rule.to_level ||
    !Array.isArray(assessedSkills) ||
    !skillEvidence ||
    !assessment.scores
  ) {
    return false;
  }
  return rule.criteria.requiredEvidenceSkills.every((skill) => {
    const evidence = skillEvidence[skill];
    const score = assessment.scores[skill];
    return (
      assessedSkills.includes(skill) &&
      typeof evidence === 'string' &&
      evidence.trim().length > 0 &&
      Number.isInteger(score) &&
      score >= 0 &&
      score <= 100
    );
  });
};

const equalJson = (left, right) => {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equalJson(value, right[index]));
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && equalJson(left[key], right[key])
    );
};

export const qualifiesForPromotion = (assessment, previousAssessments, rule) => {
  if (!hasSufficientEvidence(assessment, rule)) return false;
  const required = rule.criteria.requiredConsecutiveReadyAssessments;
  const prior = previousAssessments.slice(0, required - 1);
  if (prior.length < required - 1) return false;
  return prior.every((item) =>
    item.id !== assessment.id &&
    item.from_level === rule.from_level &&
    item.to_level === rule.to_level &&
    equalJson(item.criteria_applied, rule.criteria) &&
    hasSufficientEvidence({
      recommendation: item.recommendation,
      estimatedLevel: item.estimated_level,
      assessedSkills: item.assessed_skills,
      skillEvidence: item.skill_evidence,
      scores: item.scores,
    }, rule)
  );
};
