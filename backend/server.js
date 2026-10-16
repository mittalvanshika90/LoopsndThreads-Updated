import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import Product from './models/Product.js'
import Setting from './models/Setting.js'
import Order from './models/Order.js'
import Customer from './models/Customer.js'
import { requireAdmin } from './middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Always load the .env file from the backend folder.
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const PORT = Number(process.env.PORT) || 5000

// Support both the new and legacy MongoDB variable names.
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI
const JWT_SECRET = process.env.JWT_SECRET

app.use(cors({
  origin: true,
}))

app.use(express.json({ limit: '8mb' }))

app.use(
  '/seed-assets',
  express.static(path.join(__dirname, 'public/seed-assets')),
)

// Convert MongoDB product data into the format used by the frontend.
function productForClient(product, req) {
  const value =
    typeof product.toObject === 'function'
      ? product.toObject()
      : { ...product }

  const id = String(value._id || value.id || '')

  if (
    typeof value.image === 'string' &&
    value.image.startsWith('/seed-assets/')
  ) {
    const base = `${req.protocol}://${req.get('host')}`
    value.image = `${base}${value.image}`
  }

  return {
    ...value,
    id,
    inStock: Number(value.stock) > 0,
  }
}

// Initial products: inserted only when the product collection is empty.
const seedProducts = [
  {
    id: 'tulip-stick',
    name: 'Tulip Stick',
    price: 149,
    category: 'Flowers',
    subcategory: 'Sticks',
    description: 'A cute handmade tulip that never fades.',
    image: '/seed-assets/tulip.jpg',
    tag: 'New',
    stock: 10,
  },
  {
    id: 'pink-rose-stick',
    name: 'Pink Rose Stick',
    price: 149,
    category: 'Flowers',
    subcategory: 'Sticks',
    description: 'A pretty pink crochet rose, handmade with love.',
    image: '/seed-assets/pink-rose-stick.jpeg',
    tag: 'New',
    stock: 10,
  },
  {
    id: 'panda',
    name: 'Crochet Panda',
    price: 499,
    category: 'Amigurumi',
    subcategory: '',
    description: 'A cute handmade panda for your little collection.',
    image: '/seed-assets/panda.jpeg',
    tag: 'Cute',
    stock: 5,
  },
  {
    id: 'bunny',
    name: 'Crochet Bunny',
    price: 699,
    category: 'Amigurumi',
    subcategory: '',
    description: 'A soft, sweet crochet bunny made with care.',
    image: '/seed-assets/bunny.jpeg',
    tag: 'Popular',
    stock: 5,
  },
  {
    id: 'rose-bouquet',
    name: 'Rose Bouquet',
    price: 999,
    category: 'Flowers',
    subcategory: 'Bouquets',
    description: 'A beautiful handmade rose bouquet, perfect for gifting.',
    image: '/seed-assets/rose-bouquet.jpeg',
    tag: 'Special',
    stock: 5,
  },
]

async function seedDatabase() {
  if (await Product.countDocuments().then((count) => count === 0)) {
    await Product.insertMany(
      seedProducts.map(({ id, ...product }) => ({
        ...product,
        slug: id,
      })),
    )

    console.log('Seeded initial LoopsndThreads catalogue.')
  }

  await Setting.updateOne(
    { key: 'store' },
    {
      $setOnInsert: {
        value: {
          upiId: '',
          payeeName: 'LoopsndThreads',
          whatsappNumber: '919458262803',
        },
      },
    },
    { upsert: true },
  )
}

// Health check: reports whether Mongoose is connected.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
  })
})

// ---------------- CUSTOMER AUTHENTICATION ----------------

// Customer registration.
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        message: 'Name must be between 2 and 100 characters.',
      })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Enter a valid email address.',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long.',
      })
    }

    if (await Customer.exists({ email })) {
      return res.status(409).json({
        message:
          'An account with this email already exists. Please sign in.',
      })
    }

    const customer = await Customer.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    })

    const token = jwt.sign(
      {
        role: 'customer',
        customerId: String(customer._id),
        email,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    return res.status(201).json({
      token,
      customer: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        role: customer.role || 'customer',
      },
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          'An account with this email already exists. Please sign in.',
      })
    }

    next(error)
  }
})

