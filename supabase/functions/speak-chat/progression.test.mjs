import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateProgressPercent,
  creditedPracticeSeconds,
  hasSufficientEvidence,
  nextLevel,
  qualifiesForPromotion,
  validRule,
} from './progression.mjs';

const levels = [
  ['A1', 'A2', 80, 100, 120],
  ['A2', 'B1', 150, 185, 220],
  ['B1', 'B2', 200, 250, 300],
  ['B2', 'C1', 250, 325, 400],
  ['C1', 'C2', 300, 400, 500],
];
const skills = ['conversation', 'comprehension', 'response', 'pronunciation', 'grammar'];
const rule = (from = 'A1', to = 'A2') => ({
  from_level: from,
  to_level: to,
  min_hours: 80,
  target_hours: 100,
  max_hours: 120,
  criteria: {
    requiredConsecutiveReadyAssessments: 2,
    requiredEvidenceSkills: skills,
    descriptor: 'Consistent evidence against the target-level descriptor.',
  },
});
const assessment = (id, overrides = {}) => ({
  id,
  from_level: 'A1',
  to_level: 'A2',
  recommendation: 'promote',
  estimated_level: 'A2',
  assessed_skills: skills,
  scores: Object.fromEntries(skills.map((skill) => [skill, 70])),
  skill_evidence: Object.fromEntries(skills.map((skill) => [skill, `Observed ${skill} evidence.`])),
  criteria_applied: rule().criteria,
  ...overrides,
});

test('uses objective hours for every configured transition', () => {
  for (const [from, to, min, target, max] of levels) {
    assert.equal(nextLevel(from), to);
    assert.equal(validRule({
      ...rule(from, to),
      min_hours: min,
      target_hours: target,
      max_hours: max,
    }, from), true);
  }
  assert.equal(nextLevel('C2'), null);
});

test('calculates rounded practice percentage and caps at 100', () => {
  assert.equal(calculateProgressPercent(0, 100), 0);
  assert.equal(calculateProgressPercent(25 * 3600, 100), 25);
  assert.equal(calculateProgressPercent(50 * 3600, 100), 50);
  assert.equal(calculateProgressPercent(75 * 3600, 100), 75);
  assert.equal(calculateProgressPercent(99.5 * 3600, 100), 99.5);
  assert.ok(calculateProgressPercent(100 * 3600 - 1, 100) < 100);
  assert.equal(calculateProgressPercent(100 * 3600, 100), 100);
  assert.equal(calculateProgressPercent(150 * 3600, 100), 100);
  assert.equal(calculateProgressPercent(185 * 3600, 185), 100);
  assert.throws(() => calculateProgressPercent(-1, 100), RangeError);
});

test('credits only bounded server windows with verified speech', () => {
  assert.equal(creditedPracticeSeconds(0, true), null);
  assert.equal(creditedPracticeSeconds(10, false), null);
  assert.equal(creditedPracticeSeconds(91, true), null);
  assert.equal(creditedPracticeSeconds(4.9, true), 4);
  assert.equal(creditedPracticeSeconds(45, true), 30);
});

test('requires distinct comparable, consecutive, evidence-complete assessments', () => {
  const current = assessment('current');
  assert.equal(hasSufficientEvidence(current, rule()), true);
  assert.equal(qualifiesForPromotion(current, [], rule()), false);
  assert.equal(qualifiesForPromotion(current, [assessment('previous')], rule()), true);
  assert.equal(qualifiesForPromotion(current, [assessment('current')], rule()), false);
  assert.equal(qualifiesForPromotion(
    current,
    [assessment('previous', { recommendation: 'continue' })],
    rule()
  ), false);
  assert.equal(qualifiesForPromotion(
    current,
    [assessment('previous', { to_level: 'B1' })],
    rule()
  ), false);
  assert.equal(qualifiesForPromotion(
    current,
    [assessment('previous', { criteria_applied: { ...rule().criteria, descriptor: 'Updated.' } })],
    rule()
  ), false);
  assert.equal(qualifiesForPromotion(
    current,
    [assessment('previous', {
      assessed_skills: ['conversation', 'grammar'],
    })],
    rule()
  ), false);
});

test('does not promote on incomplete or off-target model evidence', () => {
  assert.equal(hasSufficientEvidence(
    assessment('current', { estimated_level: 'B1' }),
    rule()
  ), false);
  assert.equal(hasSufficientEvidence(
    assessment('current', {
      skill_evidence: { ...assessment('current').skill_evidence, grammar: '' },
    }),
    rule()
  ), false);
  assert.equal(hasSufficientEvidence(
    assessment('current', {
      scores: { ...assessment('current').scores, pronunciation: 101 },
    }),
    rule()
  ), false);
});

test('hours reaching 100 percent do not replace evidence; readiness can qualify early', () => {
  const atGoal = calculateProgressPercent(100 * 3600, 100);
  const insufficient = assessment('insufficient', { recommendation: 'continue' });
  assert.equal(atGoal, 100);
  assert.equal(hasSufficientEvidence(insufficient, rule()), false);
  assert.equal(
    qualifiesForPromotion(assessment('early'), [assessment('prior')], rule()),
    true
  );
});
