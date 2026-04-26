const Product = require('../models/Product');
const { uploadToCloudinary } = require('../middleware/upload');

exports.getProducts = async (req, res) => {
  const {
    keyword, category, brand, minPrice, maxPrice,
    rating, sort, page = 1, limit = 12, featured,
  } = req.query;

  const { products, total } = await Product.list({
    keyword,
    category,
    brand,
    minPrice,
    maxPrice,
    rating,
    featured: featured === 'true',
    sort,
    page,
    limit,
  });

  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

exports.getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  await Product.incrementView(product._id);
  res.json({ ...product, viewCount: product.viewCount + 1 });
};

exports.getProductBySlug = async (req, res) => {
  const product = await Product.findBySlug(req.params.slug);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  await Product.incrementView(product._id);
  res.json({ ...product, viewCount: product.viewCount + 1 });
};

exports.createProduct = async (req, res) => {
  const data = req.body;
  if (req.files && req.files.length > 0) {
    const urls = await Promise.all(req.files.map((f) => uploadToCloudinary(f.path, 'products')));
    data.images = urls;
    data.thumbnail = urls[0];
  }
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (typeof data.seoKeywords === 'string') data.seoKeywords = data.seoKeywords.split(',').map((t) => t.trim()).filter(Boolean);
  const product = await Product.create(data);
  res.status(201).json(product);
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const data = { ...req.body };
  if (req.files && req.files.length > 0) {
    const urls = await Promise.all(req.files.map((f) => uploadToCloudinary(f.path, 'products')));
    data.images = [...(product.images || []), ...urls];
    data.thumbnail = data.images[0];
  }
  if (typeof data.tags === 'string') data.tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (typeof data.seoKeywords === 'string') data.seoKeywords = data.seoKeywords.split(',').map((t) => t.trim()).filter(Boolean);

  const updated = await Product.updateById(req.params.id, data);
  res.json(updated);
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  await Product.softDelete(req.params.id);
  res.json({ message: 'Product removed' });
};

exports.createReview = async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const userId = String(req.user._id);
  const reviews = product.reviews || [];
  if (reviews.find((r) => String(r.user) === userId))
    return res.status(400).json({ message: 'Already reviewed' });

  reviews.push({
    _id: Product.newReviewId(),
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
    createdAt: new Date().toISOString(),
  });

  const { rating: avg, numReviews } = Product.recomputeRating(reviews);
  await Product.updateById(req.params.id, { reviews, rating: avg, numReviews });
  res.status(201).json({ message: 'Review added' });
};

exports.getCategories = async (req, res) => {
  const [categories, brands] = await Promise.all([
    Product.distinct('category', { isActive: true }),
    Product.distinct('brand', { isActive: true }),
  ]);
  res.json({ categories, brands: brands.filter(Boolean) });
};

exports.getRelatedProducts = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const { products } = await Product.list({
    category: product.category,
    excludeId: product._id,
    isActive: true,
    limit: 8,
    sort: 'newest',
  });
  res.json(products);
};