// Customer login.
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    const customer = await Customer.findOne({ email }).select('+passwordHash')

    if (
      !customer ||
      !(await bcrypt.compare(password, customer.passwordHash))
    ) {
      return res.status(401).json({
        message: 'Incorrect email or password.',
      })
    }

    const token = jwt.sign(
      {
        role: customer.role || 'customer',
        customerId: String(customer._id),
        email,
      },
      JWT_SECRET,
      { expiresIn: customer.role === 'admin' ? '8h' : '7d' },
    )

    res.json({
      token,
      customer: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        role: customer.role || 'customer',
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get the currently logged-in customer.
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return res.status(401).json({ message: 'Please sign in.' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)

    if (!['customer', 'admin'].includes(payload.role) || !payload.customerId) {
      return res.status(403).json({ message: 'Account role is not permitted.' })
    }

    const customer = await Customer.findById(payload.customerId)
      .select('name email role')
      .lean()

    if (!customer) {
      return res.status(401).json({
        message: 'Your account no longer exists. Please sign in again.',
      })
    }

    const currentRole = customer.role || 'customer'
    if (currentRole !== payload.role) {
      return res.status(401).json({ message: 'Your account permissions changed. Please sign in again.' })
    }

    res.json({
      id: String(customer._id),
      name: customer.name,
      email: customer.email,
      role: currentRole,
    })
  } catch {
    res.status(401).json({
      message: 'Your session has expired. Please sign in again.',
    })
  }
})

// ---------------- SELLER / ADMIN AUTHENTICATION ----------------

app.post('/api/admin/login', async (req, res, next) => {
  try {
    // Admins are normal customer documents whose role was explicitly changed to "admin" in MongoDB.
    const email = String(req.body?.email || req.body?.username || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const account = await Customer.findOne({ email, role: 'admin' }).select('+passwordHash')
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return res.status(401).json({ message: 'Incorrect email/password, or this account is not an admin.' })
    }

    const token = jwt.sign(
      { role: 'admin', customerId: String(account._id), email: account.email },
      JWT_SECRET,
      { expiresIn: '8h' },
    )
    return res.json({ token, username: account.email, customer: { id: String(account._id), name: account.name, email: account.email, role: 'admin' } })
  } catch (error) {
    next(error)
  }
})

// ---------------- PUBLIC STORE APIs ----------------

// Get available products.
app.get('/api/products', async (req, res, next) => {
  try {
    const products = await Product.find({ active: true })
      .sort({ createdAt: -1 })
      .lean()

    res.json(products.map((product) => productForClient(product, req)))
  } catch (error) {
    next(error)
  }
})

// Get public store settings.
app.get('/api/settings/store', async (_req, res, next) => {
  try {
    const setting = await Setting.findOne({ key: 'store' }).lean()

    res.json(
      setting?.value || {
        upiId: '',
        payeeName: 'LoopsndThreads',
        whatsappNumber: '',
      },
    )
  } catch (error) {
    next(error)
  }
})

// All routes below this middleware require a valid admin token.
app.use('/api/admin', requireAdmin)

// ---------------- ADMIN PRODUCT MANAGEMENT ----------------

app.get('/api/admin/products', async (req, res, next) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean()

    res.json(products.map((product) => productForClient(product, req)))
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/products', async (req, res, next) => {
  try {
    const {
      name,
      price,
      category,
      subcategory,
      description,
      image,
      tag,
      stock,
    } = req.body || {}

    if (
      !name?.trim() ||
      !category?.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        message:
          'Name, category and a valid non-negative price are required.',
      })
    }

    if (
      stock === undefined ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      return res.status(400).json({
        message: 'Stock must be a whole number of zero or more.',
      })
    }

    const product = await Product.create({
      name: name.trim(),
      price: Number(price),
      category: category.trim(),
      subcategory: subcategory || '',
      description: description || '',
      image: image || '',
      tag: tag || '',
      stock: Number(stock),
    })

    res.status(201).json(productForClient(product, req))
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/products/:id', async (req, res, next) => {
  try {
    const allowed = [
      'name',
      'price',
      'category',
      'subcategory',
      'description',
      'image',
      'tag',
      'stock',
      'active',
    ]

    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) =>
        allowed.includes(key),
      ),
    )

    if (
      updates.price !== undefined &&
      (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)
    ) {
      return res.status(400).json({
        message: 'Price must be zero or more.',
      })
    }

    if (
      updates.stock !== undefined &&
      (!Number.isInteger(Number(updates.stock)) || Number(updates.stock) < 0)
    ) {
      return res.status(400).json({
        message: 'Stock must be a whole number of zero or more.',
      })
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    )

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    res.json(productForClient(product, req))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

// ---------------- UPI SETTINGS ----------------

