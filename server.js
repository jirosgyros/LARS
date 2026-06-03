const express = require('express');
const path = require('path');
const { loadJson, saveJson } = require('./data');

function startServer(port = 3000) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/matches', (req, res) => {
    const matches = loadJson('matches.json');
    res.json(matches);
  });

  app.get('/api/status', (req, res) => {
    res.json({
      matches: loadJson('matches.json').length,
      approved: loadJson('approved.json').length,
      rejected: loadJson('rejected.json').length,
    });
  });

  app.post('/api/approve', (req, res) => {
    const { jobId } = req.body;
    const matches = loadJson('matches.json');
    const approved = loadJson('approved.json');

    const idx = matches.findIndex(m => m.jobId === jobId);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });

    const job = matches.splice(idx, 1)[0];
    job.reviewedAt = new Date().toISOString();
    approved.push(job);

    saveJson('matches.json', matches);
    saveJson('approved.json', approved);
    res.json({ ok: true, remaining: matches.length });
  });

  app.post('/api/reject', (req, res) => {
    const { jobId } = req.body;
    const matches = loadJson('matches.json');
    const rejected = loadJson('rejected.json');

    const idx = matches.findIndex(m => m.jobId === jobId);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });

    const job = matches.splice(idx, 1)[0];
    job.reviewedAt = new Date().toISOString();
    rejected.push(job);

    saveJson('matches.json', matches);
    saveJson('rejected.json', rejected);
    res.json({ ok: true, remaining: matches.length });
  });

  app.post('/api/bulk', (req, res) => {
    const { action, jobIds } = req.body;
    const matches = loadJson('matches.json');
    const target = loadJson(action === 'approve' ? 'approved.json' : 'rejected.json');

    let moved = 0;
    for (const jobId of jobIds) {
      const idx = matches.findIndex(m => m.jobId === jobId);
      if (idx !== -1) {
        const job = matches.splice(idx, 1)[0];
        job.reviewedAt = new Date().toISOString();
        target.push(job);
        moved++;
      }
    }

    saveJson('matches.json', matches);
    saveJson(action === 'approve' ? 'approved.json' : 'rejected.json', target);
    res.json({ ok: true, moved, remaining: matches.length });
  });

  app.listen(port, () => {
    console.log(`Review UI running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.\n');
  });
}

module.exports = { startServer };
