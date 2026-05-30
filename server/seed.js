require("dotenv").config();
const db = require("./db");

const categories = [
  { id: "skincare", name: "Skincare", image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80" },
  { id: "makeup", name: "Makeup", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80" },
  { id: "fragrance", name: "Fragrance", image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&q=80" },
  { id: "haircare", name: "Hair Care", image: "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600&q=80" },
];

const products = [
  { id: "p1", name: "Hydrating Face Serum", brand: "GlowLab", category_id: "skincare", price: 3200, stock: 24, image: "https://images.unsplash.com/photo-1620916566398-39f1144ab7be?w=500&q=80", featured: 1 },
  { id: "p2", name: "Vitamin C Brightening Cream", brand: "PureDerm", category_id: "skincare", price: 4500, stock: 18, image: "https://images.unsplash.com/photo-1570194842551-5b673a3c54ea?w=500&q=80", featured: 1 },
  { id: "p3", name: "Gentle Cleansing Foam", brand: "GlowLab", category_id: "skincare", price: 1800, stock: 42, image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80", featured: 0 },
  { id: "p4", name: "Matte Liquid Lipstick", brand: "Velvet Kiss", category_id: "makeup", price: 1500, stock: 35, image: "https://images.unsplash.com/photo-1586495777744-4413d210dadc?w=500&q=80", featured: 1 },
  { id: "p5", name: "Full Coverage Foundation", brand: "Velvet Kiss", category_id: "makeup", price: 3800, stock: 8, image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80", featured: 0 },
  { id: "p6", name: "Eyeshadow Palette — Sunset", brand: "Chroma", category_id: "makeup", price: 5200, stock: 12, image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=500&q=80", featured: 0 },
  { id: "p7", name: "Eau de Parfum — Rose Garden", brand: "Maison Lumière", category_id: "fragrance", price: 8900, stock: 6, image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&q=80", featured: 1 },
  { id: "p8", name: "Body Mist — Vanilla Bloom", brand: "Maison Lumière", category_id: "fragrance", price: 2400, stock: 28, image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&q=80", featured: 0 },
  { id: "p9", name: "Repair Hair Mask", brand: "SilkStrand", category_id: "haircare", price: 2900, stock: 3, image: "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=500&q=80", featured: 0 },
  { id: "p10", name: "Argan Oil Shampoo", brand: "SilkStrand", category_id: "haircare", price: 2100, stock: 0, image: "https://images.unsplash.com/photo-1535585209827-a0fcffc45700?w=500&q=80", featured: 0 },
  { id: "p11", name: "SPF 50 Sunscreen", brand: "PureDerm", category_id: "skincare", price: 2600, stock: 31, image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500&q=80", featured: 0 },
  { id: "p12", name: "Mascara — Volume Max", brand: "Chroma", category_id: "makeup", price: 1900, stock: 22, image: "https://images.unsplash.com/photo-1631214524020-7e18db9a5f92?w=500&q=80", featured: 0 },
];

const insertCategory = db.prepare(
  "INSERT OR REPLACE INTO categories (id, name, image) VALUES (@id, @name, @image)"
);
const insertProduct = db.prepare(
  `INSERT OR REPLACE INTO products (id, name, brand, category_id, price, stock, image, featured)
   VALUES (@id, @name, @brand, @category_id, @price, @stock, @image, @featured)`
);

const seed = db.transaction(() => {
  categories.forEach((c) => insertCategory.run(c));
  products.forEach((p) => insertProduct.run(p));
});

seed();
console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
