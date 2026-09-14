import { FORMS, GRADES, VERSION, allQuestions } from './schema.js';

export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function createAssessment(type = 'consumer') {
  if (!FORMS[type]) throw new Error('Unknown form type.');
  return {
    schemaVersion: VERSION, id: crypto.randomUUID(), type, updatedAt: null,
    borrower: { name: '', branch: '', amount: '', term: '', termUnit: 'months', loanType: '', reference: '', date: localDate() },
    qualification: {}, qualificationRemarks: '', qualificationApprovedBy: '',
    answers: {}, reasons: {},
    review: { documents: '', startup: false, negativeWorkingCapital: false, negativeNetWorth: false, delinquent: false, daysPastDue: '', delinquencyGrade: '', delinquencyReason: '', override: '', overrideReason: '', overrideBy: '', preparedBy: '', preparedDate: localDate(), reviewedBy: '', reviewedDate: '', approvedBy: '', approvedDate: '', raterRemarks: '', reviewerRemarks: '' },
    policy: { weights: Object.fromEntries(FORMS[type].groups.map(g => [g.id, g.weight])), approvedBy: '', reference: '', confirmed: false, investmentB: '' },
  };
}
export function optionScore(state, question) {
  const option = question.options.find(o => o.key === state.answers[question.id]);
  if (!option) return null;
  if (question.id === 's-investments' && option.key === 'B') {
    return state.policy.confirmed && state.policy.approvedBy.trim() && state.policy.reference.trim() && ['0', '5'].includes(String(state.policy.investmentB)) ? Number(state.policy.investmentB) : null;
  }
  return option.score;
}
export function gradeForScore(type, score) {
  if (!Number.isFinite(score)) return null;
  const s = round2(score);
  return FORMS[type].bands.find(([from, to]) => s >= from && s <= to)?.[2] ?? null;
}
export function policyStatus(state) {
  const form = FORMS[state.type];
  const values = form.groups.map(g => state.policy.weights[g.id]);
  const validNumbers = values.every(v => Number.isFinite(v) && v > 0 && v <= 100);
  const sum = validNumbers ? round2(values.reduce((a, b) => a + b, 0)) : null;
  const changed = form.groups.some(g => state.policy.weights[g.id] !== g.weight);
  const evidenced = Boolean(state.policy.confirmed && state.policy.approvedBy.trim() && state.policy.reference.trim());
  const valid = validNumbers && sum === 100 && (!changed || evidenced);
  return { sum, changed, evidenced, valid };
}
export function calculate(state) {
  const form = FORMS[state.type];
  const policy = policyStatus(state);
  const groups = form.groups.map(g => {
    const scores = g.questions.map(q => optionScore(state, q));
    const answered = scores.filter(s => s !== null).length;
    const total = scores.reduce((s, v) => s + (v ?? 0), 0);
    const average = answered === scores.length ? total / scores.length : null;
    return { ...g, appliedWeight: state.policy.weights[g.id], answered, count: scores.length, total, average, weighted: average === null ? null : average * state.policy.weights[g.id] / 100 };
  });
  const total = groups.reduce((s, g) => s + g.count, 0);
  const answered = groups.reduce((s, g) => s + g.answered, 0);
  const complete = answered === total;
  const rawWeighted = complete && policy.sum !== null ? groups.reduce((s, g) => s + g.weighted, 0) : null;
  const score = complete && policy.valid ? round2(rawWeighted) : null;
  const normalizedPreview = rawWeighted !== null && policy.sum > 0 ? round2(rawWeighted * 100 / policy.sum) : null;
  const baseGrade = score === null ? null : gradeForScore(state.type, score);
  const blockers = [];
  const adjustmentNotes = [];
  if (!complete) blockers.push(`Complete all ${total} risk criteria (${answered} scored).`);
  if (!policy.valid) blockers.push(policy.sum !== 100 ? `Section weights total ${policy.sum ?? 'an invalid value'}%. Record approved weights totaling 100% in Scoring policy.` : 'Record the approver and policy reference for the changed section weights.');
  if (state.type === 'sme' && state.answers['s-investments'] === 'B' && optionScore(state, allQuestions('sme').find(q => q.id === 's-investments')) === null) blockers.push('Confirm the unclear score for SME item 23, option B, in Scoring policy.');
  if (score !== null && baseGrade === null) blockers.push('The SME source has no numeric rating band below 4.00. A final CRR cannot be inferred from this score.');
  const r = state.review;
  if (!['complete', 'minor', 'major'].includes(r.documents)) blockers.push('Select the completeness of required documents.');
  const documentConflict = state.type === 'consumer' && state.answers['c-compliance'] === 'C' && r.documents !== 'major';
  if (documentConflict) blockers.push('Consumer item 7 records non-deferable deficiencies. Reconcile it with the document completeness selection.');
  if (r.delinquent && (!['7', '8', '9', '10'].includes(String(r.delinquencyGrade)) || !r.delinquencyReason.trim() || !/^\d+$/.test(String(r.daysPastDue)) || Number(r.daysPastDue) < 1 || Number(r.daysPastDue) > 99999)) blockers.push('For a past-due account, record days past due, a bank-assigned CRR of 7–10, and the policy basis.');
  let floor = 1;
  if (r.startup || r.negativeWorkingCapital) { floor = 6; adjustmentNotes.push('Start-up / negative working capital: CRR cannot be better than 6.'); }
  if (r.documents === 'major') { floor = Math.max(floor, 7); adjustmentNotes.push('Non-deferable document deficiencies: CRR cannot be better than 7; manual override is disabled.'); }
  if (r.negativeNetWorth) { floor = Math.max(floor, 8); adjustmentNotes.push('Negative net worth: CRR cannot be better than 8.'); }
  if (r.delinquent && ['7', '8', '9', '10'].includes(String(r.delinquencyGrade))) { floor = Math.max(floor, Number(r.delinquencyGrade)); adjustmentNotes.push(`Bank-assigned past-due classification: CRR ${r.delinquencyGrade}.`); }
  let adjustedGrade = baseGrade;
  if (adjustedGrade !== null) {
    if (r.documents === 'minor') { adjustedGrade = Math.min(10, adjustedGrade + 1); adjustmentNotes.push('Minor document deficiencies with deviation memo: downgrade one level.'); }
    adjustedGrade = Math.max(adjustedGrade, floor);
  }
  let finalGrade = adjustedGrade;
  if (r.override !== '') {
    const override = Number(r.override);
    if (r.documents === 'major') blockers.push('Remove the manual override: the source prohibits it for major document deficiencies.');
    else if (!Number.isInteger(override) || override < floor || override > 10) blockers.push(`The override must be a CRR from ${floor} to 10; automatic risk restrictions still apply.`);
    else if (!r.overrideReason.trim() || !r.overrideBy.trim()) blockers.push('Record the override reason and authorizing officer.');
    else if (finalGrade !== null) { finalGrade = override; adjustmentNotes.push(`Documented override to CRR ${override} by ${r.overrideBy}.`); }
  }
  if (blockers.length) finalGrade = null;
  const missingFields = [];
  if (!state.borrower.name.trim()) missingFields.push('Borrower name');
  if (!state.borrower.branch.trim()) missingFields.push('Originating branch/unit');
  if (!state.borrower.amount.trim() || !Number.isFinite(Number(state.borrower.amount)) || Number(state.borrower.amount) <= 0 || Number(state.borrower.amount) > 1e12) missingFields.push('Valid amount applied');
  if (!/^\d+$/.test(state.borrower.term) || Number(state.borrower.term) < 1 || Number(state.borrower.term) > 9999) missingFields.push('Valid term');
  if (!validDate(state.borrower.date)) missingFields.push('Assessment date');
  if (!r.preparedBy.trim()) missingFields.push('Prepared by');
  if (!validDate(r.preparedDate)) missingFields.push('Prepared date');
  const qualificationCount = form.qualification.filter((_, i) => ['yes', 'no', ...(state.type === 'consumer' && [3, 4].includes(i) ? ['na'] : [])].includes(state.qualification[i])).length;
  const exceptions = Object.values(state.qualification).some(v => v === 'no' || v === 'na');
  const qualificationReady = qualificationCount === form.qualification.length && (!exceptions || (state.qualificationRemarks.trim() && state.qualificationApprovedBy.trim()));
  if (!qualificationReady) missingFields.push('Pre-qualification responses and any exception remarks/approver');
  const ready = finalGrade !== null && !missingFields.length;
  return { groups, total, answered, complete, policy, score, rawWeighted, normalizedPreview, baseGrade, adjustedGrade, finalGrade, grade: finalGrade === null ? null : GRADES[finalGrade], blockers, adjustmentNotes, missingFields, qualificationCount, qualificationReady: Boolean(qualificationReady), exceptions, ready };
}

