# HTML-to-PDF for professional proposals: Gotenberg wins

**Stirling PDF is not the right tool for your use case.** While it offers HTML-to-PDF functionality, it relies on WeasyPrint under the hood—a rendering engine with documented CSS limitations that make it unsuitable for professional business proposals with complex layouts. For your SvelteKit + Go stack on a Hostinger VPS with Traefik, **Gotenberg is the optimal self-hosted solution**, offering Chromium-based rendering with native Go client libraries and Docker-first deployment.

Your low-volume use case (single-digit proposals daily) also opens compelling managed alternatives: Cloudflare Browser Rendering integrates natively with your Cloudflare Pages frontend, while DocRaptor provides premium Prince-engine quality at $15/month.

---

## Stirling PDF's HTML-to-PDF has critical limitations

Stirling PDF is primarily a **PDF manipulation tool**—merging, splitting, compressing, OCR—not a document generation platform. HTML-to-PDF is one of 50+ features, not its core focus. The critical limitation: it uses **WeasyPrint** as its rendering engine.

GitHub issues #4815 and #3056 document persistent problems with CSS not being applied correctly. WeasyPrint's limitations directly impact professional proposals:

| CSS Feature | Support Status | Impact on Proposals |
|-------------|---------------|---------------------|
| Flexbox | Limited, buggy | Layout breakage for modern templates |
| CSS Grid | Basic only | Cannot reliably position complex elements |
| External stylesheets | Inconsistent | Styling may not render |
| Tables | Slow, layout issues | Performance metrics tables may break |
| Custom fonts | Requires extra config | Typography inconsistency |

**The verdict**: Stirling PDF is excellent for post-processing PDFs (compression, merging proposals into packages, adding watermarks), but don't use it for initial HTML-to-PDF generation. Deploy it alongside a proper rendering solution if you need its manipulation features.

---

## Gotenberg: The ideal self-hosted solution for your stack

Gotenberg was purpose-built for HTML-to-PDF conversion in Docker environments. With **70+ million Docker Hub pulls**, it's production-proven and actively maintained.

### Why Gotenberg fits your architecture perfectly

**Chromium-powered rendering** delivers full modern CSS support—flexbox, grid, custom fonts, print media queries all work exactly as they would in Chrome. Your professionally-styled proposals with logos, performance metrics tables, and branded typography will render pixel-perfect.

**Native Go integration** eliminates friction with your GoFast backend. The maintained client library (`github.com/starwalkn/gotenberg-go-client/v8`) provides type-safe API access:

```go
client, _ := gotenberg.NewClient("gotenberg:3000", http.DefaultClient)
index, _ := document.FromString("index.html", proposalHTML)

req := gotenberg.NewHTMLRequest(index)
req.PaperSize(gotenberg.A4)
req.Margins(gotenberg.NoMargins)
req.PrintBackground(true)

client.Store(context.Background(), req, "proposal.pdf")
```

**Headers, footers, and page numbers** use dedicated HTML templates with automatic variables:

```html
<!-- footer.html -->
<p style="font-size: 10px;">
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</p>
```

### Docker Compose with Traefik integration

```yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    command:
      - "gotenberg"
      - "--api-timeout=60s"
      - "--chromium-restart-after=50"
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gotenberg.rule=Host(`pdf.yourdomain.com`)"
      - "traefik.http.services.gotenberg.loadbalancer.server.port=3000"
```

**Resource requirements** are modest for low volume: **512MB RAM minimum**, 1GB recommended. A single Gotenberg instance handles sequential conversions efficiently—your single-digit daily volume won't require horizontal scaling.

---

## Alternative solutions compared

### Cloudflare Browser Rendering: Native edge integration

If you prefer keeping PDF generation within Cloudflare's ecosystem rather than your VPS, their **Browser Rendering API** became production-ready in 2025 with competitive pricing:

| Plan | Included | Monthly Cost |
|------|----------|--------------|
| Workers Free | 10 minutes/day | $0 |
| Workers Paid | 10 hours/month | $5 base |

For ~30-second proposals, the free tier covers **20 PDFs/day**—sufficient for your use case. The paid tier provides ~1,200 monthly generations.