app.put('/api/admin/settings/store', async (req, res, next) => {
  try {
    const upiId = String(req.body?.upiId || '').trim()
    const payeeName = String(
      req.body?.payeeName || 'LoopsndThreads',
    ).trim().slice(0, 80)
    const whatsappNumber = String(req.body?.whatsappNumber || '').replace(/\D/g, '').slice(0, 15)

    if (whatsappNumber && !/^\d{10,15}$/.test(whatsappNumber)) {
      return res.status(400).json({ message: 'Enter WhatsApp number with country code, e.g. 919876543210.' })
    }

    if (upiId && !/^[\w.-]{2,256}@[\w.-]{2,64}$/.test(upiId)) {
      return res.status(400).json({
        message: 'Enter a valid UPI ID, for example name@upi.',
      })
    }

    const setting = await Setting.findOneAndUpdate(
      { key: 'store' },
      { $set: { value: { upiId, payeeName, whatsappNumber } } },
      { upsert: true, new: true },
    )

    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

// ---------------- ADMIN ORDER MANAGEMENT ----------------

app.get('/api/admin/orders', async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    res.json(orders)
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/orders/:id', async (req, res, next) => {
  try {
    const updates = {}

    if (['pending', 'paid'].includes(req.body?.paymentStatus)) {
      updates.paymentStatus = req.body.paymentStatus
    }

    if (
      ['received', 'processing', 'shipped', 'completed', 'cancelled']
        .includes(req.body?.orderStatus)
    ) {
      updates.orderStatus = req.body.orderStatus
    }

    const current = await Order.findById(req.params.id)

    if (!current) {
      return res.status(404).json({ message: 'Order not found.' })
    }

    if (
      current.orderStatus === 'cancelled' &&
      updates.orderStatus &&
      updates.orderStatus !== 'cancelled'
    ) {
      return res.status(409).json({
        message:
          'Cancelled orders cannot be reopened. Create a new order instead.',
      })
    }

    if (
      updates.orderStatus === 'cancelled' &&
      current.orderStatus !== 'cancelled' &&
      current.inventoryReserved
    ) {
      await Promise.all(
        current.items.map((item) =>
          Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } },
          ),
        ),
      )

      current.inventoryReserved = false
    }

    Object.assign(current, updates)
    await current.save()

    res.json(current)
  } catch (error) {
    next(error)
  }
})

// ---------------- CUSTOMER ORDER CREATION ----------------

// Customer order history: only return orders belonging to the authenticated account.
app.get('/api/orders/mine', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Please sign in to view your order history.' })

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.role !== 'customer' || !payload.customerId) {
      return res.status(403).json({ message: 'A customer account is required to view order history.' })
    }

    const account = await Customer.findById(payload.customerId).select('role').lean()
    if (!account || (account.role || 'customer') !== 'customer') {
      return res.status(401).json({ message: 'Your customer session is no longer valid. Please sign in again.' })
    }

    const orders = await Order.find({ customerId: account._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return res.json(orders)
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
    console.error('Could not load customer order history:', error)
    return res.status(500).json({ message: 'Could not load your orders right now.' })
  }
})

