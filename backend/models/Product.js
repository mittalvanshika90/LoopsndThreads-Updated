import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  subcategory: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 1000 },
  image: { type: String, default: '' },
  tag: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Product', productSchema)