**Integration from a Cloudflare Worker**:
```javascript
const pdf = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/browser-rendering/pdf`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    body: JSON.stringify({ url: proposalUrl, format: 'A4' })
  }
);
```

**Trade-off**: Less mature than Gotenberg, limited customization for headers/footers compared to dedicated solutions.

### Commercial APIs for zero maintenance

**DocRaptor ($15/month)** uses the Prince XML engine—the industry gold standard for PDF typography. If your proposals require precise print layouts, accessible PDFs (WCAG 2.0), or complex features like footnotes and cross-references, Prince's rendering quality is unmatched. The Basic plan covers 125 documents monthly with **99.99% uptime SLA**.

**API2PDF (~$1.15/month)** offers pay-as-you-go pricing that's remarkably cheap for low volume: $0.001/MB bandwidth plus $0.0002/second compute. For 200 proposals monthly, total cost stays under $2.

**PDFShift** provides a middle ground at $24/month for 2,500 documents with Chromium rendering and HIPAA compliance if you handle sensitive client data.

### Solutions to avoid

**wkhtmltopdf is deprecated and dangerous.** The project was archived in January 2023, using a WebKit engine from 2012 with known security vulnerabilities. It cannot render flexbox, CSS Grid, or modern JavaScript. Never use it for production systems.

**WeasyPrint** (which powers Stirling PDF) is acceptable for simple invoices but struggles with complex layouts. Known issues include high memory consumption (1.4GB+ for large documents), problems with nested flexbox, and unreliable page breaks in grid layouts.

---

## Architecture decision matrix

| Factor | Gotenberg (VPS) | CF Browser Rendering | DocRaptor API |
|--------|-----------------|---------------------|---------------|
| Monthly cost | ~$0 (existing VPS) | $0-5 | $15-29 |
| Setup complexity | Medium (2-4 hours) | Low (1-2 hours) | Low (1 hour) |
| CSS quality | Excellent | Excellent | Best (Prince) |
| Go integration | Native client library | HTTP from VPS | HTTP only |
| Data privacy | Full control | Cloudflare infrastructure | Third-party |
| Maintenance | Docker updates | Zero | Zero |
| Headers/footers | Full HTML templates | Limited | Full control |

---

## Recommended implementation for Plentify Web Designs

### Primary path: Gotenberg on your Hostinger VPS

Deploy Gotenberg alongside your existing Docker services. Your Go backend generates proposal HTML (pulling data from your database, applying branded templates), sends it to Gotenberg via the Go client library, and returns the PDF to SvelteKit for download.

**Request flow**:
```
SvelteKit (CF Pages) → Go API (VPS) → Gotenberg (VPS) → PDF Response
```

**Why this works best for you**:
- Leverages existing infrastructure—no new services to pay for
- Go-native integration with your GoFast backend
- Full control over PDF appearance via HTML/CSS templates
- Traefik handles routing and SSL automatically
- Sub-second latency since everything runs on the same VPS

### Fallback consideration: Cloudflare Browser Rendering

If you want to minimize VPS resource usage or prefer edge-based architecture, use CF Browser Rendering from a Cloudflare Worker that sits between your SvelteKit frontend and Go backend. This adds slight complexity (Worker deployment, API token management) but removes the Gotenberg container from your VPS.

### For enterprise-grade output: Add DocRaptor

If clients later request accessible PDFs (PDF/UA) or you need features like automatic table of contents with page numbers, DocRaptor's Prince engine delivers capabilities no open-source tool matches. At $15/month for your volume, it's a reasonable upgrade when requirements demand it.

---

## Implementation checklist

Setting up Gotenberg for your proposal system requires these steps:

- **Deploy Gotenberg container** with the docker-compose configuration above, adjusting Traefik labels for your domain
- **Install Go client** via `go get github.com/starwalkn/gotenberg-go-client/v8`
- **Create proposal HTML template** using CSS print media queries for optimal rendering (`@media print`, `@page` rules for margins)
- **Add custom fonts** by extending the Gotenberg image with your brand fonts in `/usr/local/share/fonts/`
- **Build header/footer templates** with your logo (base64 encoded) and page numbering
- **Implement Go endpoint** that accepts proposal data, renders HTML template, calls Gotenberg, returns PDF
- **Add SvelteKit download handler** that fetches PDF from Go API and triggers browser download

For professional proposals with your specified requirements—logos, styled tables, performance metrics—Gotenberg's Chromium rendering handles everything reliably while integrating cleanly with your existing Go and Docker infrastructure.