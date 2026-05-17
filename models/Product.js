const crypto = require('crypto');
const { getClient } = require('../config/db');

const TABLE = 'products';

// ─── Row <→ API mapping ──────────────────────────────────────────────
const rowToProduct = (row) => {
  if (!row) return null;
  const now = new Date();
  const saleActive =
    Number(row.sale_price || 0) > 0 &&
    row.sale_ends_at &&
    new Date(row.sale_ends_at) > now;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description || '',
    price: Number(row.price),
    comparePrice: Number(row.compare_price || 0),
    salePrice: Number(row.sale_price || 0),
    saleEndsAt: row.sale_ends_at || null,
    onSale: saleActive,
    effectivePrice: saleActive ? Number(row.sale_price) : Number(row.price),
    category: row.category,
    subcategory: row.subcategory || '',
    brand: row.brand || '',
    images: row.images || [],
    thumbnail: row.thumbnail || '',
    stock: row.stock,
    sku: row.sku || '',
    variants: row.variants || [],
    tags: row.tags || [],
    reviews: row.reviews || [],
    rating: Number(row.rating || 0),
    numReviews: row.num_reviews || 0,
    isFeatured: row.is_featured,
    isActive: row.is_active,
    seoTitle: row.seo_title || '',
    seoDescription: row.seo_description || '',
    seoKeywords: row.seo_keywords || [],
    metaImage: row.meta_image || '',
    viewCount: row.view_count || 0,
    soldCount: row.sold_count || 0,
    weight: Number(row.weight || 0),
    dimensions: row.dimensions || {},
    vendorId: row.vendor_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const productToRow = (p) => {
  const row = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.description !== undefined) row.description = p.description;
  if (p.shortDescription !== undefined) row.short_description = p.shortDescription;
  if (p.price !== undefined) row.price = Number(p.price);
  if (p.comparePrice !== undefined) row.compare_price = Number(p.comparePrice);
  if (p.category !== undefined) row.category = p.category;
  if (p.subcategory !== undefined) row.subcategory = p.subcategory;
  if (p.brand !== undefined) row.brand = p.brand;
  if (p.images !== undefined) row.images = p.images;
  if (p.thumbnail !== undefined) row.thumbnail = p.thumbnail;
  if (p.stock !== undefined) row.stock = Number(p.stock);
  if (p.sku !== undefined) row.sku = p.sku || null;
  if (p.variants !== undefined) row.variants = p.variants;
  if (p.tags !== undefined) row.tags = p.tags;
  if (p.reviews !== undefined) row.reviews = p.reviews;
  if (p.rating !== undefined) row.rating = Number(p.rating);
  if (p.numReviews !== undefined) row.num_reviews = Number(p.numReviews);
  if (p.isFeatured !== undefined) row.is_featured = p.isFeatured;
  if (p.isActive !== undefined) row.is_active = p.isActive;
  if (p.seoTitle !== undefined) row.seo_title = p.seoTitle;
  if (p.seoDescription !== undefined) row.seo_description = p.seoDescription;
  if (p.seoKeywords !== undefined) row.seo_keywords = p.seoKeywords;
  if (p.metaImage !== undefined) row.meta_image = p.metaImage;
  if (p.viewCount !== undefined) row.view_count = Number(p.viewCount);
  if (p.soldCount !== undefined) row.sold_count = Number(p.soldCount);
  if (p.weight !== undefined) row.weight = Number(p.weight);
  if (p.dimensions !== undefined) row.dimensions = p.dimensions;
  if (p.salePrice !== undefined) row.sale_price = Number(p.salePrice) || 0;
  if (p.saleEndsAt !== undefined) row.sale_ends_at = p.saleEndsAt || null;
  if (p.vendorId !== undefined) row.vendor_id = p.vendorId || null;
  return row;
};

