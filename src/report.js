import { ADDRESS, BANK, FORMS, GRADES, DELINQUENCY_LABEL, VERSION, allQuestions } from './schema.js';
import { calculate, optionScore } from './engine.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = value => value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value)) : '—';
export const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const check = selected => `<span class="paper-check${selected ? ' checked' : ''}" aria-label="${selected ? 'Selected' : 'Not selected'}">${selected ? 'X' : ''}</span>`;
const value = text => escapeHtml(text || '—');
const printTitle = q => ({
  'c-other-income': 'Other income sources (excluding formal/registered business income)',
  's-profitability': 'Profitability / net income (excluding non-recurring profits)',
  's-quick-ratio': 'Quick asset ratio: (cash + marketable securities + trade receivables) / current liabilities',
}[q.id] || q.title);

// Recreate the source sheets as a compact, flowing table. No fixed heights or
// clipped text: unusually long reasons/remarks can continue onto another page.
export function buildReport(state) {
  const form = FORMS[state.type];
  const result = calculate(state);
  const r = state.review;
  const reference = state.borrower.reference || state.id.slice(0, 8).toUpperCase();
  const outstanding = [...result.blockers, ...result.missingFields];
  const qualifications = `<table class="paper-table paper-qualification"><colgroup><col class="criterion-col"><col class="check-col"><col class="check-col"><col class="qualification-remarks-col"></colgroup><thead><tr><th>Pre-Qualification Check List</th><th>Yes</th><th>No</th><th>REMARKS</th></tr></thead><tbody>${form.qualification.map((text, i) => `<tr><td>${escapeHtml(text)}${state.qualification[i] === 'na' ? ' <b>(N/A)</b>' : ''}${!state.qualification[i] ? ' <span class="unanswered">(unanswered)</span>' : ''}</td><td class="center">${check(state.qualification[i] === 'yes')}</td><td class="center">${check(state.qualification[i] === 'no')}</td>${i === 0 ? `<td rowspan="${form.qualification.length}" class="paper-text qualification-remarks"></td>` : ''}</tr>`).join('')}</tbody></table>`;
  const groups = form.groups.map(g => {
    const score = result.groups.find(x => x.id === g.id);
    return `<table class="paper-table paper-rating"><colgroup><col class="criterion-col"><col class="score-col"><col class="reason-col"></colgroup><thead><tr><th>${g.id}. ${escapeHtml(g.title)} <span class="paper-weight">${escapeHtml(score.appliedWeight)}%</span></th><th class="center">SCORE</th><th class="center">Reason for the Rating</th></tr></thead>${g.questions.map(q => `<tbody><tr class="paper-question" data-criterion="${q.id}"><td colspan="2" class="paper-criterion"><table class="paper-options"><colgroup><col class="option-label-col"><col class="option-points-col"></colgroup><tbody><tr class="paper-criterion-title"><th colspan="2">${q.number}. ${escapeHtml(printTitle(q))}</th></tr>${q.options.map(option => {
      const points = optionScore({ ...state, answers: { ...state.answers, [q.id]: option.key } }, q);
      const selected = state.answers[q.id] === option.key;
      return `<tr class="paper-option${selected ? ' selected-option' : ''}"><td>${option.key}. ${escapeHtml(option.label)}</td><td class="option-score">${check(selected)}<span>${points ?? '?'}</span></td></tr>`;
    }).join('')}</tbody></table></td><td class="paper-text reason-cell">${value(state.reasons[q.id])}</td></tr></tbody>`).join('')}<tbody class="paper-total"><tr><td><b>TOTAL ${g.id}</b><span>Average: ${score.average?.toFixed(4) ?? '—'} × ${escapeHtml(score.appliedWeight)}% = ${score.weighted?.toFixed(4) ?? '—'}</span></td><td class="center"><b>${score.answered === score.count ? score.total : '—'}</b> / ${score.count * 10}</td><td class="center">${score.answered}/${score.count} rated</td></tr></tbody></table>`;
  }).join('');
  const documents = [
    ['complete', 'A. Complete and enforceable documentation', 'No change in CRR'],
    ['minor', 'B. Minor documentary deficiencies covered by deviation memo', 'Downgrade by 1 level'],
    ['major', 'C. Outstanding non-deferable documentary deficiencies', 'Automatic CRR 7 minimum'],
  ];
  const adjustments = result.adjustmentNotes.length ? result.adjustmentNotes.map(escapeHtml).join(' ') : 'No automatic adjustments.';
  const review = `<table class="paper-table paper-documents"><colgroup><col class="criterion-col"><col class="score-col"><col class="reason-col"></colgroup><tbody><tr><th colspan="2">COMPLETENESS OF REQUIRED DOCUMENTS</th><th class="center">TOTAL SCORE: ${result.score?.toFixed(2) ?? 'Pending'} / 10</th></tr>${documents.map(([key, title, effect], i) => `<tr><td>${escapeHtml(title)} <span class="document-effect">${effect}</span></td><td class="center">${check(r.documents === key)}</td>${i === 0 ? `<td rowspan="3" class="final-rating"><b>FINAL CRR: ${result.finalGrade ?? 'Pending'}</b><span>${result.grade ? `${escapeHtml(result.grade.title)} · ${escapeHtml(result.grade.risk)}` : 'Completion / policy review required'}</span><span>${result.grade ? escapeHtml(result.grade.acceptance) : ''}</span></td>` : ''}</tr>`).join('')}<tr><td colspan="3" class="rating-trace"><b>Base CRR:</b> ${result.baseGrade ?? '—'} · <b>After adjustments:</b> ${result.adjustedGrade ?? '—'} · <b>Override:</b> ${value(r.override || 'None')}. ${adjustments}${r.delinquent ? `<br><b>Past due:</b> ${value(r.daysPastDue)} days; CRR ${value(r.delinquencyGrade)}. <b>Basis:</b> ${value(r.delinquencyReason)}` : ''}</td></tr></tbody></table>
  <table class="paper-table paper-signoffs"><colgroup><col><col><col></colgroup><tbody><tr>${[['Prepared by', r.preparedBy, r.preparedDate], ['Reviewed by', r.reviewedBy, r.reviewedDate]].map(([label, name, date]) => `<td class="signature-cell"><b>${label} / signature</b><div class="signature-space"></div><div class="paper-text">${value(name)}</div><span>Date: ${dateLabel(date)}</span></td>`).join('')}<td class="signature-cell"></td></tr><tr><td class="paper-text remarks-cell"><b>Remarks from Rater/AO:</b><div>${value(r.raterRemarks)}</div></td><td class="paper-text remarks-cell"><b>Override CRR: ${value(r.override || 'None')}</b><div>${value(r.overrideReason)}</div><div><b>Authorized by:</b> ${value(r.overrideBy)}</div><small>No override for major document deficiencies.</small></td><td class="paper-text remarks-cell"></td></tr></tbody></table>`;
  const bands = `<table class="paper-table paper-reference"><colgroup><col class="range-col"><col class="range-col"><col class="grade-col"><col class="assessment-col"><col class="acceptance-col"><col class="risk-col"></colgroup><thead><tr><th colspan="2" class="center">SCORE RANGE</th><th rowspan="2">CRR</th><th rowspan="2">RATING ASSESSMENT</th><th rowspan="2">ACCEPTANCE LEVEL</th><th rowspan="2">RISK CLASSIFICATION</th></tr><tr><th class="center">FROM</th><th class="center">TO</th></tr></thead><tbody>${Object.entries(GRADES).map(([number, grade]) => {
    const band = form.bands.find(b => b[2] === Number(number));
    return `<tr${result.finalGrade === Number(number) ? ' class="current-grade"' : ''}>${band ? `<td class="center">${band[0].toFixed(2)}</td><td class="center">${band[1].toFixed(2)}</td>` : number === '7' ? `<td colspan="2" rowspan="4" class="delinquency-range">${escapeHtml(DELINQUENCY_LABEL)}</td>` : ''}<td>${number}${number === '6' ? ' · Start-up / negative working capital minimum' : number === '7' ? ' · Major document deficiency minimum' : number === '8' ? ' · Negative net worth minimum' : ''}</td><td>${grade.title}</td><td>${grade.acceptance}</td><td>${grade.risk}</td></tr>`;
  }).join('')}</tbody></table>`;
  const policy = `${state.type === 'consumer' ? 'Consumer default weights total 100%, with C. Repayment corrected to 25%.' : 'SME item 12 assesses buyer/customer dependency; numeric scores below 4.00 have no supplied CRR band. Item 23 B requires a bank-confirmed score.'} Overlapping/unclear source thresholds require a documented interpretation. Past-due CRR 7–10 requires the bank’s policy basis; the worse applicable risk restriction prevails.`;
  return `<div class="paper-form paper-${state.type}">
    <header class="paper-bank"><img src="./assets/rbliloy-logo.png" alt="Rural Bank of Liloy logo"><div><h1>${BANK}</h1><p>${ADDRESS}</p></div></header>
    <div class="paper-form-title"><h2>${state.type === 'consumer' ? 'CONSUMER CRR SHEET' : 'SME/BUSINESS CRR SHEET'}</h2><span>${result.ready ? 'ASSESSMENT RECORD' : 'DRAFT · INCOMPLETE'}</span></div>
    <div class="paper-meta"><div class="paper-bank-name"><b>BANK NAME: ${BANK.toUpperCase()}</b></div><div><span><b>Name of Borrower:</b> ${value(state.borrower.name)}</span><span><b>Originating Branch/Unit:</b> ${value(state.borrower.branch)}</span></div><div><span><b>Amount Applied:</b> ${money(state.borrower.amount)}</span><span><b>Term:</b> ${state.borrower.term ? `${value(state.borrower.term)} ${value(state.borrower.termUnit)}` : '—'}</span><span><b>Assessment Date:</b> ${dateLabel(state.borrower.date)}</span></div><div><span><b>Loan Type:</b> ${value(state.borrower.loanType)}</span><span><b>Reference:</b> ${value(reference)}</span></div></div>
    ${qualifications}${groups}${review}${bands}
    <div class="paper-policy"><p><b>Calculation / policy:</b> Section item mean × weight; sum contributions, round once to 2 decimals. Missing answers are not zero. ${escapeHtml(policy)}</p>${!result.policy.valid ? `<p><b>Weight total: ${escapeHtml(result.policy.sum ?? 'invalid')}%.</b> ${result.normalizedPreview !== null ? `Normalized preview: ${result.normalizedPreview.toFixed(2)}/10 (provisional; not a final CRR).` : ''}</p>` : ''}${result.policy.changed || state.policy.approvedBy || state.policy.reference || state.policy.investmentB !== '' ? `<p><b>Bank interpretation recorded by:</b> ${value(state.policy.approvedBy)}. <b>Reference:</b> ${value(state.policy.reference)}.${state.policy.investmentB !== '' ? ` <b>SME item 23 B:</b> ${value(state.policy.investmentB)}.` : ''}</p>` : ''}${outstanding.length ? `<p><b>Outstanding items:</b> ${escapeHtml(outstanding.join(' '))}</p>` : ''}<p>Calculated rating is an assessment record, not a loan approval. Officer names are not authenticated electronic signatures.</p></div>
    <footer class="paper-footer">${BANK} · CRR ${VERSION} · Source: ${form.source}<span>Record ${escapeHtml(state.id)}</span></footer>
  </div>`;
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function buildCsv(state) {
  const result = calculate(state);
  const rows = [['Section', 'Field', 'Value', 'Score', 'Reason']];
  rows.push(['Record', 'Bank', BANK], ['Record', 'Form', FORMS[state.type].fullName], ['Record', 'Record ID', state.id], ['Record', 'Status', result.ready ? 'Ready for officer review' : 'Draft / incomplete']);
  Object.entries(state.borrower).forEach(([key, value]) => rows.push(['Borrower', key, value]));
  FORMS[state.type].qualification.forEach((q, i) => rows.push(['Pre-qualification', q, state.qualification[i] || 'Unanswered']));
  rows.push(['Pre-qualification', 'Remarks', state.qualificationRemarks], ['Pre-qualification', 'Exception approved by', state.qualificationApprovedBy]);
  FORMS[state.type].groups.forEach(g => {
    g.questions.forEach(q => { const option = q.options.find(o => o.key === state.answers[q.id]); rows.push([g.title, `${q.number}. ${q.title}`, option ? `${option.key}. ${option.label}` : 'Unanswered', optionScore(state, q), state.reasons[q.id] || '']); });
    const calc = result.groups.find(x => x.id === g.id);
    rows.push([g.title, 'Weight (%)', state.policy.weights[g.id]], [g.title, 'Section average', calc.average], [g.title, 'Weighted contribution', calc.weighted]);
  });
  Object.entries(state.review).forEach(([key, value]) => rows.push(['Review', key, value]));
  rows.push(['Result', 'Weighted score', result.score], ['Result', 'Base CRR', result.baseGrade], ['Result', 'Adjusted CRR', result.adjustedGrade], ['Result', 'Calculated CRR', result.finalGrade], ['Result', 'Assessment', result.grade?.title], ['Result', 'Risk', result.grade?.risk], ['Result', 'Acceptance', result.grade?.acceptance], ['Result', 'Outstanding items', [...result.blockers, ...result.missingFields].join(' | ')]);
  rows.push(['Policy', 'Reference', state.policy.reference], ['Policy', 'Recorded approved by', state.policy.approvedBy], ['Policy', 'Confirmation recorded', state.policy.confirmed], ['Policy', 'SME item 23 B score', state.policy.investmentB], ['Policy', 'Formula', 'Section item mean × weight; sum contributions, round once to 2 decimals. Higher grade number means worse risk.'], ['Policy', 'Source', FORMS[state.type].source]);
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
