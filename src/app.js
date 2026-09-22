import { BANK, ADDRESS, FORMS, GRADES, DELINQUENCY_LABEL, allQuestions } from './schema.js';
import { createAssessment, calculate, optionScore, policyStatus, saveDraft, readDrafts, deleteDraft, validateAssessment } from './engine.js';
import { escapeHtml as e, money, dateLabel, buildReport, buildCsv } from './report.js';
import { registerCrrTools } from './webmcp.js';

const paths = {
  bank: '<path d="m3 9 9-6 9 6H3Zm2 11h14M3 22h18M6 12v5m6-5v5m6-5v5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8m-8 4h5"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M6 9V3h12v6M6 18H3v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7h-3M6 14h12v8H6Z"/><path d="M17 12h1"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  business: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const modal = $('#modal');
let state = createAssessment();
let step = 0;
let groupIndex = 0;
let dirty = false;
const work = { consumer: state, sme: null };
const dirtyTypes = new Set();
const opened = new Set(['c-bank']);
let toastTimer;
const steps = ['Borrower details', 'Pre-qualification', 'Risk assessment', 'Review & export'];
const field = (label, path, { type = 'text', placeholder = '', required = false, options, wide = false, min, max, step: increment, hint = '', rows = 3 } = {}) => {
  const value = path.split('.').reduce((obj, key) => obj?.[key], state) ?? '';
  const id = path.replaceAll('.', '-');
  let control;
  const attrs = `id="${id}" data-path="${path}" ${required ? 'required' : ''}`;
  if (options) control = `<select ${attrs}>${options.map(o => {const [v, text] = Array.isArray(o) ? o : [o, o]; return `<option value="${e(v)}" ${value === v ? 'selected' : ''}>${e(text)}</option>`;}).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea ${attrs} rows="${rows}" maxlength="5000" placeholder="${e(placeholder)}">${e(value)}</textarea>`;
  else control = `<input ${attrs} type="${type}" value="${e(value)}" placeholder="${e(placeholder)}" ${type === 'text' ? 'maxlength="300"' : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${increment ? `step="${increment}"` : ''} autocomplete="off">`;
  return `<div class="field ${wide ? 'span-2' : ''}"><label for="${id}">${label}${required ? ' <span class="required">*</span>' : ''}</label>${control}${hint ? `<small>${hint}</small>` : ''}</div>`;
};
const checkbox = (path, label, description = '') => `<label class="check-row"><input type="checkbox" data-path="${path}" ${path.split('.').reduce((o,k)=>o[k],state) ? 'checked' : ''}><span><b>${label}</b>${description ? `<small>${description}</small>` : ''}</span></label>`;

function shell() {
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="./" aria-label="Rural Bank of Liloy CRR workspace"><span class="brand-mark"><img src="./assets/rbliloy-logo.png" alt="" width="38" height="43"></span><span>RURAL BANK<span class="brand-second">OF LILOY <i>(ZN), INC.</i></span></span></a><div class="sidebar-divider"></div><p class="nav-label">LENDING WORKSPACE</p><nav aria-label="Workspace"><button class="nav-item active" data-action="assessment">${icon('grid')}<span>CRR assessment</span><span class="nav-dot"></span></button><button class="nav-item" data-action="drafts">${icon('folder')}<span>Saved drafts</span><span class="draft-count" id="draft-count">0</span></button><button class="nav-item" data-action="import">${icon('upload')}<span>Import assessment</span></button></nav><div class="sidebar-guide"><div class="guide-icon">${icon('file')}</div><h3>The form, at a glance.</h3><p>Check score ranges, document adjustments and notes from the source forms.</p><button data-action="guide">View rating guide ${icon('arrow')}</button></div><div class="sidebar-bottom">${icon('lock')}<div><b>Your data stays with you</b><span>Drafts are saved on this browser.</span></div></div></aside>
  <div class="app-main"><header class="topbar"><div class="breadcrumb">Credit operations <span>/</span> <b>Risk assessment</b></div><div class="topbar-actions"><button class="text-button" data-action="guide">${icon('help')}<span>Help & guide</span></button><div class="topbar-divider"></div><span class="workspace-avatar" aria-hidden="true"><img src="./assets/rbliloy-logo.png" alt="" width="22" height="25"></span></div></header><main id="workspace" tabindex="-1"><div class="page-heading"><div><p class="eyebrow"><span></span> CREDIT RISK WORKSPACE</p><h1>Credit risk assessment</h1><p class="page-description">Complete a Consumer or Business/SME rating and prepare it for review.</p></div><button class="button button-outline" data-action="new">${icon('plus')}New assessment</button></div><div class="bank-line">${BANK}<span>${ADDRESS}</span></div>
  <div class="workspace-grid"><div class="form-column"><div id="form-types"></div><div id="policy-banner"></div><nav class="steps" aria-label="Assessment steps" id="steps"></nav><section class="form-panel" id="step-content"></section><div class="form-bottom-note">${icon('lock')}This form does not transmit borrower information. Save or export to keep your work.</div></div><aside class="summary-column" aria-label="Assessment summary"><div id="score-panel"></div><div class="quick-tools"><p class="small-eyebrow">WORKSPACE TOOLS</p><button data-action="policy">${icon('grid')}Scoring policy ${icon('chevron')}</button><button data-action="guide">${icon('file')}Rating reference ${icon('chevron')}</button><button data-action="import">${icon('upload')}Import a saved form ${icon('chevron')}</button></div><p class="summary-note">A CRR supports the credit review process. Lending decisions remain with the bank’s authorized officers.</p></aside></div><footer class="app-footer"><span>Rural Bank of Liloy <b>(ZN), Inc.</b></span><span>CRR Workspace <span class="version">v1.0</span></span></footer></main></div>`;
  render();
}
function render() {
  renderTypes();
  renderSteps();
  renderContent();
  updatePanels();
}
function renderTypes() {
  $('#form-types').innerHTML = `<div class="type-picker" role="group" aria-label="Form type">${Object.entries(FORMS).map(([type, f]) => `<button class="type-card ${state.type === type ? 'selected' : ''}" data-action="type" data-type="${type}" aria-pressed="${state.type === type}"><span class="type-icon">${icon(type === 'consumer' ? 'user' : 'business')}</span><span><b>${f.name}</b><small>${f.description}</small></span><span class="type-check">${state.type === type ? icon('check') : ''}</span></button>`).join('')}</div>`;
}
function renderSteps() {
  $('#steps').innerHTML = steps.map((title, i) => `<button data-action="step" data-step="${i}" class="step ${i === step ? 'current' : ''}" ${i === step ? 'aria-current="step"' : ''}><span>${String(i + 1).padStart(2, '0')}</span><b>${title}</b></button>`).join('');
}
function sectionHeader(eyebrow, title, description, trailing = '') {
  return `<div class="section-heading"><div><p class="small-eyebrow">${eyebrow}</p><h2 id="section-title" tabindex="-1">${title}</h2><p>${description}</p></div>${trailing}</div>`;
}
function footer() {
  return `<div class="panel-footer"><button class="text-button" data-action="${step ? 'previous' : 'drafts'}">${step ? '← Back' : icon('folder') + 'Open a draft'}</button><span class="step-fraction">Step ${step + 1} of 4</span>${step < 3 ? `<button class="button button-primary" data-action="next">${step === 2 ? 'Review assessment' : 'Continue'} ${icon('arrow')}</button>` : `<button class="button button-primary" data-action="print">${icon('print')}Print / PDF</button>`}</div>`;
}
function renderContent() {
  const content = [borrowerView, qualificationView, riskView, reviewView][step]();
  $('#step-content').innerHTML = content + footer();
  $('#step-content').querySelectorAll('details[data-question]').forEach(d => d.addEventListener('toggle', () => { if (d.open) opened.add(d.dataset.question); else opened.delete(d.dataset.question); }));
}
function borrowerView() {
  return sectionHeader('01 / THE BORROWER', 'Start with the essentials', 'Enter the borrower and loan details for this assessment.', '<span class="heading-icon">' + icon('user') + '</span>') + `<form id="step-form" autocomplete="off"><div class="form-grid">${field('Name of borrower', 'borrower.name', { placeholder: 'Full name or registered business name', required: true, wide: true })}${field('Originating branch / unit', 'borrower.branch', { required: true, options: [['', 'Select branch or unit'], 'Head Office', 'BLU Piñan', 'BLU Ipil', 'BLU Buug', 'Other'] })}${field('Assessment date', 'borrower.date', { type: 'date', required: true })}<div class="field amount-field"><label for="borrower-amount">Amount applied <span class="required">*</span></label><div class="input-prefix"><span>₱</span><input id="borrower-amount" data-path="borrower.amount" type="number" min="0.01" max="1000000000000" step="0.01" inputmode="decimal" required value="${e(state.borrower.amount)}" placeholder="0.00"></div></div><div class="field"><label for="borrower-term">Loan term <span class="required">*</span></label><div class="term-input"><input id="borrower-term" data-path="borrower.term" type="number" min="1" max="9999" step="1" inputmode="numeric" value="${e(state.borrower.term)}" placeholder="e.g. 12" required><select data-path="borrower.termUnit" aria-label="Term unit">${['months', 'days', 'years'].map(v => `<option ${state.borrower.termUnit === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>${field('Loan type', 'borrower.loanType', { placeholder: state.type === 'consumer' ? 'e.g. Salary loan' : 'e.g. Commercial loan' })}${field('Reference / loan number', 'borrower.reference', { placeholder: 'Optional reference' })}</div><div class="form-divider"></div><div class="form-grid">${field('Prepared by / account officer', 'review.preparedBy', { required: true, placeholder: 'Officer’s full name' })}${field('Prepared date', 'review.preparedDate', { type: 'date', required: true })}</div></form><div class="inline-tip">${icon('help')}<p>${state.type === 'consumer' ? 'Repayment from a registered business? Use the <button class="inline-link" data-action="type" data-type="sme">Business / SME form</button>, as directed by the source CRR.' : 'Assess business operations, financial performance and collateral in one form. Each criterion retains the source’s A, B and C choices.'}</p></div>`;
}
function qualificationView() {
  const form = FORMS[state.type];
  return sectionHeader('02 / BEFORE YOU RATE', 'Pre-qualification checklist', 'Record each requirement. Explain any exception below.') + `<div class="qualification-list">${form.qualification.map((text, i) => `<fieldset class="qualification-row"><legend><span class="check-number">${String(i + 1).padStart(2, '0')}</span>${e(text)}</legend><div class="yes-no">${['yes', 'no', ...(state.type === 'consumer' && [3, 4].includes(i) ? ['na'] : [])].map(v => `<label><input type="radio" name="qualification-${i}" value="${v}" data-qualification="${i}" ${state.qualification[i] === v ? 'checked' : ''}><span>${{ yes: 'Yes', no: 'No', na: 'N/A' }[v]}</span></label>`).join('')}</div></fieldset>`).join('')}</div><div class="form-grid qualification-remarks">${field('Remarks / exception basis', 'qualificationRemarks', { type: 'textarea', placeholder: 'Explain any No or N/A response and reference supporting documents.', wide: true })}${field('Exceptions reviewed / approved by', 'qualificationApprovedBy', { placeholder: 'Required for a No or N/A response', wide: true })}</div><div class="inline-tip">${icon('help')}<p>A “No” response is highlighted for review. It does not automatically determine the CRR or approve/decline the loan.</p></div>`;
}
function riskView() {
  const form = FORMS[state.type];
  const group = form.groups[groupIndex];
  return sectionHeader('03 / RISK ASSESSMENT', 'Build the borrower’s risk profile', 'Select one assessment per criterion and record your supporting reason.') + `<nav class="group-tabs" aria-label="Risk sections">${form.groups.map((g, i) => `<button data-action="group" data-group="${i}" class="${i === groupIndex ? 'active' : ''}" ${i === groupIndex ? 'aria-current="true"' : ''}><span>${g.id}</span>${g.short}</button>`).join('')}</nav><div class="group-heading"><div><h3>${group.id}. ${group.title}</h3><p><b>${state.policy.weights[group.id]}% weight</b><span>·</span>${group.questions.length} criteria</p></div><button class="inline-link" data-action="expand">Expand all</button></div><div class="criteria-list">${group.questions.map((q) => `<details class="criterion" data-question="${q.id}" ${opened.has(q.id) ? 'open' : ''}><summary><span class="criterion-number">${q.number}</span><span class="criterion-title">${e(q.title)}</span><span class="q-score ${optionScore(state, q) !== null ? 'scored' : ''}" data-score-for="${q.id}">${optionScore(state, q) ?? '—'}</span>${icon('chevron')}</summary><div class="criterion-body"><fieldset><legend class="sr-only">${e(q.title)}: select an assessment</legend>${q.options.map(o => `<label class="score-option"><input type="radio" name="${q.id}" data-answer="${q.id}" value="${o.key}" ${state.answers[q.id] === o.key ? 'checked' : ''}><span class="option-letter">${o.key}</span><span class="option-text">${e(o.label)}</span><span class="option-value">${q.id === 's-investments' && o.key === 'B' ? (state.policy.investmentB !== '' && policyStatus(state).evidenced ? state.policy.investmentB : '?') : o.score}<small>pts</small></span></label>`).join('')}</fieldset>${q.note ? `<div class="criterion-note">${icon('help')}<p>${e(q.note)}</p></div>` : ''}<div class="field reason-field"><label for="reason-${q.id}">Reason for rating <span class="optional">/ supporting evidence</span></label><textarea rows="2" maxlength="5000" id="reason-${q.id}" data-reason="${q.id}" placeholder="Record observations, references or supporting evidence…">${e(state.reasons[q.id] || '')}</textarea></div><button class="inline-link muted" data-action="clear-answer" data-id="${q.id}">Clear selection</button></div></details>`).join('')}</div><div class="group-footer"><span id="group-progress"></span>${groupIndex < form.groups.length - 1 ? `<button class="button button-soft" data-action="next-group">Next: ${form.groups[groupIndex + 1].short} ${icon('arrow')}</button>` : `<button class="button button-soft" data-action="step" data-step="3">Review & export ${icon('arrow')}</button>`}</div>`;
}
function reviewView() {
  const r = state.review;
  return sectionHeader('04 / REVIEW & EXPORT', 'Bring the assessment together', 'Check documents, record any adjustments and prepare the final review.') + `<div class="review-borrower"><span class="type-icon">${icon(state.type === 'consumer' ? 'user' : 'business')}</span><div><b>${e(state.borrower.name || 'Borrower name not entered')}</b><span>${e(state.borrower.branch || 'Branch not selected')} · ${money(state.borrower.amount)}</span></div><button class="inline-link" data-action="step" data-step="0">Edit details</button></div><div class="review-block"><h3>Completeness of required documents</h3><div class="document-options">${[['complete', 'Complete & enforceable', 'No change to CRR'], ['minor', 'Minor deficiencies', 'Covered by deviation memo · downgrade 1 level'], ['major', 'Non-deferable deficiencies', 'Automatic CRR 7 restriction · no override']].map(([value, title, detail]) => `<label class="document-option"><input type="radio" data-path="review.documents" name="documents" value="${value}" ${r.documents === value ? 'checked' : ''}><span><b>${title}</b><small>${detail}</small></span></label>`).join('')}</div></div><div class="review-block"><h3>Additional risk conditions</h3><p class="muted small">The worse applicable risk grade is retained.</p><div class="conditions-grid">${checkbox('review.startup', 'Start-up business', 'CRR 6 restriction')}${checkbox('review.negativeWorkingCapital', 'Negative working capital', 'CRR 6 restriction')}${checkbox('review.negativeNetWorth', 'Negative net worth', 'CRR 8 restriction')}${checkbox('review.delinquent', 'Delinquent / past due', 'Bank-assigned CRR 7–10')}</div>${r.delinquent ? `<div class="subform form-grid">${field('Days past due', 'review.daysPastDue', { type: 'number', min: 1, max: 99999, increment: '1', required: true })}${field('Bank-assigned classification', 'review.delinquencyGrade', { options: [['', 'Select CRR'], ...[7, 8, 9, 10].map(n => [String(n), `${n} · ${GRADES[n].title}`])] })}${field('Delinquency classification basis', 'review.delinquencyReason', { type: 'textarea', wide: true, placeholder: 'Reference the bank’s approved days-past-due policy. The PDFs do not supply these thresholds.' })}</div>` : ''}</div><div class="review-block"><h3>Documented rating override <span class="optional">Optional</span></h3>${r.documents === 'major' ? '<div class="notice">Overrides are disabled for non-deferable document deficiencies, as required by the source form.</div>' : `<div class="form-grid">${field('Override CRR', 'review.override', { options: [['', 'No override — use calculated CRR'], ...Object.entries(GRADES).map(([n, g]) => [n, `${n} · ${g.title}`])] })}${field('Override authorized by', 'review.overrideBy', { placeholder: 'Officer’s full name' })}${field('Override reason / policy reference', 'review.overrideReason', { type: 'textarea', wide: true, placeholder: 'Explain the override. Automatic risk restrictions still apply.' })}</div>`}</div><div class="review-block"><h3>Officer review & sign-off</h3><div class="form-grid">${field('Prepared by / account officer', 'review.preparedBy', { required: true })}${field('Prepared date', 'review.preparedDate', { type: 'date', required: true })}${field('Reviewed by', 'review.reviewedBy', { placeholder: 'Reviewer’s full name' })}${field('Review date', 'review.reviewedDate', { type: 'date' })}${field('Approved by', 'review.approvedBy', { placeholder: 'Approver’s full name' })}${field('Approval date', 'review.approvedDate', { type: 'date' })}${field('Remarks from rater / AO', 'review.raterRemarks', { type: 'textarea', wide: true })}${field('Remarks from reviewer / approver', 'review.reviewerRemarks', { type: 'textarea', wide: true })}</div><p class="muted small">Names record the intended officers. They are not authenticated electronic signatures.</p></div><div id="review-result"></div><div class="export-bar"><button class="button button-outline" data-action="export-json">${icon('down')}Download editable form</button><button class="button button-outline" data-action="export-csv">${icon('file')}Export CSV</button></div><p class="small muted">Print / PDF follows the original CRR sheet with light blue shading. Use portrait, A4 or Letter (short bond), 100% scale, and turn off browser headers and footers for the compact two-page layout. Long remarks continue if needed.</p>`;
}
function updatePanels() {
  const c = calculate(state);
  $('#policy-banner').innerHTML = !c.policy.valid ? `<div class="policy-banner">${icon('alert')}<div><b>Scoring policy needs review</b><span>Weights total ${c.policy.sum ?? 'an invalid value'}%. Final CRR needs approved weights totaling 100%.</span></div><button data-action="policy">Review ${icon('arrow')}</button></div>` : '';
  $('#score-panel').innerHTML = `<section class="score-panel"><div class="score-panel-top"><p class="small-eyebrow">ASSESSMENT SNAPSHOT</p><span class="status-dot">${c.ready ? 'For review' : 'In progress'}</span></div><h2>${FORMS[state.type].name}</h2><div class="score-display"><strong>${c.score?.toFixed(2) ?? '—'}</strong><span>/ 10<span>Weighted score</span></span></div>${c.finalGrade !== null ? `<div class="rating-result ${c.finalGrade > 6 ? 'risk-high' : ''}"><b>CRR ${c.finalGrade} · ${c.grade.title}</b><span>${c.grade.risk} · ${c.grade.acceptance}</span></div>` : `<div class="rating-pending">${icon('shield')}<span>${!c.policy.valid ? 'Rating awaits policy review' : !c.complete ? 'Your rating builds as you go' : 'Rating awaits review details'}</span></div>`}<div class="completion-label"><b>Criteria completed</b><span>${c.answered} / ${c.total}</span></div><progress value="${c.answered}" max="${c.total}" aria-label="Risk criteria completed"></progress><div class="score-sections">${c.groups.map((g, i) => `<button data-action="jump-group" data-group="${i}"><span class="section-letter ${g.answered === g.count ? 'complete' : ''}">${g.answered === g.count ? icon('check') : g.id}</span><span><b>${g.short}</b><small>${g.appliedWeight}% weight · ${g.answered}/${g.count} rated</small></span><strong>${g.average?.toFixed(2) ?? '—'}</strong></button>`).join('')}</div>${c.normalizedPreview !== null && !c.policy.valid ? `<p class="score-footnote">Provisional normalized preview: <b>${c.normalizedPreview.toFixed(2)}/10</b>. No final CRR until approved weights are recorded.</p>` : ''}<div class="score-panel-actions"><button class="button button-primary" data-action="save">${icon('save')}Save draft</button><span class="save-status">${dirty ? 'Unsaved changes' : state.updatedAt ? 'Saved on this browser' : 'New assessment · not saved'}</span></div></section>`;
  const progress = $('#group-progress');
  if (progress) progress.textContent = `${c.groups[groupIndex].answered} of ${c.groups[groupIndex].count} criteria scored in this section`;
  allQuestions(state.type).forEach(q => {
    const badge = $(`[data-score-for="${q.id}"]`);
    if (badge) { const score = optionScore(state, q); badge.textContent = score ?? '—'; badge.classList.toggle('scored', score !== null); }
  });
  const result = $('#review-result');
  if (result) {
    const missing = [...c.blockers, ...c.missingFields];
    result.innerHTML = `<div class="review-result ${c.ready ? 'ready' : ''}"><div>${icon(c.ready ? 'check' : 'alert')}<h3>${c.ready ? 'Ready for officer review' : 'A few items still need attention'}</h3></div>${missing.length ? `<ul>${missing.map(t => `<li>${e(t)}</li>`).join('')}</ul><p>You can still save, export or print an incomplete draft.</p>` : `<p>CRR ${c.finalGrade} · ${c.grade.title}. ${c.exceptions ? 'Pre-qualification exceptions are recorded for reviewer attention.' : 'All required assessment inputs are complete.'}</p>`}</div><div class="adjustment-trace"><p><b>Rating trace</b> &nbsp; Base: ${c.baseGrade ?? '—'} → Adjusted: ${c.adjustedGrade ?? '—'} → Calculated CRR: ${c.finalGrade ?? '—'}</p>${c.adjustmentNotes.map(n=>`<p>${e(n)}</p>`).join('')}</div>`;
  }
}
function updateDraftCount() {
  try { $('#draft-count').textContent = readDrafts().length; } catch { $('#draft-count').textContent = '—'; }
}
function setDirty() { dirty = true; dirtyTypes.add(state.type); }
function setPath(path, value) {
  const keys = path.split('.');
  let obj = state;
  for (const key of keys.slice(0, -1)) obj = obj[key];
  obj[keys.at(-1)] = value;
}
function moveStep(next) {
  step = Math.max(0, Math.min(3, Number(next)));
  render();
  $('#section-title')?.focus({ preventScroll: true });
  $('#steps').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  element.classList.toggle('error', error);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 5000);
}
function openModal(title, body, cls = '') {
  modal.className = cls;
  modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('x')}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function showPolicy() {
  const form = FORMS[state.type];
  openModal('Scoring policy', `<p class="modal-lead">Review how this ${form.name} assessment is scored.</p><div class="notice"><b>Source review</b><p>${state.type === 'consumer' ? 'Consumer defaults are 25% + 25% + 25% + 15% + 10% = 100%. C. Repayment is corrected to 25% from the PDF’s 35%. Saved assessments retain their recorded weights; use the default weights below to update this assessment. Custom weights require a bank-approved policy reference.' : 'The SME PDF totals 100%. Items 11 and 12 repeat supplier dependency and remain separate. Scores below 4.00 have no numeric rating band. Item 23’s middle score is unclear; confirm it if B is selected.'}</p></div><p class="small muted">Each section uses the mean of its item scores multiplied by its weight. The final sum is rounded once to two decimals. This calculation convention should be included in the bank’s policy review.</p><form id="policy-form"><div class="policy-weights">${form.groups.map(g=>`<label><span><b>${g.id}. ${g.short}</b><small>Default: ${g.weight}%</small></span><div><input name="weight-${g.id}" type="number" min="0.01" max="100" step="0.01" value="${state.policy.weights[g.id]}" aria-label="${g.short} weight" required><span>%</span></div></label>`).join('')}</div><button type="button" id="default-policy-weights" class="inline-link">Use default weights (100%)</button><div id="weight-total" class="weight-total">Total: ${policyStatus(state).sum}%</div>${state.type === 'sme' ? `<div class="field"><label for="investment-score">Item 23, option B: bank-confirmed score</label><select id="investment-score" name="investmentB"><option value="">Unconfirmed — blocks B selection’s score</option><option value="5" ${state.policy.investmentB === '5' ? 'selected' : ''}>5 points</option><option value="0" ${state.policy.investmentB === '0' ? 'selected' : ''}>0 points</option></select></div>` : ''}<div class="form-grid"><div class="field"><label for="policy-by">Approved by</label><input id="policy-by" name="approvedBy" maxlength="300" value="${e(state.policy.approvedBy)}" placeholder="Authorized officer’s name"></div><div class="field"><label for="policy-reference">Approval / policy reference</label><input id="policy-reference" name="reference" maxlength="300" value="${e(state.policy.reference)}" placeholder="Memo number, date or policy reference"></div></div><label class="check-row policy-check"><input type="checkbox" name="confirmed" ${state.policy.confirmed ? 'checked' : ''}><span>I am recording a bank-approved scoring interpretation.</span></label><p class="small muted">This records your policy reference; it is not an authenticated approval workflow.</p><div class="modal-actions"><button type="button" class="button button-outline" data-action="close">Cancel</button><button type="submit" class="button button-primary">Apply policy</button></div></form>`);
  $('#policy-form').addEventListener('input', () => { const data = new FormData($('#policy-form')); const sum = form.groups.reduce((s,g)=>s+Number(data.get('weight-'+g.id)),0); $('#weight-total').textContent = `Total: ${Number.isFinite(sum) ? sum.toFixed(2) : '—'}%${Math.abs(sum-100)<.00001 ? ' · Balanced' : ' · Must equal 100% for a final CRR'}`; });
  $('#default-policy-weights').addEventListener('click', () => {
    const policyForm = $('#policy-form');
    form.groups.forEach(g => { policyForm.elements['weight-' + g.id].value = g.weight; });
    policyForm.dispatchEvent(new Event('input', { bubbles: true }));
  });
  $('#policy-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const data = new FormData(ev.target);
    const policy = { weights: Object.fromEntries(form.groups.map(g=>[g.id,Number(data.get('weight-'+g.id))])), approvedBy: String(data.get('approvedBy')).trim(), reference: String(data.get('reference')).trim(), confirmed: data.get('confirmed') === 'on', investmentB: String(data.get('investmentB') ?? '') };
    const needsEvidence = form.groups.some(g => policy.weights[g.id] !== g.weight) || policy.investmentB !== '';
    if (needsEvidence && (!policy.confirmed || !policy.approvedBy || !policy.reference)) { toast('Add the approving officer, policy reference and confirmation.', true); return; }
    const p = policyStatus({ ...state, policy });
    if (needsEvidence && !p.valid) { toast('Approved section weights must total exactly 100%.', true); return; }
    state.policy = policy;
    setDirty(); modal.close(); render(); toast('Scoring policy recorded for this assessment.');
  });
}
function showGuide() {
  const form = FORMS[state.type];
  openModal('Your CRR reference', `<p class="modal-lead">${form.name} · based on ${form.source}</p><div class="guide-steps"><div><b>01. Complete the form</b><p>Add borrower details, pre-qualification checks, every risk criterion and document completeness.</p></div><div><b>02. Review the score</b><p>Each section averages its item scores, then applies its percentage weight. The final score is rounded once to two decimals. Unanswered criteria stay incomplete.</p></div><div><b>03. Keep a record</b><p>Save a draft on this browser, download an editable JSON file, export CSV, or use Print / PDF. For PDF, select “Save as PDF” in your print dialog. The compact printout follows the original CRR tables with light blue shading. Use A4 or Letter, portrait, 100% scale, and disable browser headers and footers. Long remarks may need additional pages.</p></div></div><div class="table-scroll"><table class="guide-table"><thead><tr><th>Score</th><th>CRR</th><th>Assessment</th><th>Risk</th></tr></thead><tbody>${Object.entries(GRADES).map(([n,g])=>{const band=form.bands.find(b=>b[2]===Number(n));return `<tr>${band ? `<td>${band[0].toFixed(2)}–${band[1].toFixed(2)}</td>` : n === '7' ? `<td rowspan="4" class="delinquency-range">${e(DELINQUENCY_LABEL)}</td>` : ''}<td><b>${n}</b></td><td>${g.title}</td><td>${g.risk}</td></tr>`;}).join('')}</tbody></table></div><p class="small">CRR 1–4: Pass · CRR 5–6: Fair / conditional pass · CRR 7–10: Fail. These are the source’s rating categories, not lending approvals.</p><div class="notice"><b>Notes from the source forms</b><ul><li>Consumer defaults total 100%, with C. Repayment corrected to 25%. Saved assessments keep their recorded weights until you apply a change in Scoring policy.</li><li>SME supplier dependency appears twice. Both source items are retained.</li><li>The SME table does not assign numeric scores below 4.00 to a CRR. The app leaves that result pending.</li><li>SME item 23 B has an unclear printed score and needs a recorded interpretation.</li><li>Overlapping/missing ratio thresholds are not automatically resolved; individual criteria show source notes.</li><li>Start-up/negative working capital: CRR 6; major document deficiencies: CRR 7; negative net worth: CRR 8. The app keeps the worse applicable grade.</li><li>Past-due CRR 7–10 requires the bank’s classification and policy basis. Days-past-due thresholds were not supplied.</li><li>Minor document deficiencies downgrade one level. Major document deficiencies disable manual override.</li></ul></div><h3>Saving and privacy</h3><p>Nothing entered here is sent to a server. Drafts are stored only when you select Save draft and are accessible to anyone using this browser profile. Exported JSON, CSV and PDF files contain the borrower information you enter. There is no shared database, sign-in or authenticated electronic signature.</p><div class="modal-actions"><button class="button button-primary" data-action="close">Got it</button></div>`, 'wide-modal');
}
function showDrafts() {
  let drafts;
  try { drafts = readDrafts(); } catch(err) { toast(err.message, true); return; }
  openModal('Saved drafts', `<p class="modal-lead">Assessments saved on this browser. ${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'}.</p><div class="field"><label for="draft-search">Find an assessment</label><input type="search" id="draft-search" placeholder="Search borrower, branch or reference…"></div><div id="draft-list"></div><div class="modal-actions"><button class="button button-outline" data-action="import">${icon('upload')}Import editable form</button><button class="button button-primary" data-action="close">Done</button></div>`);
  function list(query = '') {
    const filtered = drafts.filter(d => `${d.borrower.name} ${d.borrower.branch} ${d.borrower.reference} ${FORMS[d.type].name}`.toLowerCase().includes(query.toLowerCase()));
    $('#draft-list').innerHTML = filtered.length ? filtered.map(d=>`<div class="draft-row"><span class="draft-icon">${icon('file')}</span><div><b>${e(d.borrower.name || 'Unnamed borrower')}</b><span>${FORMS[d.type].name} · ${e(d.borrower.branch || 'No branch')}</span><small>${new Date(d.updatedAt).toLocaleString('en-PH')} · ${calculate(d).answered}/${allQuestions(d.type).length} rated</small></div><button class="button button-soft" data-action="open-draft" data-id="${d.id}">Open</button><button class="icon-button" data-action="delete-draft" data-id="${d.id}" aria-label="Delete ${e(d.borrower.name || 'unnamed')} draft">${icon('trash')}</button></div>`).join('') : `<div class="empty-state">${icon('folder')}<h3>${drafts.length ? 'No matching drafts' : 'Your next assessment starts here'}</h3><p>${drafts.length ? 'Try another name or reference.' : 'Save your work at any point to return to it here.'}</p></div>`;
  }
  list(); $('#draft-search').addEventListener('input', ev=>list(ev.target.value));
}
function download(text, mime, extension) {
  const stem = (state.borrower.reference || state.borrower.name || 'assessment').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60).replace(/^-|-$/g,'') || 'assessment';
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `CRR-${state.type}-${stem}.${extension}`; link.click(); setTimeout(()=>URL.revokeObjectURL(url), 10000);
}
async function action(name, target) {
  switch(name) {
    case 'assessment': moveStep(step); break;
    case 'type': {
      const type = target.dataset.type;
      if (state.type === type) return;
      work[state.type] = state;
      state = work[type] ?? createAssessment(type); work[type] = state;
      dirty = dirtyTypes.has(type); groupIndex = 0; opened.add(FORMS[type].groups[0].questions[0].id); render();
      toast(`${FORMS[type].name} selected. Your other form stays in this tab.`); break;
    }
    case 'new': if (dirty && !window.confirm('Discard unsaved changes to this form and start a new assessment?')) return; state = createAssessment(state.type); work[state.type] = state; dirtyTypes.delete(state.type); dirty = false; groupIndex = 0; opened.clear(); opened.add(FORMS[state.type].groups[0].questions[0].id); moveStep(0); break;
    case 'step': moveStep(target.dataset.step); break;
    case 'next': if (step === 0 && !$('#step-form').reportValidity()) return; moveStep(step + 1); break;
    case 'previous': moveStep(step - 1); break;
    case 'group': case 'jump-group': case 'next-group': {
      groupIndex = name === 'next-group' ? groupIndex + 1 : Number(target.dataset.group); step = 2;
      opened.add(FORMS[state.type].groups[groupIndex].questions.find(q=>!state.answers[q.id])?.id || FORMS[state.type].groups[groupIndex].questions[0].id);
      render(); $('#section-title')?.focus({preventScroll:true}); $('#steps').scrollIntoView({block:'start',behavior:'smooth'}); break;
    }
    case 'expand': FORMS[state.type].groups[groupIndex].questions.forEach(q => opened.add(q.id)); renderContent(); updatePanels(); break;
    case 'clear-answer': delete state.answers[target.dataset.id]; setDirty(); renderContent(); updatePanels(); break;
    case 'save': try { state = saveDraft(state); work[state.type] = state; dirty = false; dirtyTypes.delete(state.type); updatePanels(); updateDraftCount(); toast('Draft saved on this browser.'); } catch(err) { toast(`Could not save: ${err.message} Use Download editable form to keep a copy.`, true); } break;
    case 'policy': showPolicy(); break;
    case 'guide': showGuide(); break;
    case 'drafts': showDrafts(); break;
    case 'close': modal.close(); break;
    case 'import': $('#import-file').click(); break;
    case 'open-draft': {
      const loaded = readDrafts().find(d=>d.id===target.dataset.id);
      if (!loaded) return;
      if (dirtyTypes.has(loaded.type) && !window.confirm('Replace the unsaved form of this type with this saved draft?')) return;
      state=loaded; work[state.type]=state; dirtyTypes.delete(state.type); dirty=false; groupIndex=0; opened.add(FORMS[state.type].groups[0].questions[0].id); modal.close(); moveStep(0); toast('Draft opened.'); break;
    }
    case 'delete-draft': if (!window.confirm('Delete this saved draft from this browser? Download it first if you need a backup.')) return; deleteDraft(target.dataset.id); if (state.id === target.dataset.id) {state.updatedAt=null; setDirty();} showDrafts(); updatePanels(); updateDraftCount(); break;
    case 'export-json': download(JSON.stringify(state,null,2),'application/json','crr.json'); toast('Editable assessment downloaded.'); break;
    case 'export-csv': download(buildCsv(state),'text/csv;charset=utf-8','csv'); break;
    case 'print': $('#print-report').innerHTML=buildReport(state); window.print(); break;
  }
}
document.addEventListener('click', ev => {
  const target = ev.target.closest('[data-action]');
  if (!target) return;
  ev.preventDefault();
  Promise.resolve(action(target.dataset.action, target)).catch(err=>toast(err.message || 'The action could not be completed.',true));
});
app.addEventListener('submit', ev => ev.preventDefault());
app.addEventListener('input', ev => {
  const input = ev.target;
  if (input.dataset.path) setPath(input.dataset.path, input.type === 'checkbox' ? input.checked : input.value);
  else if (input.dataset.answer) state.answers[input.dataset.answer] = input.value;
  else if (input.dataset.qualification !== undefined) state.qualification[input.dataset.qualification] = input.value;
  else if (input.dataset.reason) state.reasons[input.dataset.reason] = input.value;
  else return;
  setDirty();
  if (input.dataset.path === 'review.documents' && input.value === 'major') {state.review.override='';state.review.overrideReason='';state.review.overrideBy='';}
  if (['review.documents','review.delinquent'].includes(input.dataset.path)) {
    const focusPath=input.dataset.path, focusValue=input.value;
    renderContent();
    const focus=Array.from(document.querySelectorAll(`[data-path="${focusPath}"]`)).find(el=>el.value===focusValue); focus?.focus({preventScroll:true});
  }
  updatePanels();
});
$('#import-file').addEventListener('change', async ev=>{
  const file=ev.target.files?.[0]; ev.target.value=''; if(!file) return;
  try {
    if(file.size > 1_000_000) throw new Error('This file is too large. Choose a CRR JSON file smaller than 1 MB.');
    const imported=validateAssessment(JSON.parse(await file.text()));
    if(dirtyTypes.has(imported.type) && !window.confirm('Replace the unsaved form of this type with this imported assessment?')) return;
    imported.id=crypto.randomUUID(); imported.updatedAt=null;
    state=imported;work[state.type]=state;groupIndex=0;opened.add(FORMS[state.type].groups[0].questions[0].id);setDirty();modal.close();moveStep(0);toast('Assessment imported. Scores were recalculated. Save draft to keep it.');
  } catch(err) {toast(`Import failed: ${err.message}`,true);}
});
window.addEventListener('beforeunload',ev=>{if(dirtyTypes.size){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('beforeprint',()=>{$('#print-report').innerHTML=buildReport(state);});
window.addEventListener('storage',updateDraftCount);
shell();
updateDraftCount();
registerCrrTools({
  context: document.modelContext,
  readProgress: () => { const c = calculate(state); return { formType: state.type, step: steps[step], scoredCriteria: c.answered, totalCriteria: c.total, weightsTotal: c.policy.sum, scoringPolicyValid: c.policy.valid, readyForOfficerReview: c.ready }; },
  navigate: index => moveStep(index),
});
