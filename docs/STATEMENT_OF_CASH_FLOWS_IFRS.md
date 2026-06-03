# Statement of Cash Flows - IAS 7 Indirect Method

## Component Architecture

- Page: `frontend/pages/reports/statement-of-cash-flows.html`
- Renderer and service API: `frontend/js/pages/statement-of-cash-flows.js`
- Styles and print layout: `frontend/css/pages/statement-of-cash-flows.css`
- Public browser service:
  - `window.BanikCashFlowService.generateStatementOfCashFlows(options)`

The current stack hydrates journals and Chart of Accounts through the backend API with local browser cache/fallback. The report renderer should keep using that service boundary rather than reading a future database directly.

This report follows the `CF` sheet logic from `Zabai BD FS FY 24-25 2nd Draft.xlsx`.

## Database and Mapping Structure

Chart of Accounts nodes should carry at least:

```json
{
  "type": "ledger",
  "name": "Sundry Receivables",
  "classification": "Asset",
  "children": []
}
```

Recommended optional mapping fields for future backend use:

```json
{
  "cashFlowCategory": "operating-working-capital",
  "cashFlowSubcategory": "advance-deposit-prepayments",
  "isCashEquivalent": false,
  "isNonCashAdjustment": false,
  "companyId": "company-001",
  "branchId": "dhaka"
}
```

Journal entries should support optional company and branch fields:

```json
{
  "number": "JV/2026/0001",
  "journalDate": "2026-05-27",
  "companyId": "company-001",
  "branchId": "dhaka",
  "lines": [
    { "account": "Service Revenue", "debit": 0, "credit": 100000 },
    { "account": "Bank Account", "debit": 100000, "credit": 0 }
  ]
}
```

## Calculation Formulas

- Net profit or loss after tax = income credits less income debits, less all expense debits.
- Depreciation of Property, Plant & Equipment = period depreciation expense ledger movement.
- Advance, Deposit & Prepayments = previous balance sheet asset balance - current balance sheet asset balance.
- Sundry Receivable = previous balance sheet asset balance - current balance sheet asset balance.
- Long Term Loan = current balance sheet liability balance - previous balance sheet liability balance.
- Salary & Other Payables = current balance sheet liability balance - previous balance sheet liability balance.
- Provision for Expenses = current balance sheet liability balance - previous balance sheet liability balance.
- Acquisition of Tangible Asset = previous PPE cost balance - current PPE cost balance, excluding accumulated depreciation.
- Issued, subscribed & paid up share capital = current equity balance - previous equity balance.
- Share Money Deposit = current equity balance - previous equity balance.
- Net cash flow = operating + investing + financing.
- Closing cash = opening cash + net cash flow.

## Validation Logic

The report validates:

- Current period calculated closing cash equals Balance Sheet cash and cash equivalents.
- Comparative period calculated closing cash equals comparative Balance Sheet cash and cash equivalents.

Differences are shown in the report validation section.

## Sample Service Response

```json
{
  "ranges": {
    "current": { "fromDate": "2025-07-01", "toDate": "2026-06-30", "label": "2026-06-30" },
    "previous": { "fromDate": "2024-07-01", "toDate": "2025-06-30", "label": "2025-06-30" }
  },
  "operating": [
    { "label": "Net profit or (loss) after tax", "current": 681812, "previous": 564648, "strong": true },
    { "label": "Add: Amount consider as non cash item", "heading": true },
    { "label": "Depreciation of Property, Plant & Equipment", "current": 358171, "previous": 356095 },
    { "label": "Changes in Operating Assets & Liabilities", "heading": true },
    { "label": "(Increase)/Decrease in Advance, Deposit & Prepayments", "current": -565346, "previous": 1729660 },
    { "label": "(Increase)/Decrease in Sundry Receivable", "current": 588572, "previous": -2388572 },
    { "label": "Increase/(Decrease) in Long Term Loan", "current": -50954, "previous": 50954 },
    { "label": "Increase/(Decrease) in Salary & Other Payables", "current": 1112502, "previous": -509265 },
    { "label": "Increase/(Decrease) in Provision for Expenses", "current": 565346, "previous": -44500 }
  ],
  "investing": [
    { "label": "Acquisition of Tangible Asset", "current": 0, "previous": -22575 }
  ],
  "financing": [
    { "label": "Issued, subscribed & paid up share capital", "current": 0, "previous": 0 },
    { "label": "Share Money Deposit", "current": -50954, "previous": 0 }
  ],
  "totals": {
    "operating": 2690103,
    "investing": -22575,
    "financing": -50954,
    "netCash": 2616574,
    "openingCash": 1138506,
    "endingCash": 3755080,
    "balanceSheetClosingCash": 3755080
  },
  "validations": [
    {
      "label": "Current period closing cash reconciles with Cash and Cash Equivalents",
      "ok": true,
      "difference": 0
    }
  ]
}
```

## Export and Print

- Excel export creates an `.xls` HTML workbook using the same rendered report data.
- Print / PDF opens a dedicated A4 print document with audit-style typography, comparative columns, bracketed negatives, and double-underlined totals.
