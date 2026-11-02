const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { initDb } = require('./database');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/classes',    require('./routes/classes'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve React build in production
const frontendBuild = path.join(__dirname, '..', '..', 'frontend', 'build');
app.use(express.static(frontendBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// Boot: init DB then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  TURSO_URL set: ${!!process.env.TURSO_URL}`);
    });
  })
  .catch(err => {
    console.error('');
    console.error('❌ STARTUP FAILED:', err.message);
    console.error('');
    if (!process.env.TURSO_URL) {
      console.error('👉 TURSO_URL is not set. Go to your Render dashboard →');
      console.error('   Environment tab → add TURSO_URL and TURSO_TOKEN');
    }
    console.error('');
    process.exit(1);
  });

module.exports = app;
