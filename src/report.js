import { ADDRESS, BANK, FORMS, GRADES, VERSION, allQuestions } from './schema.js';
import { calculate, optionScore } from './engine.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = value => value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value)) : '—';
export const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const line = (label, value) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`;
export function buildReport(state) {
  const form = FORMS[state.type];
  const result = calculate(state);
  const r = state.review;
  const header = `<header class="report-header"><div class="report-bank"><img class="report-logo" src="./assets/rbliloy-logo.png" alt="Rural Bank of Liloy logo"><div><h1>${BANK}</h1><p>${ADDRESS}</p></div></div><div class="report-tag">${result.ready ? 'ASSESSMENT RECORD' : 'DRAFT · INCOMPLETE'}</div></header>`;
  return `${header}<div class="report-title"><div><p>CREDIT RISK RATING</p><h2>${form.fullName}</h2></div><span>${escapeHtml(state.borrower.reference || state.id.slice(0, 8).toUpperCase())}</span></div>
  <div class="report-meta">${line('Borrower', state.borrower.name)}${line('Originating branch/unit', state.borrower.branch)}${line('Amount applied', money(state.borrower.amount))}${line('Term', state.borrower.term ? `${state.borrower.term} ${state.borrower.termUnit}` : '')}${line('Loan type', state.borrower.loanType)}${line('Assessment date', dateLabel(state.borrower.date))}</div>
  <div class="report-result">${line('Weighted score / 10', result.score?.toFixed(2))}${line('Calculated CRR', result.finalGrade ? `${result.finalGrade} · ${result.grade.title}` : 'Pending completion / policy review')}${line('Risk classification', result.grade?.risk)}${line('Acceptance level', result.grade?.acceptance)}</div>
  <p class="report-disclaimer">Calculated rating is an assessment record, not a loan approval. ${result.ready ? 'Ready for officer review and signatures.' : 'Outstanding items: ' + escapeHtml([...result.blockers, ...result.missingFields].join(' '))}</p>
  ${!result.policy.valid ? `<p class="report-note">Source weights: ${result.policy.sum ?? 'invalid'}%. ${result.normalizedPreview !== null ? `Normalized preview ${result.normalizedPreview.toFixed(2)}/10 is provisional and is not a final CRR.` : ''} Approved weights totaling 100% are required.</p>` : ''}
  <h3>Pre-qualification checklist</h3><table class="report-table"><thead><tr><th>Requirement</th><th class="score-col">Response</th></tr></thead><tbody>${form.qualification.map((text, i) => `<tr><td>${escapeHtml(text)}</td><td>${escapeHtml(({ yes: 'Yes', no: 'No', na: 'N/A' })[state.qualification[i]] || 'Unanswered')}</td></tr>`).join('')}</tbody></table>
  <p><b>Remarks:</b> ${escapeHtml(state.qualificationRemarks || '—')}</p><p><b>Exception review / approved by:</b> ${escapeHtml(state.qualificationApprovedBy || '—')}</p>
  <h3>Section score summary</h3><table class="report-table"><thead><tr><th>Section</th><th>Raw score</th><th>Average / 10</th><th>Weight</th><th>Contribution</th></tr></thead><tbody>${result.groups.map(g => `<tr><td>${g.id}. ${escapeHtml(g.title)}</td><td>${g.answered === g.count ? g.total : 'Incomplete'} / ${g.count * 10}</td><td>${g.average?.toFixed(4) ?? '—'}</td><td>${g.appliedWeight}%</td><td>${g.weighted?.toFixed(4) ?? '—'}</td></tr>`).join('')}</tbody></table>
  <p class="report-note">Calculation: mean of all item scores in each section × its weight; sum section contributions, then round once to two decimals. Missing responses are never scored as zero. ${result.policy.changed ? `Custom weights recorded by ${escapeHtml(state.policy.approvedBy)}; reference: ${escapeHtml(state.policy.reference)}.` : 'Weights taken from the supplied form.'}</p>
  <h3>Documents & rating adjustments</h3><p><b>Document completeness:</b> ${escapeHtml(({ complete: 'Complete and enforceable', minor: 'Minor deficiencies, covered by deviation memo', major: 'Outstanding non-deferable deficiencies' })[r.documents] || 'Unanswered')}</p>
  <p><b>Base CRR:</b> ${result.baseGrade ?? '—'} &nbsp; <b>After automatic adjustments:</b> ${result.adjustedGrade ?? '—'} &nbsp; <b>Override:</b> ${escapeHtml(r.override || 'None')}</p>
  ${result.adjustmentNotes.map(n => `<p class="report-note">${escapeHtml(n)}</p>`).join('')}
  ${r.delinquent ? `<p><b>Past due:</b> ${escapeHtml(r.daysPastDue)} days; CRR ${escapeHtml(r.delinquencyGrade)}. Basis: ${escapeHtml(r.delinquencyReason)}</p>` : ''}
  ${r.override ? `<p><b>Override reason:</b> ${escapeHtml(r.overrideReason)}<br><b>Authorized by:</b> ${escapeHtml(r.overrideBy)}</p>` : ''}
  <p><b>Rater / AO remarks:</b> ${escapeHtml(r.raterRemarks || '—')}</p><p><b>Reviewer / approver remarks:</b> ${escapeHtml(r.reviewerRemarks || '—')}</p>
  <div class="report-signatures">${[['Prepared by', r.preparedBy, r.preparedDate], ['Reviewed by', r.reviewedBy, r.reviewedDate], ['Approved by', r.approvedBy, r.approvedDate]].map(([label, name, date]) => `<div><strong>${escapeHtml(name || '________________________')}</strong><span>${label} / signature</span><span>${dateLabel(date)}</span></div>`).join('')}</div>
  <div class="report-detail-start">${header}<h2>Rating detail & supporting reasons</h2><p>${escapeHtml(state.borrower.name || 'Unnamed borrower')} · ${form.name}</p></div>
  ${form.groups.map(g => `<h3>${g.id}. ${escapeHtml(g.title)} <small>${state.policy.weights[g.id]}%</small></h3><table class="report-table report-detail"><thead><tr><th>Criterion / selected assessment</th><th class="score-col">Score</th><th class="reason-col">Reason for rating</th></tr></thead><tbody>${g.questions.map(q => { const option = q.options.find(o => o.key === state.answers[q.id]); return `<tr><td><b>${q.number}. ${escapeHtml(q.title)}</b><br>${option ? `${option.key}. ${escapeHtml(option.label)}` : 'Not rated'}${q.note ? `<small class="source-note">Source note: ${escapeHtml(q.note)}</small>` : ''}</td><td>${optionScore(state, q) ?? '—'}</td><td>${escapeHtml(state.reasons[q.id] || '—')}</td></tr>`; }).join('')}</tbody></table>`).join('')}
  <h3>Rating reference · ${form.name}</h3><table class="report-table"><thead><tr><th>Score range</th><th>CRR</th><th>Assessment</th><th>Acceptance</th><th>Risk</th></tr></thead><tbody>${Object.entries(GRADES).map(([number, grade]) => {const band = form.bands.find(b => b[2] === Number(number));return `<tr><td>${band ? `${band[0].toFixed(2)}–${band[1].toFixed(2)}` : 'Policy-based classification'}</td><td>${number}</td><td>${grade.title}</td><td>${grade.acceptance}</td><td>${grade.risk}</td></tr>`;}).join('')}</tbody></table>
  <p class="report-note">${state.type === 'sme' ? 'SME items 11 and 12 repeat supplier dependency in the source and are retained separately. Numeric scores below 4.00 have no supplied rating band. ' : 'The Consumer scan lists weights totaling 110%; no final CRR is assigned until approved 100% weights are recorded. '}Overlapping or missing numeric thresholds are selected manually with a reason. Days-past-due thresholds are not supplied; classifications 7–10 require a recorded bank policy basis. Automatic risk grades are applied as minimum risk restrictions; the worse applicable grade prevails. Manual override is disabled for major document deficiencies. ${state.policy.investmentB !== '' ? `SME item 23 B recorded as ${escapeHtml(state.policy.investmentB)}, reference ${escapeHtml(state.policy.reference)}.` : ''}</p>
  <footer class="report-footer">${BANK} · CRR workspace ${VERSION} · Source: ${form.source} · Record ${escapeHtml(state.id)}</footer>`;
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
