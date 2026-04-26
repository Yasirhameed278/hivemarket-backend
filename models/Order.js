const crypto = require('crypto');
const { getClient } = require('../config/db');

const TABLE = 'orders';

const generateOrderNumber = () =>
  'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const rowToOrder = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    orderNumber: row.order_number,
    items: row.items || [],
    shippingAddress: row.shipping_address || {},
    paymentMethod: row.payment_method,
    paymentResult: row.payment_result || {},
    itemsPrice: Number(row.items_price || 0),
    shippingPrice: Number(row.shipping_price || 0),
    taxPrice: Number(row.tax_price || 0),
    totalPrice: Number(row.total_price || 0),
    couponCode: row.coupon_code || '',
    discount: Number(row.discount || 0),
    status: row.status,
    isPaid: row.is_paid,
    paidAt: row.paid_at,
    isDelivered: row.is_delivered,
    deliveredAt: row.delivered_at,
    trackingNumber: row.tracking_number || '',
    trackingHistory: row.tracking_history || [],
    notes: row.notes || '',
    estimatedDelivery: row.estimated_delivery,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const orderToRow = (o) => {
  const row = {};
  if (o.user !== undefined) row.user_id = o.user;
  if (o.orderNumber !== undefined) row.order_number = o.orderNumber;
  if (o.items !== undefined) row.items = o.items;
  if (o.shippingAddress !== undefined) row.shipping_address = o.shippingAddress;
  if (o.paymentMethod !== undefined) row.payment_method = o.paymentMethod;
  if (o.paymentResult !== undefined) row.payment_result = o.paymentResult;
  if (o.itemsPrice !== undefined) row.items_price = Number(o.itemsPrice);
  if (o.shippingPrice !== undefined) row.shipping_price = Number(o.shippingPrice);
  if (o.taxPrice !== undefined) row.tax_price = Number(o.taxPrice);
  if (o.totalPrice !== undefined) row.total_price = Number(o.totalPrice);
  if (o.couponCode !== undefined) row.coupon_code = o.couponCode;
  if (o.discount !== undefined) row.discount = Number(o.discount);
  if (o.status !== undefined) row.status = o.status;
  if (o.isPaid !== undefined) row.is_paid = o.isPaid;
  if (o.paidAt !== undefined) row.paid_at = o.paidAt;
  if (o.isDelivered !== undefined) row.is_delivered = o.isDelivered;
  if (o.deliveredAt !== undefined) row.delivered_at = o.deliveredAt;
  if (o.trackingNumber !== undefined) row.tracking_number = o.trackingNumber;
  if (o.trackingHistory !== undefined) row.tracking_history = o.trackingHistory;
  if (o.notes !== undefined) row.notes = o.notes;
  if (o.estimatedDelivery !== undefined) row.estimated_delivery = o.estimatedDelivery;
  return row;
};

async function create(input) {
  const sb = getClient();
  const order = { ...input };
  if (!order.orderNumber) order.orderNumber = generateOrderNumber();
  const row = orderToRow(order);
  const { data, error } = await sb.from(TABLE).insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToOrder(data);
}

async function findById(id) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToOrder(data);
}

async function findOne({ orderNumber, userId, orderNumberLike } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('*');
  if (userId) q = q.eq('user_id', userId);
  if (orderNumber) q = q.eq('order_number', orderNumber);
  if (orderNumberLike) q = q.ilike('order_number', `%${orderNumberLike}%`);
  q = q.order('created_at', { ascending: false }).limit(1);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return rowToOrder((data || [])[0]);
}

async function updateById(id, patch) {
  const sb = getClient();
  const row = orderToRow(patch);
  const { data, error } = await sb.from(TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return rowToOrder(data);
}

async function findByUser(userId, { limit, page = 1 } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (limit) {
    const from = (Number(page) - 1) * Number(limit);
    q = q.range(from, from + Number(limit) - 1);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(rowToOrder);
}

async function findItemsContaining(productIds, limit = 30) {
  // We can't easily query JSONB array-of-objects with pure builder syntax,
  // so we use a contains filter for each id and merge.
  if (!productIds || !productIds.length) return [];
  const sb = getClient();
  const seen = new Map();
  for (const pid of productIds.slice(0, 20)) {
    const { data } = await sb
      .from(TABLE)
      .select('items')
      .contains('items', [{ product: pid }])
      .limit(limit);
    (data || []).forEach((r, i) => seen.set(`${pid}:${i}:${Math.random()}`, r.items));
  }
  return Array.from(seen.values());
}

async function list({ status, page = 1, limit = 20 } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('*', { count: 'exact' });
  if (status) q = q.eq('status', status);
  q = q.order('created_at', { ascending: false });
  const from = (Number(page) - 1) * Number(limit);
  q = q.range(from, from + Number(limit) - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { orders: (data || []).map(rowToOrder), total: count || 0 };
}

async function count(filters = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('id', { count: 'exact', head: true });
  if (filters.isPaid !== undefined) q = q.eq('is_paid', filters.isPaid);
  if (filters.status) q = q.eq('status', filters.status);
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function totalRevenue() {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('total_price').eq('is_paid', true);
  if (error) throw new Error(error.message);
  return (data || []).reduce((a, r) => a + Number(r.total_price || 0), 0);
}

async function statusCounts() {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('status');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach((r) => {
    map[r.status] = (map[r.status] || 0) + 1;
  });
  return Object.entries(map).map(([_id, count]) => ({ _id, count }));
}

async function recent(limit = 5) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToOrder);
}

async function monthlyRevenue({ months = 12, paidOnly = true } = {}) {
  const sb = getClient();
  const since = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
  let q = sb.from(TABLE).select('total_price,created_at').gte('created_at', since);
  if (paidOnly) q = q.eq('is_paid', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const buckets = new Map();
  (data || []).forEach((r) => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const cur = buckets.get(key) || { _id: { year: d.getFullYear(), month: d.getMonth() + 1 }, revenue: 0, count: 0, orders: 0 };
    cur.revenue += Number(r.total_price || 0);
    cur.count += 1;
    cur.orders += 1;
    buckets.set(key, cur);
  });
  return Array.from(buckets.values()).sort((a, b) => {
    if (a._id.year !== b._id.year) return a._id.year - b._id.year;
    return a._id.month - b._id.month;
  });
}

async function findByPaymentIntentId(paymentIntentId) {
  const sb = getClient();
  // paymentIntentId is stored inside the payment_result JSONB column
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('payment_result->>id', paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return rowToOrder(data);
}

function newTrackingId() {
  return crypto.randomUUID();
}

module.exports = {
  create,
  findById,
  findOne,
  updateById,
  findByUser,
  findByPaymentIntentId,
  findItemsContaining,
  list,
  count,
  totalRevenue,
  statusCounts,
  recent,
  monthlyRevenue,
  newTrackingId,
  generateOrderNumber,
};
