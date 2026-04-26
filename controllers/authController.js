const crypto = require('crypto');
const { getClient, getAnonClient } = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');

// Build the response shape the frontend expects: { token, user }.
// `token` is the Supabase access token (JWT) — the existing axios interceptor
// already sends it as `Authorization: Bearer <token>`.
const sessionResponse = (session, user) => ({
  token: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at,
  user,
});

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const admin = getClient();

  // Create the auth user with email confirmed (no email-verification flow).
  // The on-auth.users trigger will auto-create the profile row in `users`.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr) {
    if (/already (registered|exists)/i.test(createErr.message))
      return res.status(400).json({ message: 'Email already registered' });
    return res.status(400).json({ message: createErr.message });
  }

  // Trigger should have created the profile. Make sure name is set (some auth
  // events race the trigger / pre-existing rows can lack it).
  await User.ensureProfile({ id: created.user.id, name, email: created.user.email });

  // Sign the new user in to get a session/token to return.
  const anon = getAnonClient();
  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (signErr) return res.status(500).json({ message: signErr.message });

  const profile = await User.findById(created.user.id);
  res.status(201).json(sessionResponse(signed.session, profile));
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const anon = getAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error || !data?.session) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Look up (or backfill) the profile row.
  let profile = await User.findById(data.user.id);
  if (!profile) {
    profile = await User.ensureProfile({
      id: data.user.id,
      name: data.user.user_metadata?.name || data.user.email.split('@')[0],
      email: data.user.email,
    });
  }
  if (!profile.isActive) return res.status(401).json({ message: 'Account deactivated' });

  await User.updateById(profile._id, { lastLogin: new Date().toISOString() });
  res.json(sessionResponse(data.session, profile));
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken required' });
  const anon = getAnonClient();
  const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) return res.status(401).json({ message: 'Refresh token invalid' });
  const profile = await User.findById(data.user.id);
  res.json(sessionResponse(data.session, profile));
};

exports.logout = async (req, res) => {
  // With JWTs this is mostly a frontend concern (drop the token).
  // We could call admin.auth.admin.signOut(userId) to revoke all sessions,
  // but that's heavy-handed for typical "click logout" UX.
  res.json({ message: 'Logged out' });
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const wishlistIds = (user.wishlist || []).filter(Boolean);
  if (wishlistIds.length) {
    const products = await Product.findManyByIds(wishlistIds, 'id,name,price,thumbnail,rating');
    user.wishlist = products;
  } else {
    user.wishlist = [];
  }
  res.json(user);
};

exports.updateProfile = async (req, res) => {
  const { name, phone, avatar } = req.body;
  const patch = {};
  if (name) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (avatar !== undefined) patch.avatar = avatar;
  const user = await User.updateById(req.user._id, patch);
  res.json(user);
};

exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters' });

  // Verify the current password by attempting a sign-in. Cheap and bulletproof.
  const anon = getAnonClient();
  const { error: signErr } = await anon.auth.signInWithPassword({
    email: req.user.email,
    password: currentPassword,
  });
  if (signErr) return res.status(401).json({ message: 'Current password incorrect' });

  const admin = getClient();
  const { error } = await admin.auth.admin.updateUserById(req.user._id, { password: newPassword });
  if (error) return res.status(400).json({ message: error.message });
  res.json({ message: 'Password updated successfully' });
};

exports.addAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  const addresses = [...(user.addresses || [])];
  if (req.body.isDefault) addresses.forEach((a) => (a.isDefault = false));
  addresses.push({ _id: crypto.randomUUID(), ...req.body });
  const updated = await User.updateById(req.user._id, { addresses });
  res.json(updated.addresses);
};

exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  const addresses = (user.addresses || []).filter((a) => String(a._id) !== String(req.params.id));
  const updated = await User.updateById(req.user._id, { addresses });
  res.json(updated.addresses);
};
