const { getClient } = require('../config/db');

const TABLE = 'vendors';

const rowToVendor = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    description: row.description || '',
    logo: row.logo || '',
    commissionRate: Number(row.commission_rate || 10),
    status: row.status,
    totalEarnings: Number(row.total_earnings || 0),
    totalSales: Number(row.total_sales || 0),
    bankDetails: row.bank_details || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const vendorToRow = (v) => {
  const row = {};
  if (v.userId !== undefined) row.user_id = v.userId;
  if (v.storeName !== undefined) row.store_name = v.storeName;
  if (v.description !== undefined) row.description = v.description;
  if (v.logo !== undefined) row.logo = v.logo;
  if (v.commissionRate !== undefined) row.commission_rate = Number(v.commissionRate);
  if (v.status !== undefined) row.status = v.status;
  if (v.totalEarnings !== undefined) row.total_earnings = Number(v.totalEarnings);
  if (v.totalSales !== undefined) row.total_sales = Number(v.totalSales);
  if (v.bankDetails !== undefined) row.bank_details = v.bankDetails;
  return row;
};

async function create(input) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).insert(vendorToRow(input)).select('*').single();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

async function findById(id) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

async function findByUserId(userId) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

async function updateById(id, patch) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .update(vendorToRow(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToVendor(data);
}

async function list({ status, page = 1, limit = 20 } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const from = (Number(page) - 1) * Number(limit);
  q = q.range(from, from + Number(limit) - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { vendors: (data || []).map(rowToVendor), total: count || 0 };
}

async function addEarnings(id, amount, salesCount = 1) {
  const current = await findById(id);
  if (!current) return;
  await updateById(id, {
    totalEarnings: current.totalEarnings + amount,
    totalSales: current.totalSales + salesCount,
  });
}

module.exports = { create, findById, findByUserId, updateById, list, addEarnings };
