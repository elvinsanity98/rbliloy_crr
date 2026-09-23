export const BANK = 'Rural Bank of Liloy (ZN), Inc.';
export const ADDRESS = 'Baybay, Liloy, Zamboanga del Norte';
export const VERSION = '1.0';
export const DELINQUENCY_LABEL = 'Delinquent & Past Due Accounts rated anywhere from 7 to 10 depending on days past due';
const q = (id, number, title, options, note = '') => ({
  id, number, title, note,
  options: options.map((label, i) => ({ key: ['A', 'B', 'C'][i], label, score: [10, 5, 0][i] })),
});
const bank = [
  'Client for at least 5 years, with satisfactory payments, cooperative and compliant with requirements/agreements.',
  'Client for less than 5 years and/or 1–2 non-technical payment delays, particularly in the current year; occasionally non-compliant with requirements/agreements.',
  'New account and/or more than 2 non-technical payment delays, particularly in the current year; concerns with requirements/agreements.',
];
const creditors = [
  'Satisfactory credit relations with other banks; no other bank loans or no arrears/past dues.',
  'Past dues with some/all creditors, already settled or fully paid.',
  'Current past dues or previous past dues with other creditors still unresolved.',
];
const residence = ['Living at the present address for at least 10 years.', 'Living at the present address for at least 5 years.', 'Living at the present address for less than 5 years.'];
const lifestyle = ['Conservative lifestyle.', 'Manageable lifestyle, within the client’s means.', 'Extravagant lifestyle compared with the client’s means.'];
const industry = [
  'Stable industry/business of employer.',
  'Relatively stable industry/business (such as manufacturing, processing or services); non-top or government firm.',
  'High-risk/unstable sector, non-top companies, not listed/unpublished, PEP.',
];
const classification = ['Residential.', 'Commercial.', 'Industrial/acceptable agricultural.'];
const supplier = ['Less than 30% of raw materials supplied directly/indirectly by one supplier.', '30–70% of raw materials supplied directly/indirectly by one supplier.', 'Over 70% of raw materials supplied directly/indirectly by one supplier.'];
const buyer = ['Less than 30% of sales directly/indirectly to one buyer/customer.', '30–70% of sales directly/indirectly to one buyer/customer.', 'Over 70% of sales directly/indirectly to one buyer/customer.'];
const group = (id, short, title, weight, questions) => ({ id, short, title, weight, questions });

