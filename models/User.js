const crypto = require('crypto');
const { getClient } = require('../config/db');

// ─── Row <→ API mapping ──────────────────────────────────────────────
// DB columns are snake_case; API/legacy frontend expects camelCase + _id.
// The `id` is shared with auth.users (Supabase Auth) — there is no password
// stored in this table.
const TABLE = 'users';

const rowToUser = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar || '',
    phone: row.phone || '',
    addresses: row.addresses || [],
    wishlist: row.wishlist || [],
    cart: row.cart || [],
    isActive: row.is_active,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// ─── Public API ──────────────────────────────────────────────────────
// Profile rows are auto-created by the on-auth.users trigger, but for cases
// where we need to ensure one exists (e.g. legacy users) we upsert.
async function ensureProfile({ id, name, email, role = 'user' }) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .upsert({ id, name, email: email.toLowerCase().trim(), role }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

async function findByEmail(email) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

async function findById(id) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

async function updateById(id, patch) {
  const sb = getClient();
  const dbPatch = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.email !== undefined) dbPatch.email = patch.email.toLowerCase().trim();
  if (patch.role !== undefined) dbPatch.role = patch.role;
  if (patch.avatar !== undefined) dbPatch.avatar = patch.avatar;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.addresses !== undefined) dbPatch.addresses = patch.addresses;
  if (patch.wishlist !== undefined) dbPatch.wishlist = patch.wishlist;
  if (patch.cart !== undefined) dbPatch.cart = patch.cart;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.lastLogin !== undefined) dbPatch.last_login = patch.lastLogin;

  const { data, error } = await sb.from(TABLE).update(dbPatch).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

async function find({ search, role, isActive, page = 1, limit = 20, orderBy = 'created_at', ascending = false } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('*', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  if (role) q = q.eq('role', role);
  if (isActive !== undefined) q = q.eq('is_active', isActive);
  q = q.order(orderBy, { ascending });
  const from = (Number(page) - 1) * Number(limit);
  q = q.range(from, from + Number(limit) - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { users: (data || []).map(rowToUser), total: count || 0 };
}

async function count(filters = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('id', { count: 'exact', head: true });
  if (filters.role) q = q.eq('role', filters.role);
  if (filters.isActive !== undefined) q = q.eq('is_active', filters.isActive);
  if (filters.createdAfter) q = q.gte('created_at', filters.createdAfter);
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

function newCartItemId() {
  return crypto.randomUUID();
}

module.exports = {
  ensureProfile,
  findByEmail,
  findById,
  updateById,
  find,
  count,
  newCartItemId,
};
