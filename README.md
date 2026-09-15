# Rural Bank of Liloy (ZN), Inc. — CRR Workspace

A responsive online credit risk rating form based on the supplied Consumer and Business/SME CRR sheets. The bank header uses **(ZN)** throughout. The blue theme follows the bank’s supplied logo, which appears in the navigation, browser icon and printable reports.

## Use the form

1. Choose Consumer or Business / SME.
2. Enter the borrower, originating branch, amount applied, term and preparing officer.
3. Answer the pre-qualification checklist and explain any No or N/A responses.
4. Rate every criterion using its A, B or C option. Record supporting reasons.
5. Review document completeness, additional risk conditions and any documented override.
6. Save a draft, download the editable JSON record, export CSV, or select **Print / PDF**. Choose **Save as PDF** in the print dialog. Use **portrait, A4 or Letter (short bond), 100% scale**, and turn off browser headers/footers. The complete form follows the original PDF table layout with pale blue section shading and is designed for **two pages** with typical completed entries. All A/B/C choices, selected checkboxes, reasons, section totals, document checks, signatures and the rating reference are retained. Unusually long remarks continue onto extra pages rather than being cut off.

The app contains 19 Consumer criteria (the PDF repeats number 7) and 26 SME criteria. The repeated SME supplier question is retained. Consumer and SME work are kept separately while the tab remains open.

## Source issues requiring bank review

This is a transcription and calculation tool, not a newly approved credit policy. Source ambiguities are visible in the app and printed records:

| Source item | App behavior |
| --- | --- |
| Consumer weights are 25%, 25%, 35%, 15%, 10%: total **110%** | Retains source values. No final CRR until an officer records approved weights totaling 100%, an approving officer and policy reference. A normalized preview is explicitly provisional. The app does not choose replacement weights. |
| Consumer numbering repeats 7 | Both compliance and employment-tenure criteria remain separate, with distinct internal IDs. |
| SME items 11 and 12 both measure supplier dependency | Retains and scores both as printed; does not silently rename the second item to customer concentration. |
| SME item 23 option B score is unclear in the scan | Its score remains unconfirmed. If selected, the rating is blocked until the bank's 0/5 interpretation and reference are recorded. |
| SME numeric bands start at 4.00 | Scores below 4.00 have no inferred final CRR, including when automatic condition flags are set. |
| Some ratio/tenure thresholds overlap or leave gaps | Options retain source meaning with notes; numeric values never auto-select a criterion. Examples include Consumer tenure, years of business and collateral cover, and SME income ratio, OCF, leverage and quick ratio. |
| High-risk industry list is referenced but absent | No industry list is invented. |
| Days-past-due grade thresholds are absent | The officer enters the bank-assigned CRR 7–10 and a policy basis; the app does not infer it from days alone. |

Policy confirmation fields record an interpretation supplied by the operator. They are not an authenticated approval workflow. The PDF examples' borrower names, loan values and signatures are **not** seeded into the app or copied into the repository.

## Calculation convention

Each section's item scores are equally weighted within that section:

```text
Section average = sum of item scores / number of section items
Contribution = section average × section weight / 100
Score = sum of contributions, rounded once to 2 decimals
```

No unanswered criterion is treated as zero, and no overall score is shown until every criterion has a confirmed score. This aggregation convention is explicit because the scans show section weights and a 0–10 rating scale but do not supply a written calculation formula.

The Consumer and SME score-to-grade tables are separate. Higher CRR numbers indicate worse risk. Document and condition adjustments use the worse applicable restriction:

- Minor document deficiencies covered by a deviation memo: downgrade one grade.
- Start-up or negative working capital: grade cannot be better than 6.
- Major/non-deferable document deficiencies: grade cannot be better than 7; manual overrides disabled.
- Negative net worth: grade cannot be better than 8.
- Delinquency: retain the worse bank-assigned grade from 7–10.
- An optional override requires a reason and named authorizer and cannot improve away an automatic restriction.

The app preserves worse classifications rather than upgrading a worse-risk account when another automatic condition is set. This precedence convention is displayed in the guide and report and should be included in model approval. Recorded names/signature lines do not authenticate a person, and a calculated CRR does not constitute a loan approval.

## Data and hosting

This version is a static, browser-only application. No borrower information is transmitted by the app. It has no database, user accounts, shared records, analytics, third-party fonts, CDN scripts or external API calls. A strict content security policy disables network connections from app code.

- **Save draft** explicitly stores the record in the current browser's local storage. Saving does not sync across branches/devices.
- Anyone with access to that browser profile can open its drafts. Clearing browser data removes them.
- JSON, CSV and PDF exports contain the details entered by the operator. Handle them under the bank's normal records procedures.
- JSON imports are size limited, reconstructed from allowed fields and recalculated. Stored totals are never trusted. Imported files receive a new record ID to avoid overwriting an existing draft.
- CSV text neutralizes formula-prefixed input. User text is escaped in HTML and printed reports.
- No real borrower data or uploaded PDF scans are included in the public source repository.

The published Sites copy starts private to its owner. This source package is ready for the GitHub repository requested by the user. GitHub and Sites are separate publishing destinations; later GitHub edits do not automatically update Sites.

### Run locally

Requires Node.js 22 or later. There are no packages to install.

```sh
npm start
```

Open `http://localhost:4173`. Serve over HTTP/HTTPS; opening `index.html` directly with `file://` does not support ES modules consistently. For development only, `PORT` changes the listening port.

```sh
npm test
npm run build
```

The build copies only the public app into `dist/`. Upload that folder to any static host. The source root is also directly deployable, and all public asset URLs are relative, so GitHub Pages repository paths work.

### Optional GitHub Pages

In this repository, open **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**. The root `index.html` and `.nojekyll` are ready for this configuration. Publishing the static interface does not publish users' locally stored drafts.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Structure

```text
index.html          Accessible app shell and security policy
src/schema.js       PDF criteria, weights and separate rating tables
src/engine.js       Pure calculations, validation and explicit draft storage
src/app.js          Form flow, dialogs, local drafts and exports
src/report.js       Printable record and CSV output
src/webmcp.js       Optional non-sensitive progress/navigation page tools
assets/styles.css   Responsive workspace theme
assets/print.css    Compact PDF-style print layout (A4 / Letter)
tests/              Source fidelity, calculation, validation and export tests
scripts/            Dependency-free development server and static build
```

The optional WebMCP integration exposes only form progress and step navigation when supported. It never exposes borrower details or performs policy edits, credit decisions, saves or exports. Unsupported browsers use the normal form unchanged.

## Verification

`npm test` checks the two rating tables and their boundaries, incomplete/zero selections, source weight conflicts, document/automatic restrictions, overrides, unclear SME scores, data round trips, invalid imports, HTML escaping and CSV formula handling. `npm run build` produces the static output. Printed report layout is checked separately with synthetic data. Browser interaction and WebMCP validation should also be performed in the bank's target browsers before operational rollout.