export const FORMS = {
  consumer: {
    name: 'Consumer', fullName: 'Consumer CRR Sheet', description: 'Personal & consumer lending',
    source: 'CRR-CONSUMER.pdf',
    qualification: [
      'Debt burden ratio met',
      'No adverse credit findings/CMAP; not in NFIS/OFAC list',
      'Eligibility criteria for the loan product met',
      'If employed: required monthly income, work status and tenure met',
      'If with a small business: at least 1 year of operations and net income requirement met',
      'Minimum KYC information and documents complied with',
      'Collateral requirements and documents complied with',
    ],
    groups: [
      group('A', 'Reputation', 'Borrower reputation, condition & banking relationship', 25, [
        q('c-bank', '1', 'Existing relationship with the bank', bank),
        q('c-creditors', '2', 'Existing relationship with other creditors', creditors),
        q('c-residence', '3', 'Residency & ties with the community', residence),
        q('c-age', '4', 'Age & health considerations', [
          'Excellent health; young, middle-aged or nearing retirement (19–35 years old, as printed).',
          'Relatively good health; young, middle-aged or nearing retirement (36–55 years old).',
          'Health concerns, nearing or at retirement age (56–65 years old and above).',
        ]),
        q('c-reputation', '5', 'Reputation in the community', ['Excellent relations with the community, family and friends.', 'Acceptable relations with the community, family and friends.', 'Concerns with relations with the community, family and friends.']),
        q('c-lifestyle', '6', 'Lifestyle', lifestyle),
        q('c-compliance', '7', 'Compliance with requirements/agreements', ['Complete and enforceable documentation.', 'Acceptable, with minor documentary deficiency.', 'Outstanding non-deferable documentary deficiencies.']),
      ]),
      group('B', 'Employment', 'Employment & financial considerations', 25, [
        q('c-tenure', '7', 'Employment experience & tenure', ['Employed for at least 5 years with the current employer.', 'Employed for more than 3 to 5 years with the current employer.', 'Employed for 3 years or less with the current employer.'], 'The source repeats item number 7. Both criteria are retained. Its first two tenure ranges overlap at 5 years; use the bank’s interpretation.'),
        q('c-employer', '8', 'Type of employer/business', industry, 'The referenced high-risk sector listing is not included in the uploaded form.'),
        q('c-years', '9', 'Years of business operation', ['Operating for over 5 years.', 'Operating for over 3 to 5 years.', 'Newly operational / operating for 1 to 2 years.'], 'The scan prints “five (6)” in option B and does not cover every year boundary. Select using the bank’s approved interpretation; no automatic age/year mapping is applied.'),
        q('c-compensation', '10', 'Compensation', ['Net disposable income above ₱50,000/month OR NDI above 30% of proposed monthly amortization.', 'NDI of ₱20,000–₱50,000/month OR NDI of 20–30% of proposed monthly amortization.', 'NDI below ₱20,000/month OR NDI below 20% of proposed monthly amortization.'], 'The income/amortization wording follows the source; the app does not infer a score from monetary values.'),
        q('c-other-income', '11', 'Other income sources', ['Other regular/stable income sources.', 'Other income sources, but unstable/irregular.', 'No other income sources.'], 'Excludes income from a formal/registered business. If repayment comes from a sole proprietorship, partnership or company, the source directs use of the Business/SME form.'),
      ]),
      group('C', 'Repayment', 'Repayment indicators', 25, [
        q('c-income-ratio', '12', 'Loan to net income, net pay or deposit ADB ratio', ['Monthly amortization below 50% of NI or NDI.', 'Monthly amortization equal to 50% of NI or NDI.', 'Monthly amortization above 50% of NI or NDI.']),
        q('c-debt-equity', '13', 'Debt-to-equity ratio', ['Debt-to-equity ratio below 2:1.', 'Debt-to-equity ratio equal to 2:1.', 'Debt-to-equity ratio above 2:1.']),
      ]),
      group('D', 'Collateral', 'Collateral arrangements', 15, [
        q('c-collateral-cover', '14', 'Collateral cover: loan vs. appraised value', ['Loan 50% of appraised value (comparison sign unclear in scan).', 'Loan ≥50% but <60% of appraised value.', 'Loan >60% of appraised value.'], 'The comparison sign in option A is unclear, and exactly 60% is not covered in the source. Record the bank’s interpretation in the reason; the app does not select a band automatically.'),
        q('c-collateral-class', '15', 'Classification of collateral', classification, 'Real estate. Residential examples in the source: house and lot, condominium, townhouse, vacant lot and row house.'),
        q('c-collateral-use', '16', 'Use of collateral', ['Primary residence, business premises or cultivated agricultural land.', 'Investment/others.', 'Non-earning asset / agricultural use / commercial use.']),
      ]),
      group('E', 'Sustainability', 'Sustainable finance', 10, [
        q('c-environment', '17', 'Environmental condition', ['Business/project has no activities hazardous to or harmful to the environment.', 'Business/project has activities that may minimally harm the environment.', 'Business/project has hazardous activities that may harm the environment.']),
        q('c-social', '18', 'Social condition', ['Business/project has no activities that may harm human health or affect human life.', 'Business/project has activities that may minimally harm human health or affect human life.', 'Business/project has activities that may harm human health or affect human life.']),
      ]),
    ],
    bands: [[8.51, 10, 1], [7.01, 8.50, 2], [5.51, 7, 3], [4.01, 5.50, 4], [2.01, 4, 5], [0, 2, 6]],
  },
  sme: {
    name: 'Business / SME', fullName: 'SME / Business CRR Sheet', description: 'Enterprise & business lending',
    source: 'CRR-BUSINESS SME.pdf',
    qualification: ['Not in NFIS/OFAC list', 'No adverse credit findings', 'Liquidity ratio over 1.0×', 'Financial leverage / debt-to-equity ratio below 1.0×', 'Sustained/potential growth in revenue and net income', 'Not in the list of high-risk industries/businesses', 'Collateral requirements complied with'],
    groups: [
      group('A', 'Management', 'Management reputation & banking relationship', 25, [
        q('s-bank', '1', 'Existing relationship with the bank', bank),
        q('s-creditors', '2', 'Existing relationship with other creditors', creditors),
        q('s-residence', '3', 'Residency & ties with the community', residence),
        q('s-succession', '4', 'Age & succession considerations', ['Borrower/owners young (19–35), middle-aged or nearing/at retirement, with business succession fully settled.', 'Relatively young or middle-aged (36–55), nearing/at retirement, with clear business succession only in some critical areas.', 'Health concerns, nearing/at retirement (56–65 and above), and business succession issues.']),
        q('s-feedback', '5', 'Customer, supplier & employee feedback', ['Excellent relations; no strikes or work delays/stoppages; customer patronage and supplier loyalty of at least 10 years.', 'Acceptable relations; 1–2 work delays/stoppages within the year; customer patronage and supplier loyalty of at least 5 years.', 'Relationship concerns; frequent walkouts/work stoppages; customer patronage and supplier loyalty of less than 5 years.']),
        q('s-management', '6', 'Management experience & track record', ['Established good business track record of at least 10 years.', 'At least 5 years’ management experience; some failures but still good performance.', 'Less than 5 years’ management experience and/or poor business record.']),
        q('s-lifestyle', '7', 'Lifestyle', lifestyle),
      ]),
      group('B', 'Business', 'Business considerations & industry conditions', 25, [
        q('s-experience', '8', 'Business experience', ['Operating for at least 10 years.', 'Operating for at least 5 years.', 'Operating for less than 5 years.']),
        q('s-business-type', '9', 'Type of business', industry, 'Source wording retained. The referenced high-risk sector listing is not included.'),
        q('s-location', '10', 'Business location', ['Excellent location; easy access to/from target markets; no peace/order problems; outside typhoon, flood or volcanic hazard areas.', 'Acceptable location near target markets; insignificant peace/order concerns; far from typhoon, flood or volcanic hazard areas.', 'Poor location; difficult access to/from target markets; major peace/order concerns; within/near typhoon, flood or volcanic hazard areas.']),
        q('s-supplier-11', '11', 'Dependency on suppliers', supplier),
        q('s-buyer-12', '12', 'Dependency on Buyers/Customer', buyer, 'Item 12 assesses sales concentration with one buyer/customer. It uses the same percentage bands and A/B/C scores as before. Review this item when opening an older assessment.'),
        q('s-competition', '13', 'Competitive standing', ['Only 1–2 players / among the top 30% of players / market share above 30%.', 'Several players / among the next 30% of players / market share of 20–30%.', 'Many players / among the bottom 40% of players / market share below 20%.']),
        q('s-prospects', '14', 'Industry prospects', ['Stable outlook with good growth potential; industry revenue increasing for the past 3 years.', 'Still stable but showing decline; flat or erratic revenue growth for the past 3 years.', 'Mature industry with declining outlook; revenue decreasing for the past 3 years.']),
        q('s-substitution', '15', 'Threat of substitution', ['Difficult industry entry; minimal substitution; strong brand loyalty and profit margin equal to industry average.', 'Moderate industry entry; substitution constrains pricing; profit margins below industry average.', 'Easy industry entry; low prices to retain demand; below break-even profit margins or loss.']),
      ]),
      group('C', 'Financials', 'Financial performance & repayment indicators', 35, [
        q('s-revenue', '16', 'Revenue / sales growth trend', ['Improving or consistent revenue growth for the last 3 years; better than industry trend.', 'Erratic/declining growth or decreasing revenue for the last 3 years; at par with industry trend.', 'Revenue downtrend for the last 3 years; below industry trend.']),
        q('s-profitability', '17', 'Profitability / net income', ['Increasing NI or consistent NI growth for the last 3 years; better than industry trend.', 'Erratic/declining NI growth or decreasing NI for the last 3 years; at par with industry trend.', 'NI downtrend or losses during the last 3 years; below industry trend.'], 'Exclude non-recurring profits.'),
        q('s-margins', '18', 'Operating margin, net profit margin & return on equity', ['OPM, NPM and ROE consistently increasing over the last 3 years; better than latest industry ratios.', 'OPM, NPM and ROE erratic over the last 3 years; at par with latest industry ratios.', 'OPM, NPM and ROE consistently declining over the last 3 years; below latest industry ratios.']),
        q('s-income-ratio', '19', 'Loan-to-net-income ratio', ['Annual amortization below 30% of previous year’s NI.', 'Annual amortization below 50% of previous year’s NI.', 'Annual amortization exceeds 50% of previous year’s NI.'], 'A and B overlap, and exactly 50% is not covered. Select the criterion under the bank’s interpretation and record a reason.'),
        q('s-cashflow', '20', 'Operating cash flow (OCF)', ['Positive net OCF can cover interest and debt servicing.', 'Positive net OCF can cover either interest or debt servicing, but not both.', 'Positive net OCF cannot cover both interest and debt servicing.'], 'B and C overlap in the source; no negative-OCF band is supplied. Use a documented bank interpretation.'),
        q('s-leverage', '21', 'Financial leverage (debt/equity)', ['At least 0.50× / better than latest industry ratio (as printed).', 'Over 0.50× but below 1.0× / at par with latest industry ratio.', 'Over 1.0× / below latest industry ratio.'], 'The printed “at least 0.50×” overlaps B/C and exactly 1.0× is unclear. No automatic numeric mapping is applied.'),
        q('s-quick-ratio', '22', 'Quick asset ratio', ['Quick asset ratio ≥2.0× / better than latest industry ratio.', 'Quick asset ratio >1.0× but <2.0× / at par with latest industry ratio.', 'Quick asset ratio <1.0× / below latest industry ratio.'], '(Cash + marketable securities + trade receivables) ÷ current liabilities. Exactly 1.0× is not covered in the source.'),
        q('s-investments', '23', 'Investments in non-core businesses/assets', ['No investments in non-core businesses.', 'Minimal investments in non-core businesses; less than 30% of total assets.', 'Significant investments in non-core businesses; at least 30% of total assets.'], 'The score beside option B is unclear in the scan (appears 0/5). Confirm it in Scoring policy before completing an assessment that selects B.'),
      ]),
      group('D', 'Collateral', 'Collateral arrangements', 15, [
        q('s-collateral-cover', '24', 'Collateral cover: loan vs. appraised value', ['Loan <60% of appraised value.', 'Loan ≥60% but <70% of appraised value.', 'Loan ≥70% of appraised value.']),
        q('s-collateral-class', '25', 'Classification of collateral', classification, 'Real estate. Residential examples: house and lot, condominium, townhouse, vacant lot and row house.'),
        q('s-collateral-use', '26', 'Use of collateral', ['Primary residence / business premises.', 'Investment/others.', 'Non-earning asset / agricultural use / commercial use.']),
      ]),
    ],
    bands: [[9, 10, 1], [8.01, 8.99, 2], [7, 8, 3], [6, 6.99, 4], [5, 5.99, 5], [4, 4.99, 6]],
  },
};

export const GRADES = {
  1: { title: 'Excellent', risk: 'Very low risk', acceptance: 'Pass' },
  2: { title: 'Strong', risk: 'Low risk', acceptance: 'Pass' },
  3: { title: 'Good', risk: 'Moderate risk', acceptance: 'Pass' },
  4: { title: 'Fair', risk: 'Moderate risk', acceptance: 'Pass' },
  5: { title: 'Acceptable', risk: 'High risk', acceptance: 'Fair / conditional pass' },
  6: { title: 'Watchlist', risk: 'High risk', acceptance: 'Fair / conditional pass' },
  7: { title: 'Especially mentioned', risk: 'Very high risk', acceptance: 'Fail' },
  8: { title: 'Substandard', risk: 'Very high risk', acceptance: 'Fail' },
  9: { title: 'Doubtful', risk: 'Very high risk', acceptance: 'Fail' },
  10: { title: 'Loss', risk: 'Very high risk', acceptance: 'Fail' },
};
export const allQuestions = type => FORMS[type].groups.flatMap(g => g.questions);