const slugify = (name) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${Date.now()}`;

// ─── Public API ──────────────────────────────────────────────────────
async function create(input) {
  const sb = getClient();
  const data = { ...input };
  if (!data.slug) data.slug = slugify(data.name || 'product');
  if (!data.thumbnail && Array.isArray(data.images) && data.images.length) data.thumbnail = data.images[0];
  const row = productToRow(data);
  const { data: created, error } = await sb.from(TABLE).insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToProduct(created);
}

async function findById(id) {
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

async function findBySlug(slug) {
  const sb = getClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

async function updateById(id, patch) {
  const sb = getClient();
  const row = productToRow(patch);
  if (patch.name && (!patch.slug)) row.slug = slugify(patch.name);
  const { data, error } = await sb.from(TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return rowToProduct(data);
}

async function softDelete(id) {
  return updateById(id, { isActive: false });
}

// Generic list with filters used by getProducts and chatbot search.
async function list({
  isActive = true,
  keyword,
  category,
  brand,
  minPrice,
  maxPrice,
  rating,
  featured,
  ids,
  excludeId,
  vendorId,
  sort = 'newest',
  page = 1,
  limit = 12,
  select = '*',
} = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select(select, { count: 'exact' });

  if (isActive !== undefined) q = q.eq('is_active', isActive);
  if (vendorId) q = q.eq('vendor_id', vendorId);
  if (category) q = q.ilike('category', `%${category}%`);
  if (brand) q = q.ilike('brand', `%${brand}%`);
  if (minPrice !== undefined && minPrice !== null && minPrice !== '') q = q.gte('price', Number(minPrice));
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') q = q.lte('price', Number(maxPrice));
  if (rating) q = q.gte('rating', Number(rating));
  if (featured) q = q.eq('is_featured', true);
  if (ids && ids.length) q = q.in('id', ids);
  if (excludeId) q = q.neq('id', excludeId);

  if (keyword) {
    const safe = String(keyword).replace(/[%_]/g, '');
    q = q.or(
      `name.ilike.%${safe}%,description.ilike.%${safe}%,brand.ilike.%${safe}%,category.ilike.%${safe}%`
    );
  }

  const sorts = {
    newest:    ['created_at', false],
    price_asc: ['price', true],
    price_desc:['price', false],
    rating:    ['rating', false],
    popular:   ['sold_count', false],
    trending:  ['sold_count', false],
    most_viewed:['view_count', false],
  };
  const [col, asc] = sorts[sort] || sorts.newest;
  q = q.order(col, { ascending: asc });

  const from = (Number(page) - 1) * Number(limit);
  q = q.range(from, from + Number(limit) - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { products: (data || []).map(rowToProduct), total: count || 0 };
}

async function findManyByIds(ids, select = '*') {
  if (!ids || !ids.length) return [];
  const sb = getClient();
  const { data, error } = await sb.from(TABLE).select(select).in('id', ids);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToProduct);
}

async function distinct(column, { isActive = true } = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select(column);
  if (isActive !== undefined) q = q.eq('is_active', isActive);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const set = new Set();
  (data || []).forEach((r) => {
    const v = r[column];
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}

async function count(filters = {}) {
  const sb = getClient();
  let q = sb.from(TABLE).select('id', { count: 'exact', head: true });
  if (filters.isActive !== undefined) q = q.eq('is_active', filters.isActive);
  if (filters.maxStock !== undefined) q = q.lte('stock', filters.maxStock);
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  return count || 0;
}

async function incrementView(id) {
  const sb = getClient();
  const { data: cur } = await sb.from(TABLE).select('view_count').eq('id', id).maybeSingle();
  if (!cur) return;
  await sb.from(TABLE).update({ view_count: (cur.view_count || 0) + 1 }).eq('id', id);
}

async function adjustStock(id, qtyDelta, soldDelta) {
  const sb = getClient();
  // Try the SQL helper first; fall back to a read-modify-write if it isn't installed.
  const { error } = await sb.rpc('adjust_product_stock', {
    p_id: id,
    p_qty: qtyDelta,
    p_sold_delta: soldDelta,
  });
  if (!error) return;
  const { data: cur } = await sb.from(TABLE).select('stock,sold_count').eq('id', id).maybeSingle();
  if (!cur) return;
  await sb
    .from(TABLE)
    .update({
      stock: Math.max(0, (cur.stock || 0) + qtyDelta),
      sold_count: Math.max(0, (cur.sold_count || 0) + soldDelta),
    })
    .eq('id', id);
}

function newReviewId() {
  return crypto.randomUUID();
}

function recomputeRating(reviews) {
  if (!reviews?.length) return { rating: 0, numReviews: 0 };
  const sum = reviews.reduce((a, r) => a + Number(r.rating || 0), 0);
  return { rating: sum / reviews.length, numReviews: reviews.length };
}

module.exports = {
  create,
  findById,
  findBySlug,
  updateById,
  softDelete,
  list,
  findManyByIds,
  distinct,
  count,
  incrementView,
  adjustStock,
  newReviewId,
  recomputeRating,
};
