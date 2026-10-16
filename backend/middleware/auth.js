import jwt from 'jsonwebtoken'
import Customer from '../models/Customer.js'

export async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Admin login required.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.role !== 'admin' || !payload.customerId) {
      return res.status(403).json({ message: 'Admin access required.' })
    }

    // Re-check MongoDB on every protected request so deleted/demoted accounts lose access.
    const admin = await Customer.findOne({ _id: payload.customerId, role: 'admin' })
      .select('_id email name')
      .lean()
    if (!admin) {
      return res.status(401).json({ message: 'Admin account no longer exists or no longer has admin access. Please sign in again.' })
    }

    req.admin = { ...payload, account: admin }
    return next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }
    return next(error)
  }
}
