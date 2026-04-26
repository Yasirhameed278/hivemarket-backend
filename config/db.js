const { createClient } = require('@supabase/supabase-js');

let admin = null;
let anon = null;

const connectDB = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error(
      '❌ Supabase Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY must be set in .env'
    );
    process.exit(1);
  }

  // Service-role client — bypasses RLS, used for all DB reads/writes from the server.
  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Anon-key client — used for password sign-in / sign-up flows on behalf of end users.
  anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`✅ Supabase Connected: ${new URL(url).host}`);
  return admin;
};

const getClient = () => {
  if (!admin) connectDB();
  return admin;
};

const getAnonClient = () => {
  if (!anon) connectDB();
  return anon;
};

module.exports = connectDB;
module.exports.getClient = getClient;
module.exports.getAnonClient = getAnonClient;
