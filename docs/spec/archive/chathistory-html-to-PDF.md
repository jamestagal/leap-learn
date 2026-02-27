Great question! Invoices are actually a simpler case than proposals, and you have some flexibility in approach. Let me break down the options:
The Core Question: HTML-to-PDF vs Programmatic Generation
Proposals need HTML-to-PDF because they're visually complex—charts, varied layouts, marketing-style content. Invoices are structured and predictable—header, line items table, totals, footer. This opens up two viable paths:
Option A: Same Workflow as Proposals (Recommended)
Since you're already deploying Gotenberg for proposals, use it for invoices too:
Invoice Data (DB) → Go renders HTML template → Gotenberg → PDF
                  ↓
            SvelteKit web view (same template logic)
Why this makes sense:

One PDF infrastructure to maintain, not two
Web view and PDF share the same template - design changes apply to both
Invoice template is just simpler HTML/CSS than proposals
Already have the Gotenberg Go client set up

The invoice management interface in SvelteKit displays the same data that feeds the PDF—you're not maintaining separate rendering logic.
Option B: Programmatic PDF Generation (Go Library)
For invoices specifically, you could skip Gotenberg entirely and generate PDFs directly in Go:
go// Using github.com/signintech/gopdf or similar
pdf := gopdf.GoPdf{}
pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4})
pdf.AddPage()

// Header with logo
pdf.Image(logoPath, 40, 40, nil)
pdf.SetFont("Helvetica", "", 12)
pdf.Cell(nil, "Invoice #INV-2025-001")

// Line items table
for _, item := range invoice.LineItems {
    pdf.Cell(nil, item.Description)
    pdf.Cell(nil, fmt.Sprintf("$%.2f", item.Amount))
}
When this makes sense:

You want invoices to generate even if Gotenberg is down
Sub-millisecond generation matters (Gotenberg adds ~500ms-2s)
You prefer zero external dependencies for core billing

Downsides:

More code to maintain
Harder to iterate on design (code changes vs CSS changes)
Separate logic from your web view

My Recommendation: Unified HTML Workflow
Given your existing architecture, I'd go with Option A for these reasons:

You're already investing in Gotenberg for proposals—amortize that investment
Invoice design iteration is easier in HTML/CSS than Go code
Web view consistency—what you see in SvelteKit is what you get in PDF
Single mental model for your team/future maintainers

Practical Implementation
Database schema addition:
sqlCREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,  -- INV-2025-0001
    proposal_id UUID REFERENCES proposals(id),  -- Link to originating proposal
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_address TEXT,
    
    -- Financials
    subtotal DECIMAL(10,2) NOT NULL,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Status tracking
    status TEXT DEFAULT 'draft',  -- draft, sent, viewed, paid, overdue
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    
    -- Metadata
    notes TEXT,
    payment_terms TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,  -- quantity * unit_price
    sort_order INTEGER DEFAULT 0
);
```

**SvelteKit invoice routes:**
```
/invoices                    - List/dashboard view
/invoices/new               - Create from scratch or from proposal
/invoices/[id]              - View/edit invoice (web view)
/invoices/[id]/pdf          - Triggers PDF generation
The invoice detail page (/invoices/[id]/+page.svelte) serves dual purpose:

Interactive web view for your management interface
The HTML structure that gets templated for PDF generation

Invoice vs Proposal Template Complexity
AspectProposalInvoiceLayoutVariable sections, chartsFixed structureStylingMarketing-heavy, brandedClean, professionalContentDynamic, personalizedTabular, calculatedPages3-7 pages typical1-2 pages typicalTemplate time2-3 days to buildHalf a day
Your invoice template would be something like:
html<!-- invoice-template.html for Gotenberg -->
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { margin: 20mm; }
    body { font-family: 'Inter', sans-serif; }
    .header { display: flex; justify-content: space-between; }
    .line-items { width: 100%; border-collapse: collapse; }
    .line-items th, .line-items td { 
      padding: 12px; 
      border-bottom: 1px solid #e5e7eb; 
    }
    .totals { margin-left: auto; width: 250px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,{{.LogoBase64}}" height="60">
    <div>
      <h1>INVOICE</h1>
      <p>{{.InvoiceNumber}}</p>
    </div>
  </div>
  
  <div class="client-details">
    <p><strong>{{.ClientName}}</strong></p>
    <p>{{.ClientAddress}}</p>
  </div>
  
  <table class="line-items">
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {{range .LineItems}}
      <tr>
        <td>{{.Description}}</td>
        <td>{{.Quantity}}</td>
        <td>${{.UnitPrice}}</td>
        <td>${{.Amount}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  
  <div class="totals">
    <p>Subtotal: ${{.Subtotal}}</p>
    <p>GST (10%): ${{.GSTAmount}}</p>
    <p><strong>Total: ${{.Total}}</strong></p>
  </div>
  
  <div class="payment-info">
    <p>Due Date: {{.DueDate}}</p>
    <p>{{.PaymentTerms}}</p>
  </div>
</body>
</html>
Workflow Integration with Proposals
A nice UX pattern: when a proposal is accepted, auto-generate a draft invoice:
gofunc CreateInvoiceFromProposal(proposalID string) (*Invoice, error) {
    proposal := getProposal(proposalID)
    
    invoice := &Invoice{
        ProposalID:    proposalID,
        ClientName:    proposal.ClientName,
        ClientEmail:   proposal.ClientEmail,
        InvoiceNumber: generateInvoiceNumber(), // INV-2025-0042
        IssueDate:     time.Now(),
        DueDate:       time.Now().AddDate(0, 0, 14), // Net 14
        Status:        "draft",
    }
    
    // Convert proposal pricing to line items
    invoice.LineItems = []LineItem{
        {
            Description: fmt.Sprintf("%s - %s Package", 
                proposal.ClientName, proposal.PackageType),
            Quantity:  1,
            UnitPrice: proposal.Pricing.SetupFee,
            Amount:    proposal.Pricing.SetupFee,
        },
    }
    
    // For subscription: add recurring line item
    if proposal.PackageType == "subscription" {
        invoice.LineItems = append(invoice.LineItems, LineItem{
            Description: "Monthly Website Management",
            Quantity:    1,
            UnitPrice:   proposal.Pricing.MonthlyFee,
            Amount:      proposal.Pricing.MonthlyFee,
        })
    }
    
    return invoice, nil
}
Summary
Use the same Gotenberg infrastructure for invoices as proposals. The benefits of a unified approach (one system to maintain, HTML/CSS design iteration, web view consistency) outweigh the minor overhead of Chromium rendering for simpler documents.
Your invoice generation becomes just another endpoint that:

Fetches invoice data from DB
Renders an HTML template (simpler than proposals)
Sends to Gotenberg
Returns PDF

