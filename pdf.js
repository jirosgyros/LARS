const { mdToPdf } = require('md-to-pdf');
const path = require('path');
const fs = require('fs');

const TAILORED_DIR = path.join(__dirname, 'resumes', 'tailored');

async function runExport() {
  console.log('Phase 5: Export to PDF\n');

  if (!fs.existsSync(TAILORED_DIR)) {
    console.log('No tailored resumes found. Run: node job-search.js tailor');
    return;
  }

  const mdFiles = fs.readdirSync(TAILORED_DIR).filter(f => f.endsWith('.md'));
  if (mdFiles.length === 0) {
    console.log('No tailored markdown files found. Run: node job-search.js tailor');
    return;
  }

  let exported = 0;
  for (const file of mdFiles) {
    const mdPath = path.join(TAILORED_DIR, file);
    const pdfPath = mdPath.replace(/\.md$/, '.pdf');
    const name = file.replace(/\.md$/, '');

    process.stdout.write(`  ${name} ... `);

    try {
      const pdf = await mdToPdf(
        { path: mdPath },
        {
          pdf_options: {
            format: 'Letter',
            margin: { top: '0.7in', bottom: '0.7in', left: '0.7in', right: '0.7in' },
          },
          stylesheet: null,
          css: `
            body { font-family: 'Segoe UI', Calibri, sans-serif; font-size: 10.5pt; color: #222; line-height: 1.35; }
            h1 { font-size: 18pt; margin-bottom: 0; }
            h1 + p { font-size: 9.5pt; margin-top: 2px; margin-bottom: 4px; white-space: nowrap; }
            h2 { font-size: 12pt; border-bottom: 1px solid #999; padding-bottom: 2px; margin-top: 12px; margin-bottom: 4px; }
            h3 { font-size: 10.5pt; margin-top: 10px; margin-bottom: 2px; }
            ul { margin-left: 16px; margin-top: 2px; margin-bottom: 2px; }
            li { margin-bottom: 3px; }
            p { margin-top: 2px; margin-bottom: 2px; }
          `,
        }
      );

      fs.writeFileSync(pdfPath, pdf.content);
      console.log('OK');
      exported++;
    } catch (e) {
      console.log(`ERROR -- ${e.message}`);
    }
  }

  console.log(`\nExported ${exported}/${mdFiles.length} PDFs to resumes/tailored/`);
}

module.exports = { runExport };
