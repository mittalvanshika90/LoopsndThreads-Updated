export function getCouponDiscount(code, subtotal) {
  if (code === 'CROCHET10' && subtotal > 999) {
    return Math.round(subtotal * 0.1 * 100) / 100
  }
  if (code === 'SAVE50' && subtotal >= 500) return 50
  return 0
}

export function getCouponMessage(code, subtotal) {
  if (code === 'CROCHET10') {
    return subtotal > 999
      ? '10% discount applied! 🎉'
      : `Add ₹${Math.max(0, 1000 - subtotal)} more to unlock 10% off.`
  }
  if (code === 'SAVE50') {
    return subtotal >= 500
      ? '₹50 discount applied! 🎉'
      : `Add ₹${500 - subtotal} more to unlock ₹50 off.`
  }
  return 'Invalid coupon code. Try CROCHET10 or SAVE50.'
}
