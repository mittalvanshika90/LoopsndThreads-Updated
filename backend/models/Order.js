import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  // Only orders placed by an authenticated customer are linked to their account.
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
  orderNumber: { type: String, required: true, unique: true },
  customer: {
    name: String, phone: String, email: String, address: String, city: String, pincode: String,
    location: { latitude: Number, longitude: Number, accuracy: Number, mapsUrl: String },
  },
  items: [{ productId: String, name: String, price: Number, quantity: Number }],
  subtotal: Number,
  discount: Number,
  coupon: String,
  shipping: Number,
  total: Number,
  paymentReference: { type: String, default: '' },
  inventoryReserved: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  orderStatus: { type: String, enum: ['received', 'processing', 'shipped', 'completed', 'cancelled'], default: 'received' },
}, { timestamps: true })

export default mongoose.model('Order', orderSchema)
