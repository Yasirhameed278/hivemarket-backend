const Anthropic = require('@anthropic-ai/sdk');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are ShopBot, a friendly AI shopping assistant for HiveMarket, an online e-commerce store.

You have tools to search products, track orders, manage carts, and give recommendations. Use them whenever the user's request requires real data.

Store policies (answer directly without tools):
- Shipping: Standard 3–7 business days, Express 1–2 days. Free shipping on orders over $100.
- Returns: 30-day window. Items must be unused in original packaging. Refunds in 5–7 business days.
- Payment: Visa, Mastercard, American Express, PayPal. 256-bit SSL secured.
- Coupons: SAVE10 (10% off), SAVE20 (20% off), FREESHIP (free shipping). Apply at checkout.

Guidelines:
- Be concise, warm, and helpful — keep responses brief
- Always use real data from tools — never invent product names or prices
- If a user is not logged in, politely let them know cart/order features require sign-in
- When listing products, include name and price
- Understand natural phrasing like "most popular", "highest clicks", "cheapest", "best rated", etc.`;

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_products',
    description:
      'Search the product catalog. Use for any product discovery: keywords, filters (price, category, rating, brand), or sorting (trending/popular, most viewed, price, rating).',
    input_schema: {
      type: 'object',
      properties: {
        keywords: { type: 'string' },
        category: { type: 'string' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
        minRating: { type: 'number' },
        brand: { type: 'string' },
        sort: {
          type: 'string',
          enum: ['trending', 'most_viewed', 'price_asc', 'price_desc', 'rating'],
        },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: "Personalised product recommendations based on user history, cart, or trending.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_order_status',
    description: "Get status of the user's most recent order or a specific order by order number.",
    input_schema: {
      type: 'object',
      properties: { orderNumber: { type: 'string' } },
    },
  },
  {
    name: 'view_cart',
    description: "View the user's current cart and total.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_to_cart',
    description: "Add a product to the user's cart by id or name.",
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        productName: { type: 'string' },
        quantity: { type: 'number' },
      },
    },
  },
  {
    name: 'remove_from_cart',
    description: "Remove a product from the user's cart by name.",
    input_schema: {
      type: 'object',
      properties: { productName: { type: 'string' } },
      required: ['productName'],
    },
  },
];

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function toolSearchProducts(input) {
  const { keywords, category, minPrice, maxPrice, minRating, brand, sort } = input;

  const sortMap = {
    most_viewed: 'most_viewed',
    price_asc: 'price_asc',
    price_desc: 'price_desc',
    rating: 'rating',
    trending: 'popular',
  };
  const sortKey = sortMap[sort] || 'popular';

  let { products } = await Product.list({
    keyword: keywords,
    category,
    brand,
    minPrice,
    maxPrice,
    rating: minRating,
    sort: sortKey,
    limit: 8,
  });

  if (products.length === 0) {
    products = (await Product.list({ category, brand, sort: sortKey, limit: 8 })).products;
  }

  return {
    count: products.length,
    products: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      price: Number(p.price.toFixed(2)),
      rating: p.rating,
      category: p.category,
      brand: p.brand,
      thumbnail: p.thumbnail,
      inStock: p.stock > 0,
      views: p.viewCount || 0,
      sold: p.soldCount || 0,
    })),
  };
}

async function getCopurchased(productIds) {
  if (!productIds?.length) return [];
  const itemsList = await Order.findItemsContaining(productIds, 30);
  const counts = {};
  const exclude = new Set(productIds.map(String));
  itemsList.forEach((items) => {
    (items || []).forEach((it) => {
      const id = String(it.product);
      if (!exclude.has(id)) counts[id] = (counts[id] || 0) + 1;
    });
  });
  const topIds = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([id]) => id);
  if (!topIds.length) return [];
  return Product.findManyByIds(topIds, 'id,name,price,thumbnail,rating,category,is_active').then((arr) =>
    arr.filter((p) => p.isActive)
  );
}

async function toolGetRecommendations(userId) {
  let products = [];
  let label = 'trending products';

  if (userId) {
    const orders = await Order.findByUser(userId, { limit: 10, page: 1 });
    if (orders.length > 0) {
      const purchasedIds = orders.flatMap((o) => o.items.map((i) => i.product));
      products = await getCopurchased(purchasedIds);
      if (products.length > 0) label = 'products customers like you also loved';
    }

    if (products.length === 0) {
      const user = await User.findById(userId);
      const cartIds = (user?.cart || []).map((i) => i.product).filter(Boolean);
      if (cartIds.length > 0) {
        products = await getCopurchased(cartIds);
        if (products.length > 0) label = 'customers also bought';
      }
    }
  }

  if (products.length === 0) {
    products = (await Product.list({ sort: 'popular', limit: 6 })).products;
    label = 'trending products';
  }

  return {
    label,
    count: products.length,
    products: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      price: Number(p.price.toFixed(2)),
      rating: p.rating,
      category: p.category,
      thumbnail: p.thumbnail,
    })),
  };
}

async function toolGetOrderStatus(input, userId) {
  if (!userId) return { error: 'User must be logged in to track orders.' };

  let order;
  if (input.orderNumber) {
    order = await Order.findOne({ userId, orderNumberLike: input.orderNumber });
  }
  if (!order) order = await Order.findOne({ userId });
  if (!order) return { error: 'No orders found on this account.' };

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    totalPrice: Number(order.totalPrice.toFixed(2)),
    trackingNumber: order.trackingNumber || null,
    estimatedDelivery: order.estimatedDelivery
      ? new Date(order.estimatedDelivery).toLocaleDateString()
      : null,
    trackingHistory: (order.trackingHistory || []).slice(-4).map((ev) => ({
      status: ev.status,
      description: ev.description,
      date: new Date(ev.timestamp).toLocaleDateString(),
    })),
  };
}

async function toolViewCart(userId) {
  if (!userId) return { error: 'User must be logged in to view cart.' };
  const user = await User.findById(userId);
  const cart = user?.cart || [];
  if (!cart.length) return { itemCount: 0, items: [], total: 0, message: 'Cart is empty.' };

  const products = await Product.findManyByIds(
    cart.map((i) => i.product),
    'id,name,price,thumbnail,is_active,stock'
  );
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const active = cart
    .map((i) => ({ ...i, product: byId.get(String(i.product)) }))
    .filter((i) => i.product?.isActive);

  if (!active.length) return { itemCount: 0, items: [], total: 0, message: 'Cart is empty.' };

  const total = active.reduce((s, i) => s + i.product.price * i.quantity, 0);
  return {
    itemCount: active.length,
    items: active.map((i) => ({
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      subtotal: Number((i.product.price * i.quantity).toFixed(2)),
    })),
    total: Number(total.toFixed(2)),
    freeShippingRemaining: total >= 100 ? 0 : Number((100 - total).toFixed(2)),
  };
}

async function toolAddToCart(input, userId) {
  if (!userId) return { error: 'User must be logged in to add to cart.', requiresAuth: true };

  let product;
  if (input.productId) {
    const p = await Product.findById(input.productId);
    if (p && p.isActive && p.stock > 0) product = p;
  }
  if (!product && input.productName) {
    const { products } = await Product.list({ keyword: input.productName, limit: 1 });
    product = products.find((p) => p.isActive && p.stock > 0) || products[0];
  }
  if (!product) return { error: `Could not find "${input.productName || input.productId}" in stock.` };

  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const user = await User.findById(userId);
  const cart = [...(user.cart || [])];
  const idx = cart.findIndex((i) => String(i.product) === String(product._id));
  if (idx >= 0) {
    cart[idx].quantity = Math.min(cart[idx].quantity + qty, product.stock);
  } else {
    cart.push({ _id: User.newCartItemId(), product: product._id, quantity: qty, variant: '' });
  }
  await User.updateById(userId, { cart });

  return { success: true, productName: product.name, price: product.price, quantityAdded: qty };
}

async function toolRemoveFromCart(input, userId) {
  if (!userId) return { error: 'User must be logged in to manage cart.', requiresAuth: true };

  const user = await User.findById(userId);
  const cart = [...(user.cart || [])];
  if (!cart.length) return { error: `"${input.productName}" not found in cart.` };

  const products = await Product.findManyByIds(cart.map((i) => i.product), 'id,name');
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const idx = cart.findIndex((i) => {
    const p = productById.get(String(i.product));
    return p?.name?.toLowerCase().includes(input.productName.toLowerCase());
  });
  if (idx === -1) return { error: `"${input.productName}" not found in cart.` };

  const removedName = productById.get(String(cart[idx].product))?.name;
  cart.splice(idx, 1);
  await User.updateById(userId, { cart });
  return { success: true, removedProduct: removedName };
}

async function executeTool(name, input, userId) {
  try {
    switch (name) {
      case 'search_products':     return await toolSearchProducts(input);
      case 'get_recommendations': return await toolGetRecommendations(userId);
      case 'get_order_status':    return await toolGetOrderStatus(input, userId);
      case 'view_cart':           return await toolViewCart(userId);
      case 'add_to_cart':         return await toolAddToCart(input, userId);
      case 'remove_from_cart':    return await toolRemoveFromCart(input, userId);
      default:                    return { error: 'Unknown tool' };
    }
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Main Chat Handler ─────────────────────────────────────────────────────────

exports.chat = async (req, res) => {
  const { message, history = [] } = req.body;
  const userId = req.user?._id;

  if (!message?.trim()) {
    return res.status(400).json({ reply: 'Please type a message.', suggestedProducts: [] });
  }

  const messages = [
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ];

  let suggestedProducts = [];
  let cartUpdated = false;

  try {
    while (true) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

      if (toolUseBlocks.length === 0) {
        const textBlock = response.content.find((b) => b.type === 'text');
        const reply = textBlock?.text?.trim() || "I'm sorry, I couldn't process that. Please try again.";
        return res.json({ reply, suggestedProducts, cartUpdated });
      }

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input, userId);

        if ((block.name === 'add_to_cart' || block.name === 'remove_from_cart') && result.success) {
          cartUpdated = true;
        }

        if (
          (block.name === 'search_products' || block.name === 'get_recommendations') &&
          result.products?.length
        ) {
          suggestedProducts = result.products.slice(0, 3).map((p) => ({
            _id: p.id,
            name: p.name,
            price: p.price,
            thumbnail: p.thumbnail,
            rating: p.rating,
            category: p.category,
          }));
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      reply: "I'm having a little trouble right now. Please try again in a moment!",
      suggestedProducts: [],
    });
  }
};

// ─── Quick Search (Autocomplete) ──────────────────────────────────────────────

exports.quickSearch = async (req, res) => {
  const { query } = req.query;
  if (!query || query.length < 2) return res.json([]);
  const { products } = await Product.list({
    keyword: query,
    limit: 6,
    sort: 'popular',
  });
  res.json(
    products.map((p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      thumbnail: p.thumbnail,
      category: p.category,
      rating: p.rating,
    }))
  );
};
