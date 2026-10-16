import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'loopsndthreads-cart-v1'

function readSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(
      (item) => item && typeof item.id === 'string' &&
        Number.isFinite(item.price) && item.price >= 0 &&
        Number.isInteger(item.quantity) && item.quantity > 0 &&
        typeof item.name === 'string'
    )
  } catch {
    return []
  }
}

export default function useCart() {
  const [cart, setCart] = useState(readSavedCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // The cart still works for the current session if storage is unavailable.
    }
  }, [cart])

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) => item.id === product.id
          ? { ...item, stock: product.stock ?? item.stock, quantity: Math.min(Number(product.stock ?? Infinity), item.quantity + 1) }
          : item)
      }
      return [...current, { ...product, quantity: 1 }]
    })
  }

  const increaseQuantity = (id) => {
    setCart((current) => current.map((item) => {
      if (item.id !== id) return item
      const stockLimit = Number.isFinite(Number(item.stock)) ? Number(item.stock) : Infinity
      return { ...item, quantity: Math.min(stockLimit, item.quantity + 1) }
    }))
  }

  const decreaseQuantity = (id) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
      .filter((item) => item.quantity > 0))
  }

  const removeFromCart = (id) => {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const clearCart = () => setCart([])
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])

  return { cart, addToCart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, cartCount, subtotal }
}