export function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
}
// Reconstruct imported/saved assessments from an allowlist. Never trust saved totals or HTML.
export function validateAssessment(raw) {
  if (!raw || raw.schemaVersion !== VERSION || !['consumer', 'sme'].includes(raw.type)) throw new Error('This is not a supported CRR assessment file.');
  const clean = createAssessment(raw.type);
  const copyStrings = (target, source, max = 5000) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('The assessment has missing or invalid fields.');
    for (const key of Object.keys(target)) {
      if (typeof target[key] === 'boolean') {
        if (typeof source[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
        target[key] = source[key];
      } else {
        if (typeof source[key] !== 'string' || source[key].length > max) throw new Error(`Invalid or oversized ${key}.`);
        target[key] = source[key];
      }
    }
  };
  copyStrings(clean.borrower, raw.borrower, 300);
  copyStrings(clean.review, raw.review);
  if (!['days', 'months', 'years'].includes(clean.borrower.termUnit)) throw new Error('Invalid term unit.');
  if (!['', 'complete', 'minor', 'major'].includes(clean.review.documents)) throw new Error('Invalid document status.');
  for (const key of ['date']) if (clean.borrower[key] && !validDate(clean.borrower[key])) throw new Error('Invalid assessment date.');
  for (const key of ['preparedDate', 'reviewedDate', 'approvedDate']) if (clean.review[key] && !validDate(clean.review[key])) throw new Error(`Invalid ${key}.`);
  for (const key of ['qualificationRemarks', 'qualificationApprovedBy']) {
    if (typeof raw[key] !== 'string' || raw[key].length > 5000) throw new Error(`Invalid ${key}.`);
    clean[key] = raw[key];
  }
  for (const question of allQuestions(raw.type)) {
    const value = raw.answers?.[question.id];
    if (value !== undefined) {
      if (!['A', 'B', 'C'].includes(value)) throw new Error('Invalid criterion selection.');
      clean.answers[question.id] = value;
    }
    const reason = raw.reasons?.[question.id];
    if (reason !== undefined) {
      if (typeof reason !== 'string' || reason.length > 5000) throw new Error('Invalid criterion reason.');
      clean.reasons[question.id] = reason;
    }
  }
  FORMS[raw.type].qualification.forEach((_, i) => {
    const v = raw.qualification?.[i];
    if (v !== undefined) {
      const allowed = ['yes', 'no', ...(raw.type === 'consumer' && [3, 4].includes(i) ? ['na'] : [])];
      if (!allowed.includes(v)) throw new Error('Invalid pre-qualification response.');
      clean.qualification[i] = v;
    }
  });
  if (!raw.policy || typeof raw.policy !== 'object') throw new Error('Missing scoring policy.');
  const { weights: ignoredWeights, ...policyFields } = clean.policy;
  copyStrings(policyFields, raw.policy);
  clean.policy = { ...policyFields, weights: {} };
  for (const g of FORMS[raw.type].groups) {
    const value = raw.policy.weights?.[g.id];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) throw new Error('Invalid section weight.');
    clean.policy.weights[g.id] = value;
  }
  if (!['', '0', '5'].includes(clean.policy.investmentB)) throw new Error('Invalid SME item 23 score.');
  if (typeof raw.id === 'string' && /^[\da-f-]{36}$/i.test(raw.id)) clean.id = raw.id;
  if (typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt))) clean.updatedAt = raw.updatedAt;
  return clean;
}

export const STORAGE_KEY = 'rbliloy.crr.drafts.v1';
export function readDrafts(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('Draft storage could not be read. Export your current form before clearing browser data.');
  return parsed.map(validateAssessment);
}
export function saveDraft(state, storage = localStorage) {
  const drafts = readDrafts(storage);
  const saved = validateAssessment({ ...state, updatedAt: new Date().toISOString() });
  const next = [saved, ...drafts.filter(d => d.id !== saved.id)];
  if (next.length > 100) throw new Error('This browser has 100 drafts. Export and remove an older draft first.');
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return saved;
}
export function deleteDraft(id, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(readDrafts(storage).filter(d => d.id !== id)));
}
