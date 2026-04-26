// Supabase seed script. Wipes users/products/orders and re-creates a sample dataset.
// Usage: from backend/, `npm run seed`.
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { getClient } = require('../config/db');

connectDB();

const sampleProducts = [
  {
    name: 'Premium Wireless Headphones',
    description: 'Experience crystal-clear audio with our Premium Wireless Headphones. Featuring active noise cancellation, 30-hour battery life, and ultra-comfortable ear cushions. Perfect for music lovers, professionals, and gamers alike.',
    shortDescription: 'ANC wireless headphones with 30hr battery',
    price: 149.99, comparePrice: 199.99, category: 'Electronics', brand: 'SoundMax',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    stock: 45, rating: 4.5, numReviews: 128, isFeatured: true, soldCount: 320,
    tags: ['headphones', 'wireless', 'audio', 'ANC'],
    seoTitle: 'Premium Wireless Headphones with ANC | SoundMax',
    seoDescription: 'Buy SoundMax Premium Wireless Headphones with Active Noise Cancellation. 30-hour battery, premium sound quality.',
    seoKeywords: ['wireless headphones', 'ANC headphones', 'SoundMax headphones'],
  },
  {
    name: 'Smart Fitness Watch Pro',
    description: 'Track your health and fitness goals with the Smart Fitness Watch Pro. Features include heart rate monitoring, GPS tracking, sleep analysis, blood oxygen measurement, and 100+ workout modes. Water-resistant up to 50 meters.',
    shortDescription: 'Advanced fitness tracker with GPS & health monitoring',
    price: 89.99, comparePrice: 129.99, category: 'Electronics', brand: 'FitTech',
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    stock: 78, rating: 4.3, numReviews: 95, isFeatured: true, soldCount: 215,
    tags: ['smartwatch', 'fitness', 'GPS', 'health'],
    seoTitle: 'Smart Fitness Watch Pro | FitTech',
    seoDescription: 'Track your health with FitTech Smart Fitness Watch Pro.',
  },
  {
    name: 'Minimalist Leather Wallet',
    description: 'Slim, elegant, and functional. Our minimalist leather wallet is crafted from genuine full-grain leather that ages beautifully. RFID blocking technology protects your cards from unauthorized scanning. Holds up to 8 cards plus cash.',
    shortDescription: 'Slim RFID-blocking genuine leather wallet',
    price: 34.99, comparePrice: 49.99, category: 'Accessories', brand: 'LeatherCo',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500',
    stock: 120, rating: 4.7, numReviews: 203, isFeatured: false, soldCount: 450,
    tags: ['wallet', 'leather', 'RFID', 'minimalist'],
  },
  {
    name: 'Portable Bluetooth Speaker',
    description: 'Take your music anywhere with our Portable Bluetooth Speaker. 360° surround sound, IPX7 waterproof rating, 24-hour playtime, and a rugged design that handles any adventure. Connect two speakers for true stereo sound.',
    shortDescription: '360° waterproof speaker with 24hr battery',
    price: 59.99, comparePrice: 79.99, category: 'Electronics', brand: 'SoundMax',
    images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500',
    stock: 60, rating: 4.4, numReviews: 87, isFeatured: true, soldCount: 180,
    tags: ['speaker', 'bluetooth', 'waterproof', 'portable'],
  },
  {
    name: 'Organic Cotton T-Shirt',
    description: 'Made from 100% GOTS-certified organic cotton, this classic t-shirt is soft, breathable, and eco-friendly. Available in 12 colors and sizes XS-3XL. Machine washable and pre-shrunk for lasting comfort.',
    shortDescription: '100% organic cotton, available in 12 colors',
    price: 24.99, comparePrice: 34.99, category: 'Clothing', brand: 'EcoWear',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
    stock: 200, rating: 4.6, numReviews: 312, isFeatured: false, soldCount: 680,
    tags: ['t-shirt', 'organic', 'cotton', 'clothing'],
    variants: [
      { label: 'Size', options: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { label: 'Color', options: ['White', 'Black', 'Navy', 'Gray', 'Red'] },
    ],
  },
  {
    name: 'Stainless Steel Water Bottle',
    description: 'Stay hydrated in style with our double-wall vacuum insulated water bottle. Keeps drinks cold for 24 hours and hot for 12 hours. BPA-free, leak-proof lid, and dishwasher safe.',
    shortDescription: 'Vacuum insulated, keeps cold 24hrs / hot 12hrs',
    price: 27.99, comparePrice: 39.99, category: 'Sports', brand: 'HydroMax',
    images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
    stock: 150, rating: 4.8, numReviews: 445, isFeatured: true, soldCount: 890,
    tags: ['water bottle', 'stainless steel', 'insulated', 'hydration'],
  },
  {
    name: 'Professional Running Shoes',
    description: 'Engineered for performance and comfort, these professional running shoes feature responsive cushioning, breathable mesh upper, and a durable rubber outsole.',
    shortDescription: 'Responsive cushioning for road & trail running',
    price: 119.99, comparePrice: 159.99, category: 'Sports', brand: 'RunPro',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    stock: 85, rating: 4.5, numReviews: 167, isFeatured: true, soldCount: 290,
    tags: ['shoes', 'running', 'sports', 'footwear'],
    variants: [
      { label: 'Size', options: ['6', '7', '8', '9', '10', '11', '12'] },
      { label: 'Color', options: ['Black/White', 'Blue/Gray', 'Red/Black'] },
    ],
  },
  {
    name: 'Ceramic Coffee Mug Set',
    description: 'Start your morning right with our artisan ceramic coffee mug set. Each set includes 4 handcrafted mugs with a beautiful reactive glaze finish.',
    shortDescription: 'Set of 4 handcrafted ceramic mugs, 12oz',
    price: 39.99, comparePrice: 54.99, category: 'Home', brand: 'ArtisanHome',
    images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500',
    stock: 95, rating: 4.6, numReviews: 78, isFeatured: false, soldCount: 155,
    tags: ['mug', 'ceramic', 'coffee', 'kitchen'],
  },
  {
    name: 'Mechanical Gaming Keyboard',
    description: 'Dominate every game with our Mechanical Gaming Keyboard. RGB per-key backlighting, tactile blue switches, anti-ghosting technology, and an aluminum frame.',
    shortDescription: 'RGB mechanical keyboard with blue switches',
    price: 89.99, comparePrice: 119.99, category: 'Electronics', brand: 'GameTech',
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
    stock: 40, rating: 4.4, numReviews: 93, isFeatured: false, soldCount: 120,
    tags: ['keyboard', 'mechanical', 'gaming', 'RGB'],
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Elevate your yoga practice with our Premium Yoga Mat. Made from natural tree rubber with microfiber suede top layer for superior grip.',
    shortDescription: 'Natural rubber yoga mat with suede grip surface',
    price: 64.99, comparePrice: 89.99, category: 'Sports', brand: 'ZenFit',
    images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
    stock: 70, rating: 4.7, numReviews: 134, isFeatured: false, soldCount: 240,
    tags: ['yoga mat', 'yoga', 'fitness', 'exercise'],
    variants: [{ label: 'Color', options: ['Purple', 'Blue', 'Green', 'Black', 'Pink'] }],
  },
  {
    name: 'Desk Lamp LED Smart',
    description: 'Illuminate your workspace intelligently with our LED Smart Desk Lamp. Touch-sensitive controls, 5 color temperatures, 10 brightness levels, USB-A charging port.',
    shortDescription: 'Smart LED lamp with touch control & USB charging',
    price: 44.99, comparePrice: 64.99, category: 'Home', brand: 'BrightSpace',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
    stock: 55, rating: 4.3, numReviews: 61, isFeatured: false, soldCount: 98,
    tags: ['lamp', 'LED', 'desk', 'smart'],
  },
  {
    name: 'Backpack Urban Explorer',
    description: 'The perfect companion for work, school, and travel. Dedicated 15.6" laptop compartment, USB charging port, anti-theft hidden pocket, water-resistant nylon.',
    shortDescription: 'Anti-theft backpack with laptop compartment & USB',
    price: 74.99, comparePrice: 99.99, category: 'Accessories', brand: 'TravelPro',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'],
    thumbnail: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
    stock: 65, rating: 4.5, numReviews: 118, isFeatured: true, soldCount: 203,
    tags: ['backpack', 'laptop bag', 'travel', 'anti-theft'],
    variants: [{ label: 'Color', options: ['Black', 'Navy', 'Olive', 'Gray'] }],
  },
];

// Create or fetch a Supabase Auth user, then return the matching profile row.
const upsertAuthUser = async ({ name, email, password, role = 'user' }) => {
  const sb = getClient();
  const lower = email.toLowerCase().trim();

  // Look up by email first (idempotent re-seeding).
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let authUser = list?.users?.find((u) => u.email?.toLowerCase() === lower);

  if (!authUser) {
    const { data, error } = await sb.auth.admin.createUser({
      email: lower,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    // Reset password so the documented credentials always work.
    await sb.auth.admin.updateUserById(authUser.id, { password });
  }

  return User.ensureProfile({ id: authUser.id, name, email: lower, role });
};

const seedDB = async () => {
  try {
    const sb = getClient();

    console.log('Clearing existing orders + products…');
    await sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await sb.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Note: we do NOT delete users / auth.users on every seed — wiping auth
    // users is destructive. Re-seeding just upserts auth records by email.

    const admin = await upsertAuthUser({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@shop.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin',
    });

    const sampleUsers = [
      { name: 'Yasir Hameed', email: 'yasir@example.com', password: 'password123' },
      { name: 'Tayyab Gill',  email: 'tayyab@example.com', password: 'password123' },
      { name: 'Ali Ahmed',    email: 'ali@example.com',    password: 'password123' },
    ];
    const users = [];
    for (const u of sampleUsers) users.push(await upsertAuthUser(u));

    const products = [];
    for (const p of sampleProducts) products.push(await Product.create(p));
    console.log(`Created ${products.length} products`);

    await Order.create({
      user: users[0]._id,
      items: [{
        product: products[0]._id, name: products[0].name, image: products[0].thumbnail,
        price: products[0].price, quantity: 1, variant: '',
      }],
      shippingAddress: { name: 'Yasir Hameed', street: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', country: 'US', phone: '555-0101' },
      itemsPrice: products[0].price, shippingPrice: 0, taxPrice: 12, totalPrice: products[0].price + 12,
      isPaid: true, paidAt: new Date().toISOString(), status: 'delivered',
      isDelivered: true, deliveredAt: new Date().toISOString(),
      trackingNumber: 'TRK-001234',
      trackingHistory: [
        { status: 'confirmed', description: 'Order placed', timestamp: new Date(Date.now() - 7 * 86400000).toISOString() },
        { status: 'processing', description: 'Order being prepared', timestamp: new Date(Date.now() - 6 * 86400000).toISOString() },
        { status: 'shipped', description: 'Order shipped via FedEx', timestamp: new Date(Date.now() - 4 * 86400000).toISOString() },
        { status: 'delivered', description: 'Delivered to front door', timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
      ],
    });

    await Order.create({
      user: users[1]._id,
      items: [
        { product: products[4]._id, name: products[4].name, image: products[4].thumbnail, price: products[4].price, quantity: 2, variant: '' },
        { product: products[5]._id, name: products[5].name, image: products[5].thumbnail, price: products[5].price, quantity: 1, variant: '' },
      ],
      shippingAddress: { name: 'Tayyab Gill', street: '456 Oak Ave', city: 'Chicago', state: 'IL', zipCode: '60601', country: 'US', phone: '555-0202' },
      itemsPrice: products[4].price * 2 + products[5].price, shippingPrice: 0, taxPrice: 6.8,
      totalPrice: products[4].price * 2 + products[5].price + 6.8,
      isPaid: true, paidAt: new Date().toISOString(), status: 'shipped',
      trackingNumber: 'TRK-002345',
      trackingHistory: [
        { status: 'confirmed', description: 'Order confirmed', timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
        { status: 'shipped', description: 'Shipped via UPS', timestamp: new Date(Date.now() - 86400000).toISOString() },
      ],
    });

    console.log('\n✅ Database seeded successfully!');
    console.log(`\nAdmin Login:\n  Email: ${admin.email}\n  Password: ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
    console.log(`\nTest User Login:\n  Email: yasir@example.com\n  Password: password123`);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDB();
