// Local dev entry point. Vercel does NOT run this file — it uses api/index.js instead.
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
