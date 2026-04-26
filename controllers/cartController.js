const User = require('../models/User');
const Product = require('../models/Product');

// Hydrate a cart array (each item: { _id, product: <id>, quantity, variant })
// with full product info, dropping inactive/missing products.
async function hydrateCart(cart) {
  if (!cart?.length) return [];
  const ids = cart.map((i) => i.product).filter(Boolean);
  const products = await Product.findManyByIds(ids, 'id,name,price,compare_price,thumbnail,stock,is_active');
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return cart
    .map((item) => {
      const p = byId.get(String(item.product));
      if (!p || !p.isActive) return null;
      return {
        _id: item._id,
        quantity: item.quantity,
        variant: item.variant || '',
        product: {
          _id: p._id,
          name: p.name,
          price: p.price,
          comparePrice: p.comparePrice,
          thumbnail: p.thumbnail,
          stock: p.stock,
          isActive: p.isActive,
        },
      };
    })
    .filter(Boolean);
}

exports.getCart = async (req, res) => {
  const user = await User.findById(req.user._id);
  const cart = await hydrateCart(user?.cart || []);
  res.json(cart);
};

exports.addToCart = async (req, res) => {
  const { productId, quantity = 1, variant = '' } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (product.stock < quantity) return res.status(400).json({ message: 'Insufficient stock' });

  const user = await User.findById(req.user._id);
  const cart = [...(user.cart || [])];
  const idx = cart.findIndex(
    (item) => String(item.product) === String(productId) && (item.variant || '') === (variant || '')
  );

  if (idx >= 0) {
    cart[idx].quantity = Math.min(cart[idx].quantity + Number(quantity), product.stock);
  } else {
    cart.push({
      _id: User.newCartItemId(),
      product: productId,
      quantity: Number(quantity),
      variant,
    });
  }

  await User.updateById(req.user._id, { cart });
  res.json(await hydrateCart(cart));
};

exports.updateCartItem = async (req, res) => {
  const { quantity } = req.body;
  const user = await User.findById(req.user._id);
  let cart = [...(user.cart || [])];
  const idx = cart.findIndex((i) => String(i._id) === String(req.params.itemId));
  if (idx === -1) return res.status(404).json({ message: 'Cart item not found' });

  if (Number(quantity) <= 0) {
    cart = cart.filter((i) => String(i._id) !== String(req.params.itemId));
  } else {
    cart[idx].quantity = Number(quantity);
  }

  await User.updateById(req.user._id, { cart });
  res.json(await hydrateCart(cart));
};

exports.removeFromCart = async (req, res) => {
  const user = await User.findById(req.user._id);
  const cart = (user.cart || []).filter((i) => String(i._id) !== String(req.params.itemId));
  await User.updateById(req.user._id, { cart });
  res.json(cart);
};

exports.clearCart = async (req, res) => {
  await User.updateById(req.user._id, { cart: [] });
  res.json([]);
};

// ─── Wishlist ────────────────────────────────────────────────────────
exports.getWishlist = async (req, res) => {
  const user = await User.findById(req.user._id);
  const ids = (user.wishlist || []).filter(Boolean);
  if (!ids.length) return res.json([]);
  const products = await Product.findManyByIds(ids, 'id,name,price,thumbnail,rating,category');
  res.json(products);
};

exports.toggleWishlist = async (req, res) => {
  const { productId } = req.body;
  const user = await User.findById(req.user._id);
  const wishlist = [...(user.wishlist || [])];
  const idx = wishlist.findIndex((id) => String(id) === String(productId));
  let added;
  if (idx >= 0) {
    wishlist.splice(idx, 1);
    added = false;
  } else {
    wishlist.push(productId);
    added = true;
  }
  await User.updateById(req.user._id, { wishlist });
  res.json({ wishlist, added });
};
