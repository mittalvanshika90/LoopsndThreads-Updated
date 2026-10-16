import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true })

// Explicitly select the hash only when authenticating.
customerSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; return ret } })
export default mongoose.model('Customer', customerSchema)
