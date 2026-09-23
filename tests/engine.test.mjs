import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMS, allQuestions } from '../src/schema.js';
import { createAssessment, calculate, gradeForScore, validateAssessment, optionScore, saveDraft, readDrafts, deleteDraft, STORAGE_KEY, validDate } from '../src/engine.js';
import { buildReport, buildCsv, csvCell } from '../src/report.js';

function fixture(type = 'sme', choice = 'A') {
  const s = createAssessment(type);
  Object.assign(s.borrower, { name: 'QA SAMPLE — not a real borrower', branch: 'Head Office', amount: '100000', term: '12', reference: 'TEST-ONLY' });
  s.review.preparedBy = 'QA Officer'; s.review.documents = 'complete';
  FORMS[type].qualification.forEach((_,i) => { s.qualification[i]='yes'; });
  allQuestions(type).forEach(q => { s.answers[q.id]=choice; });
  return s;
}
function approvedConsumer(s) {
  s.policy = { ...s.policy, weights: { A: 25, B: 25, C: 25, D: 15, E: 10 }, confirmed: true, approvedBy: 'TEST POLICY ONLY', reference: 'QA fixture — not a bank-approved model' };
  return s;
}
function memoryStorage() { const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))}; }

test('maps all source criteria without deduplicating repeated source numbers',()=>{
  assert.equal(allQuestions('consumer').length,19);
  assert.equal(allQuestions('sme').length,26);
  for(const type of Object.keys(FORMS))assert.equal(new Set(allQuestions(type).map(q=>q.id)).size,allQuestions(type).length);
  assert.equal(allQuestions('consumer').filter(q=>q.number==='7').length,2);
  assert.equal(FORMS.sme.groups[1].questions.find(q=>q.number==='11').title,'Dependency on suppliers');
  assert.equal(FORMS.sme.groups[1].questions.find(q=>q.number==='12').title,'Dependency on Buyers/Customer');
});
test('blank and partially answered forms do not get a score or CRR',()=>{
  const s=createAssessment('sme');s.answers['s-bank']='A';
  const c=calculate(s);assert.equal(c.answered,1);assert.equal(c.score,null);assert.equal(c.finalGrade,null);assert.equal(c.groups[0].average,null);
});
test('Consumer defaults total 100% with Repayment at 25% and need no custom-policy approval',()=>{
  const s=fixture('consumer');
  assert.deepEqual(s.policy.weights,{A:25,B:25,C:25,D:15,E:10});
  assert.equal(s.policy.confirmed,false);
  const c=calculate(s);assert.equal(c.policy.sum,100);assert.equal(c.policy.valid,true);assert.equal(c.score,10);assert.equal(c.finalGrade,1);assert.equal(c.ready,true);
  FORMS.consumer.groups[2].questions.forEach(q=>s.answers[q.id]='C');
  assert.equal(calculate(s).score,7.5);assert.equal(calculate(s).finalGrade,2);
  const sme=fixture();assert.equal(sme.policy.weights.C,35);assert.equal(calculate(sme).policy.sum,100);
});
test('changed weights require a 100% total, approver, reference and confirmation',()=>{
  const s=approvedConsumer(fixture('consumer'));s.policy.weights.A=20;s.policy.weights.B=30;
  assert.equal(calculate(s).score,10);assert.equal(calculate(s).finalGrade,1);
  s.policy.confirmed=false;assert.equal(calculate(s).score,null);
  s.policy.confirmed=true;s.policy.reference='';assert.equal(calculate(s).score,null);
  s.policy.reference='QA';s.policy.weights.C=26;assert.equal(calculate(s).score,null);
});
test('section weighting averages item scores, not all questions together',()=>{
  const s=fixture();
  FORMS.sme.groups[0].questions.forEach(q=>s.answers[q.id]='C');
  const c=calculate(s);assert.equal(c.score,7.5);assert.equal(c.finalGrade,3);assert.equal(c.groups[0].average,0);assert.equal(c.ready,true);
});
test('rounds total once, after calculating section contributions at full precision',()=>{
  const s=fixture();s.answers['s-bank']='B';
  assert.equal(calculate(s).score,9.82);
  assert.equal(calculate(s).groups[0].average,65/7);
});
test('every printed score boundary maps correctly for both rating tables',()=>{
  for(const type of Object.keys(FORMS))for(const [from,to,grade] of FORMS[type].bands){assert.equal(gradeForScore(type,from),grade);assert.equal(gradeForScore(type,to),grade);}
  assert.equal(gradeForScore('consumer',8.505),1);
  assert.equal(gradeForScore('sme',8.005),2);
  for(let cents=0;cents<=1000;cents++)assert.notEqual(gradeForScore('consumer',cents/100),null);
  for(let cents=400;cents<=1000;cents++)assert.notEqual(gradeForScore('sme',cents/100),null);
});
test('SME scores below 4 have no invented numeric grade, even when automatic flags are selected',()=>{
  const s=fixture('sme','C');s.review.negativeNetWorth=true;
  const c=calculate(s);assert.equal(c.score,0);assert.equal(c.finalGrade,null);assert.ok(c.blockers.some(x=>x.includes('below 4.00')));
});
test('a selected zero is counted; a missing answer is not',()=>{
  const s=approvedConsumer(fixture('consumer','C'));s.review.documents='major';
  assert.equal(calculate(s).answered,19);assert.equal(calculate(s).score,0);assert.equal(calculate(s).finalGrade,7);
  delete s.answers['c-social'];assert.equal(calculate(s).answered,18);assert.equal(calculate(s).score,null);
});
test('unclear SME item 23 B cannot silently receive 5 points',()=>{
  const s=fixture();s.answers['s-investments']='B';
  assert.equal(calculate(s).score,null);
  Object.assign(s.policy,{investmentB:'5',confirmed:true,approvedBy:'QA',reference:'QA interpretation'});
  assert.equal(calculate(s).score,9.78);
  s.policy.investmentB='0';assert.equal(calculate(s).score,9.56);
});
test('minor document deficiencies downgrade exactly one level',()=>{
  const s=fixture();s.review.documents='minor';assert.equal(calculate(s).finalGrade,2);
});
test('automatic conditions keep the worse grade and major documents prohibit an override',()=>{
  const s=fixture();s.review.startup=true;assert.equal(calculate(s).finalGrade,6);
  s.review.documents='major';assert.equal(calculate(s).finalGrade,7);
  s.review.negativeNetWorth=true;assert.equal(calculate(s).finalGrade,8);
  s.review.override='9';s.review.overrideBy='QA';s.review.overrideReason='QA reason';assert.equal(calculate(s).finalGrade,null);
});
test('overrides require a reason and named authorizer; automatic restrictions cannot be improved away',()=>{
  const s=fixture();s.review.override='3';assert.equal(calculate(s).finalGrade,null);
  s.review.overrideBy='QA';s.review.overrideReason='Documented example';assert.equal(calculate(s).finalGrade,3);
  s.review.negativeNetWorth=true;assert.equal(calculate(s).finalGrade,null);
  s.review.override='9';assert.equal(calculate(s).finalGrade,9);
});
test('past-due classification requires days and a policy basis, and is never inferred from days alone',()=>{
  const s=fixture();s.review.delinquent=true;s.review.daysPastDue='91';assert.equal(calculate(s).finalGrade,null);
  s.review.delinquencyGrade='9';s.review.delinquencyReason='QA policy example';assert.equal(calculate(s).finalGrade,9);
  s.review.daysPastDue='0';assert.equal(calculate(s).finalGrade,null);
});
test('contradictory Consumer document selections must be reconciled',()=>{
  const s=approvedConsumer(fixture('consumer'));s.answers['c-compliance']='C';
  assert.equal(calculate(s).finalGrade,null);
  s.review.documents='major';assert.equal(calculate(s).finalGrade,7);
});
test('required borrower fields and unexplained pre-qualification exceptions prevent a ready record',()=>{
  const s=fixture();assert.equal(calculate(s).ready,true);
  s.qualification[0]='no';assert.equal(calculate(s).ready,false);
  s.qualificationRemarks='QA exception';s.qualificationApprovedBy='QA reviewer';assert.equal(calculate(s).ready,true);
  s.borrower.amount='0';assert.equal(calculate(s).ready,false);
  s.borrower.amount='10';s.borrower.term='-1';assert.equal(calculate(s).ready,false);
});
test('only conditionally applicable Consumer qualification rows permit N/A',()=>{
  const s=fixture('consumer');s.qualification[3]='na';s.qualificationRemarks='Not employed';s.qualificationApprovedBy='QA';
  assert.doesNotThrow(()=>validateAssessment(s));s.qualification[0]='na';assert.throws(()=>validateAssessment(s));
});
test('date validation rejects malformed dates and non-existent calendar dates',()=>{
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);
});
test('import rebuilds from allowed fields and never trusts injected totals or keys',()=>{
  const s=fixture();s.finalGrade=1;s.answers['injected']='A';s.reasons['s-bank']='<script>alert(1)</script>';
  const restored=validateAssessment(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.finalGrade,undefined);assert.equal(restored.answers.injected,undefined);assert.equal(restored.reasons['s-bank'],'<script>alert(1)</script>');
  assert.equal(calculate(restored).score,10);
});
test('invalid imported scores, objects, versions, policies and oversized text are rejected',()=>{
  for(const mutate of [s=>s.schemaVersion='9',s=>s.type='unknown',s=>s.answers['s-bank']='D',s=>s.review.documents='approved',s=>s.review.startup='yes',s=>s.policy.weights.A=-1,s=>s.policy.weights.A=null,s=>s.reasons['s-bank']='x'.repeat(5001),s=>s.borrower.name={markup:'bad'}]){
    const s=fixture();mutate(s);assert.throws(()=>validateAssessment(s));
  }
});
test('older SME supplier responses are preserved but require a fresh buyer/customer rating',()=>{
  const old=fixture();delete old.answers['s-buyer-12'];
  old.answers['s-supplier-12']='A';old.reasons['s-supplier-12']='Earlier supplier concentration evidence.';
  const restored=validateAssessment(old);
  assert.equal(restored.answers['s-supplier-12'],'A');
  assert.equal(restored.reasons['s-supplier-12'],old.reasons['s-supplier-12']);
  assert.equal(restored.answers['s-buyer-12'],undefined);
  assert.equal(calculate(restored).score,null);
  assert.ok(calculate(restored).blockers.some(x=>x.includes('Rate SME item 12')));
  restored.answers['s-buyer-12']='B';assert.equal(calculate(restored).score,9.84);
  assert.equal(validateAssessment(restored).answers['s-buyer-12'],'B');
});
test('drafts survive a storage round trip; updating retains identity, deleting is scoped',()=>{
  const store=memoryStorage(),s=fixture();const saved=saveDraft(s,store);assert.equal(readDrafts(store).length,1);assert.equal(saved.id,s.id);
  s.borrower.name='Updated QA';saveDraft(s,store);assert.equal(readDrafts(store).length,1);assert.equal(readDrafts(store)[0].borrower.name,'Updated QA');
  const second=fixture('consumer');saveDraft(second,store);deleteDraft(s.id,store);assert.equal(readDrafts(store)[0].id,second.id);
});
test('existing Consumer records retain weights and policy references when defaults change',()=>{
  const s=fixture('consumer');s.policy.weights.C=35;
  const store=memoryStorage();saveDraft(s,store);
  const restored=readDrafts(store)[0];assert.equal(restored.policy.weights.C,35);
  assert.equal(calculate(restored).policy.sum,110);assert.equal(calculate(restored).score,null);
  const approved=validateAssessment(approvedConsumer(fixture('consumer')));
  const report=buildReport(approved);
  assert.ok(report.includes('TEST POLICY ONLY'));assert.ok(report.includes('QA fixture — not a bank-approved model'));
});
test('corrupted or unavailable storage fails without overwriting existing records',()=>{
  const store=memoryStorage();store.setItem(STORAGE_KEY,'broken');assert.throws(()=>saveDraft(fixture(),store));assert.equal(store.getItem(STORAGE_KEY),'broken');
  assert.throws(()=>saveDraft(fixture(),{getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded');}}));
});
test('reports escape arbitrary borrower text and include criteria, sign-offs, policy basis and corrected header',()=>{
  const s=fixture();s.borrower.name='<img src=x onerror=alert(1)>';s.reasons['s-bank']='A < B & C';
  const report=buildReport(s);
  assert.ok(report.includes('Rural Bank of Liloy (ZN), Inc.'));assert.ok(!report.includes('(ZDN)'));assert.ok(report.includes('&lt;img'));assert.ok(!report.includes(s.borrower.name));assert.ok(report.includes('A &lt; B &amp; C'));
  assert.ok(report.includes('26. Use of collateral'));assert.ok(report.includes('Reviewed by / signature'));assert.ok(report.includes('Source: CRR-BUSINESS SME.pdf'));
});
test('incomplete reports are explicitly marked draft',()=>{assert.ok(buildReport(createAssessment()).includes('DRAFT · INCOMPLETE'));});
test('CSV cells neutralize spreadsheet formulas and preserve commas/newlines safely',()=>{
  for(const s of ['=HYPERLINK("https://invalid")',' +SUM(1,2)','-1+2','@SUM(A1)','\t=1']) assert.ok(csvCell(s).startsWith('"\''));
  assert.equal(csvCell('name, "quoted"'),'"name, ""quoted"""');assert.ok(buildCsv(fixture()).startsWith('\ufeff'));
});

export { fixture, approvedConsumer };
