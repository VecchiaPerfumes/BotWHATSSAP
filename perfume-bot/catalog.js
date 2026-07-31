const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));

const CATEGORY_LABELS = {
  mas_vendidos: 'Más Vendidos',
  hombre: "Hombre",
  mujer: 'Mujer',
  unisex: 'Unisex',
  sets_regalo: 'Sets de Regalo',
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita acentos
}

// Palabras muy comunes en los nombres (tamaños, concentraciones, género)
// que no ayudan a diferenciar un perfume de otro.
const STOPWORDS = new Set([
  'edt', 'edp', 'ml', 'de', 'by', 'para', 'unisex', 'men', 'women', 'set',
  '100ml', '125ml', '200ml', '75ml', '80ml', '60ml', '65ml', '90ml', '95ml',
  '105ml', '110ml', '120ml', '130ml', '140ml', '150ml', '160ml', '170ml',
  '180ml', '190ml', '195ml', '210ml', '220ml', 'piece', 'piezas',
]);

// Quita duplicados por nombre (ej: un perfume que aparece tanto en
// "Más Vendidos" como en su categoría original), priorizando el disponible.
function dedupeByName(products) {
  const byName = new Map();
  for (const p of products) {
    const key = normalize(p.name);
    const existing = byName.get(key);
    if (!existing || (!existing.available && p.available)) {
      byName.set(key, p);
    }
  }
  return [...byName.values()];
}

// Busca por nombre o por notas olfativas (ej: "vainilla", "citrico")
function search(query, { onlyAvailable = false } = {}) {
  const q = normalize(query);
  const terms = q.split(/\s+/).filter((t) => t && !STOPWORDS.has(t));

  const pool = catalog.filter((p) => (onlyAvailable ? p.available : true));

  // 1) Coincidencia fuerte: el nombre del producto está contenido en la
  // consulta, o viceversa (ej. usuario escribe el nombre casi exacto).
  const strongMatches = pool.filter((p) => {
    const name = normalize(p.name);
    return (q.length >= 4 && name.includes(q)) || (name.length >= 4 && q.includes(name));
  });
  if (strongMatches.length > 0) {
    return dedupeByName(strongMatches).slice(0, 8);
  }

  // 2) Coincidencia por términos relevantes (ignora palabras genéricas)
  const scored = pool
    .map((p) => {
      const haystack = normalize(`${p.name} ${p.notes}`);
      let score = 0;
      for (const term of terms) {
        if (term.length < 3) continue;
        if (haystack.includes(term)) score += 1;
      }
      return { product: p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  // Si hay un ganador claro, devuelve solo ese (o los empatados con el máximo)
  const topScore = scored[0].score;
  const winners = scored.filter((r) => r.score === topScore).map((r) => r.product);
  if (winners.length <= 2) return dedupeByName(winners);

  return dedupeByName(scored.slice(0, 8).map((r) => r.product));
}

function getByCategory(categoryKey) {
  return catalog.filter((p) => p.category === categoryKey);
}

function getById(id) {
  return catalog.find((p) => p.id === id);
}

function getBestSellers() {
  return getByCategory('mas_vendidos');
}

function formatProduct(p) {
  const stock = p.available ? '✅ Disponible' : '❌ Agotado';
  const price = p.price_usd ? `$${p.price_usd}` : 'Consultar precio';
  return `*${p.name}*\n${p.notes}\n💵 ${price} | ${stock}`;
}

function listCategories() {
  return Object.entries(CATEGORY_LABELS)
    .map(([key, label], i) => `${i + 1}. ${label}`)
    .join('\n');
}

module.exports = {
  catalog,
  CATEGORY_LABELS,
  search,
  getByCategory,
  getById,
  getBestSellers,
  formatProduct,
  listCategories,
  normalize,
};
