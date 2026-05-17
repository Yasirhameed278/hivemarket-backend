const { getClient } = require('../config/db');

const TABLE = 'coupons';

const rowToCoupon = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value || 0),
    minOrder: Number(row.min_order || 0),
    usageLimit: Number(row.usage_limit || 0),
    usedCount: Number(row.used_count || 0),
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const couponToRow = (c) => {
  const row = {};
  if (c.code !== undefined) row.code = String(c.code).toUpperCase().trim();
  if (c.type !== undefined) row.type = c.type;
  if (c.value !== undefined) row.value = Number(c.value);
  if (c.minOrder !== undefined) row.min_order = Number(c.minOrder);
  if (c.usageLimit !== undefined) row.usage_limit = Number(c.usageLimit);
  if (c.usedCount !== undefined) row.used_count = Number(c.usedCount);
  if (c.expiresAt !== undefined) row.expires_at = c.expiresAt || null;
  if (c.isActive !== undefined) row.is_active = Boolean(c.isActive);
  return row;
};

async function create(input) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).insert(couponToRow(input)).select('*').single();
  if (error) throw new Error(error.message);
  return rowToCoupon(data);
}

async function findById(id) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToCoupon(data);
}

async function findByCode(code) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('code', String(code).toUpperCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return rowToCoupon(data);
}

async function updateById(id, patch) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .update(couponToRow(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToCoupon(data);
}

async function deleteById(id) {
  const sb = getClient();
  const { error } = await sb.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

async function list({ page = 1, limit = 50 } = {}) {
  const sb = getClient();
  const from = (Number(page) - 1) * Number(limit);
  const { data, error, count } = await sb
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + Number(limit) - 1);
  if (error) throw new Error(error.message);
  return { coupons: (data || []).map(rowToCoupon), total: count || 0 };
}

async function incrementUsed(id) {
  const current = await findById(id);
  if (current) await updateById(id, { usedCount: current.usedCount + 1 });
}

// Returns the PKR discount amount for a given coupon + order context.
function calcDiscount(coupon, itemsPrice, shippingCost) {
  if (coupon.type === 'percent') return Math.round(itemsPrice * (coupon.value / 100) * 100) / 100;
  if (coupon.type === 'flat') return Math.min(coupon.value, itemsPrice);
  if (coupon.type === 'freeship') return shippingCost || 0;
  return 0;
}

module.exports = { create, findById, findByCode, updateById, deleteById, list, incrementUsed, calcDiscount };
