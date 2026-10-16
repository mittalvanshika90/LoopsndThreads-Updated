import tulip from '../assets/tulip.jpg'
import pinkRoseStick from '../assets/pink rose stick.jpeg'
import pandaPhoto from '../assets/panda.jpeg'
import bunnyPhoto from '../assets/bunny.jpeg'
import roseBouquet from '../assets/rose bouquet.jpeg'

// PRODUCT CATALOGUE
// To add a product:
// 1. Put its photo in src/assets and import it above.
// 2. Add a product object below with a unique id, category, and optional subcategory.
// 3. Use category/subcategory names exactly as written in src/data/categories.js.
// Categories with no products will automatically show an empty-state message in the shop.
export const allProducts = [
  {
    id: 'tulip-stick',
    name: 'Tulip Stick',
    price: 149,
    category: 'Flowers',
    subcategory: 'Sticks',
    description: 'A cute handmade tulip that never fades.',
    image: tulip,
    tag: 'New',
  },
  {
    id: 'pink-rose-stick',
    name: 'Pink Rose Stick',
    price: 149,
    category: 'Flowers',
    subcategory: 'Sticks',
    description: 'A pretty pink crochet rose, handmade with love.',
    image: pinkRoseStick,
    tag: 'New',
  },
  {
    id: 'panda',
    name: 'Crochet Panda',
    price: 499,
    category: 'Amigurumi',
    description: 'A cute handmade panda for your little collection.',
    image: pandaPhoto,
    tag: 'Cute',
  },
  {
    id: 'bunny',
    name: 'Crochet Bunny',
    price: 699,
    category: 'Amigurumi',
    description: 'A soft, sweet crochet bunny made with care.',
    image: bunnyPhoto,
    tag: 'Popular',
  },
  {
    id: 'rose-bouquet',
    name: 'Rose Bouquet',
    price: 999,
    category: 'Flowers',
    subcategory: 'Bouquets',
    description: 'A beautiful handmade rose bouquet, perfect for gifting.',
    image: roseBouquet,
    tag: 'Special',
  },
]