app.post('/api/orders', async (req, res, next) => {
  const reserved = []
  let createdOrder
  let authenticatedCustomer = null

  try {
    // If the customer is signed in, bind the order to the account from the verified JWT.
    // Never accept a customerId supplied by the browser. Guest checkout remains supported.
    const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (authToken) {
      try {
        const payload = jwt.verify(authToken, JWT_SECRET)
        if (payload.role !== 'customer' || !payload.customerId) {
          return res.status(403).json({ message: 'Please sign in with a customer account to link this order to your history.' })
        }
        authenticatedCustomer = await Customer.findById(payload.customerId).select('name email role')
        if (!authenticatedCustomer || (authenticatedCustomer.role || 'customer') !== 'customer') {
          return res.status(401).json({ message: 'Your customer session is no longer valid. Please sign in again.' })
        }
      } catch (authError) {
        if (authError.name === 'JsonWebTokenError' || authError.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Your session expired. Please sign in again, or sign out and place the order as a guest.' })
        }
        throw authError
      }
    }

    const {
      customer,
      items,
      coupon = '',
      shipping = 0,
      paymentReference = '',
    } = req.body || {}

    if (
      !customer?.name?.trim() ||
      !/^\d{10,15}$/.test(String(customer?.phone || '')) ||
      !customer?.address?.trim() ||
      !customer?.city?.trim() ||
      !/^\d{6}$/.test(String(customer?.pincode || '')) ||
      !Array.isArray(items) ||
      !items.length ||
      items.length > 50
    ) {
      return res.status(400).json({
        message:
          'Valid customer details and 1–50 order items are required.',
      })
    }

    if (![0, 99].includes(Number(shipping))) {
      return res.status(400).json({
        message: 'Invalid shipping amount.',
      })
    }

    // Recalculate prices and totals from the database.
    const normalizedItems = []
    let subtotal = 0

    for (const item of items) {
      const productId = String(item.id || item.productId || '')
      const quantity = Number(item.quantity)

      if (
        !mongoose.isValidObjectId(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        throw Object.assign(
          new Error(
            'An item in your cart is invalid. Please refresh the store and try again.',
          ),
          { status: 400 },
        )
      }

      const product = await Product.findOne({
        _id: productId,
        active: true,
      }).lean()

      if (!product) {
        throw Object.assign(
          new Error('A product in your cart is no longer available.'),
          { status: 409 },
        )
      }

      if (Number(product.stock) < quantity) {
        throw Object.assign(
          new Error(
            `${product.name} does not have enough stock. Please update your cart.`,
          ),
          { status: 409 },
        )
      }

      subtotal += Number(product.price) * quantity

      normalizedItems.push({
        productId,
        name: product.name,
        price: Number(product.price),
        quantity,
      })
    }

    let discount = 0
    const normalizedCoupon = String(coupon || '').trim().toUpperCase()

    if (normalizedCoupon === 'CROCHET10' && subtotal > 999) {
      discount = Math.round(subtotal * 0.1 * 100) / 100
    } else if (normalizedCoupon === 'SAVE50' && subtotal >= 500) {
      discount = 50
    }

    const total = Math.max(
      0,
      subtotal - discount + Number(shipping),
    )

    // Reserve stock only if sufficient quantity remains.
    for (const item of normalizedItems) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          active: true,
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { new: true },
      )

      if (!updated) {
        throw Object.assign(
          new Error(
            `${item.name} just went out of stock. Please review your cart.`,
          ),
          { status: 409 },
        )
      }

      reserved.push(item)
    }

    createdOrder = await Order.create({
      customerId: authenticatedCustomer?._id,
      orderNumber:
        `LT-${Date.now().toString().slice(-7)}-${randomUUID()
          .slice(0, 4)
          .toUpperCase()}`,

      customer: {
        name: String(customer.name).trim().slice(0, 120),
        phone: String(customer.phone).trim(),
        email: String(authenticatedCustomer?.email || customer.email || '').trim().slice(0, 160),
        address: String(customer.address).trim().slice(0, 500),
        city: String(customer.city).trim().slice(0, 100),
        pincode: String(customer.pincode).trim(),
        location: customer.location && Number.isFinite(Number(customer.location.latitude)) && Number.isFinite(Number(customer.location.longitude))
          ? {
              latitude: Number(customer.location.latitude),
              longitude: Number(customer.location.longitude),
              accuracy: Number.isFinite(Number(customer.location.accuracy)) ? Number(customer.location.accuracy) : undefined,
              mapsUrl: `https://maps.google.com/?q=${Number(customer.location.latitude)},${Number(customer.location.longitude)}`,
            }
          : undefined,
      },

      items: normalizedItems,
      subtotal,
      discount,
      coupon: discount > 0 ? normalizedCoupon : '',
      shipping: Number(shipping),
      total,
      paymentReference: String(paymentReference || '')
        .trim()
        .slice(0, 120),
      inventoryReserved: true,
    })

    res.status(201).json({
      id: createdOrder._id,
      orderNumber: createdOrder.orderNumber,
      orderStatus: createdOrder.orderStatus,
      paymentStatus: createdOrder.paymentStatus,
      customerHistoryLinked: Boolean(createdOrder.customerId),
      subtotal,
      discount,
      shipping: Number(shipping),
      total,
    })
  } catch (error) {
    // Restore reserved stock if order creation fails.
    if (!createdOrder && reserved.length) {
      await Promise.allSettled(
        reserved.map((item) =>
          Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } },
          ),
        ),
      )
    }

    next(error)
  }
})

// ---------------- ERROR HANDLING ----------------

app.use((error, _req, res, _next) => {
  console.error('API error:', error)

  if (res.headersSent) return

  res.status(error.status || 500).json({
    message: error.message || 'Unexpected server error.',
  })
})

// ---------------- STARTUP VALIDATION ----------------

if (!MONGODB_URI) {
  console.error(
    '❌ Missing MONGODB_URI. Add it to backend/.env.',
  )
  process.exit(1)
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    '❌ JWT_SECRET must be a random string of at least 32 characters.',
  )
  process.exit(1)
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('❌ PORT must be a valid port number.')
  process.exit(1)
}

// ---------------- DATABASE CONNECTION AND SERVER START ----------------

async function startServer() {
  try {
    console.log('Connecting to MongoDB...')

    const connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })

    console.log(
      `✅ MongoDB connected successfully: ${connection.connection.host}/${connection.connection.name}`,
    )

    await seedDatabase()

    app.listen(PORT, () => {
      console.log(`🚀 LoopsndThreads API listening on port ${PORT}`)
      console.log(
        `Health check: http://localhost:${PORT}/api/health`,
      )
    })
  } catch (error) {
    console.error(
      '❌ MongoDB connection/startup failed:',
      error.message,
    )
    process.exit(1)
  }
}

startServer()