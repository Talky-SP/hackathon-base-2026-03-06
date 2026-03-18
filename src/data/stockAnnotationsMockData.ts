// Mock data for Stock Annotations — modeled after the real Stock API responses

export type IngredientGoldenStatus = 'covered' | 'partial' | 'new';

// Matches GET /get-ingredient-details → stock_history[] entry
export interface StockHistoryEntry {
  stock_entry_id: string;
  timestamp: string;
  entry_type: string;
  delivery_note_doc_id: string;
  delivery_note_number: string;
  delivery_note_category_date: string;
  provider_cif: string;
  excluded_from_current_stock?: boolean;

  raw_product_data: {
    product_name: string;
    billed_quantity: string;
    billed_unit: string | null;
    listed_unit_price: string;
    line_total_price_before_discount: string;
    discounts: unknown[];
    extra_costs: unknown[];
    [key: string]: unknown;
  };

  initial_interpretation: {
    product_type: string;
    category: string;
    confidence_level: string;
    final_price_of_line: string;
    [key: string]: unknown;
  };

  calculated_stock_values: {
    quantity_added: string;
    unit_of_measure_stock: string;
    cost_per_stock_unit: string;
    total_cost_entry: string;
  };

  normalized?: {
    entry_type: string;
    kind: 'in' | 'out' | 'set';
    signed_quantity: number;
    unit: string;
    pricePerUnit: number;
    totalCost: number;
    excluded_from_current_stock: boolean;
  };

  // For golden annotation tracking (not from API, added by frontend)
  inGolden: boolean;
  datasetIds: string[];
  [key: string]: unknown;
}

// Price alert from backend (includePriceMonitoring=true)
export interface PriceAlert {
  hasAlert: boolean;
  alertType: 'price_increase' | 'price_decrease' | 'price_spike' | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  changePercent: number;
  alertDate: string | null;
}

// Legacy price stats (fallback)
export interface PriceStats {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  totalPriceChanges: number;
  variationPercent: number; // ((max-min)/min)*100
}

// Matches GET /get-ingredients list item
export interface StockIngredient {
  ingredientId: string;
  ingredientName: string;
  originalProductIdOCR: string;
  category: string;
  subCategory: string;
  currentStock: {
    quantity: number;
    unit: string;
    lastUpdated: string;
    orderCount: number;
  };
  currentMeasurementFormat: {
    type: 'PACK' | 'DIRECT';
    unit_of_measure: string;
  };
  latestCost: string;
  priceAlert: PriceAlert;
  priceStats: PriceStats;
  // Derived / annotation-tracking fields
  status: IngredientGoldenStatus;
  totalStockEntries: number;
  goldenStockEntries: number;
  suppliers: string[];
  stockHistory: StockHistoryEntry[];
  // Detail data (loaded on demand from get-ingredient-details)
  packVariants?: PackVariant[];
  escandalloSchema?: EscandalloSchema;
}

export interface PackVariant {
  variant_id: string;
  product_type: string;
  usable: boolean;
  confidence: number;
  pack_unit: string;
  label: string;
  explanation: string;
  pack_view: {
    units_per_pack: number | null;
    pack_unit: string;
    packs: number | null;
    price_per_pack: number | null;
  };
  unit_view: {
    unit_price: number;
    uom: string;
    quantity: number;
  };
}

export interface EscandalloSchema {
  version: string;
  recipe_base_uom: string;
  recipe_unit_price: number;
  purchasing_unit: string;
  purchasing_unit_size_base: number;
  subunit: string | null;
  subunit_size_base: number | null;
  subunits_per_purchasing_unit: number | null;
  derived_prices: {
    per_recipe_base: number;
    per_subunit: number | null;
    per_purchasing_unit: number;
  };
}

export interface OcrBBox {
  Left: string;
  Top: string;
  Height: string;
  Width: string;
}

export interface StockDocument {
  locationId: string;
  categoryDate: string;
  supplierName: string;
  supplierCif: string;
  deliveryNoteNumber: string;
  date: string;
  totalProducts: number;
  goldenProducts: number;
  coveragePercent: number;
  ingredients: {
    ingredientId: string;
    ingredientName: string;
    inGolden: boolean;
  }[];
}

export interface StockAnnotationsSummary {
  total: number;
  covered: number;
  partial: number;
  new: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { name: 'DISTRIBUCIONES SUR S.L.', cif: 'B41234567' },
  { name: 'ACEITES DEL CAMPO', cif: 'A28765432' },
  { name: 'FRUTAS GARCIA', cif: 'B91234567' },
  { name: 'CARNICAS MARTINEZ', cif: 'B29876543' },
  { name: 'PESCADOS NORTE S.A.', cif: 'A33456789' },
];

// Seeded pseudo-random to keep data stable across renders
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function generateStockHistory(
  productName: string,
  count: number,
  goldenCount: number,
  unit: string,
  basePrice: number,
  productType: 'PACK' | 'DIRECT',
  category: string,
  packDetails: { subunits: string; uom: string; measure: string; contentPerPack: string } | null,
  addDuplicate?: number, // index to duplicate (same delivery_note_number + date)
): StockHistoryEntry[] {
  const entries: StockHistoryEntry[] = [];

  for (let i = 0; i < count; i++) {
    const supplier = SUPPLIERS[i % SUPPLIERS.length];
    const month = String(Math.floor(i / 3) + 1).padStart(2, '0');
    const day = String((i % 28) + 1).padStart(2, '0');
    const priceVariation = basePrice * (0.85 + seededRandom() * 0.3);
    const qty = Math.floor(seededRandom() * 15) + 1;
    const isGolden = i < goldenCount;

    // If this is a duplicate entry, reuse same delivery note number + date
    const isDuplicate = addDuplicate !== undefined && i === addDuplicate + 1 && addDuplicate < count - 1;
    const refEntry = isDuplicate ? entries[addDuplicate] : null;

    const noteNumber = isDuplicate && refEntry
      ? refEntry.delivery_note_number
      : `ALB-2026-${String(i * 7 + 42).padStart(4, '0')}`;
    const noteDate = isDuplicate && refEntry
      ? refEntry.timestamp.substring(0, 10)
      : `2026-${month}-${day}`;
    const docId = isDuplicate && refEntry
      ? refEntry.delivery_note_doc_id
      : `doc-${String(1000 + i)}`;

    const billedQtyStr = String(qty);
    const totalLine = priceVariation * qty;
    const packQty = packDetails ? qty * parseFloat(packDetails.contentPerPack) : qty;

    entries.push({
      stock_entry_id: `se-${productName.substring(0, 3).toLowerCase()}-${String(i + 1).padStart(3, '0')}`,
      timestamp: `${noteDate}T${String(8 + i).padStart(2, '0')}:30:00Z`,
      entry_type: 'delivery_note_entry',
      delivery_note_doc_id: docId,
      delivery_note_number: noteNumber,
      delivery_note_category_date: `ALBARANES#${noteDate}#${docId}`,
      provider_cif: isDuplicate && refEntry ? refEntry.provider_cif : supplier.cif,
      excluded_from_current_stock: false,

      raw_product_data: {
        product_name: productName.toUpperCase(),
        billed_quantity: billedQtyStr,
        billed_unit: productType === 'PACK' ? 'ud' : (unit === 'kg' ? 'kg' : 'ud'),
        listed_unit_price: priceVariation.toFixed(2),
        line_total_price_before_discount: totalLine.toFixed(2),
        discounts: [],
        extra_costs: [],
      },

      initial_interpretation: {
        product_type: productType,
        category,
        confidence_level: seededRandom() > 0.3 ? 'high' : 'medium',
        final_price_of_line: totalLine.toFixed(2),
        number_of_packs_interpreted: billedQtyStr,
        price_per_pack_interpreted: priceVariation.toFixed(2),
        pack_details_extracted: packDetails ? {
          subunits_in_pack: packDetails.subunits,
          subunit_uom: packDetails.uom,
          subunit_measure: packDetails.measure,
          total_content_per_pack: packDetails.contentPerPack,
        } : null,
      },

      calculated_stock_values: {
        quantity_added: productType === 'PACK' ? packQty.toFixed(3) : `${qty}.000`,
        unit_of_measure_stock: unit,
        cost_per_stock_unit: (totalLine / (productType === 'PACK' ? packQty : qty)).toFixed(4),
        total_cost_entry: totalLine.toFixed(2),
      },

      normalized: {
        entry_type: 'delivery_note_entry',
        kind: 'in',
        signed_quantity: productType === 'PACK' ? packQty : qty,
        unit,
        pricePerUnit: totalLine / (productType === 'PACK' ? packQty : qty),
        totalCost: totalLine,
        excluded_from_current_stock: false,
      },

      inGolden: isGolden,
      datasetIds: isGolden ? ['ds-main-001'] : [],
    });
  }
  return entries;
}

function suppliersFromHistory(entries: StockHistoryEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of entries) {
    const s = SUPPLIERS.find(s => s.cif === e.provider_cif);
    const name = s?.name ?? e.provider_cif;
    if (!seen.has(name)) { seen.add(name); result.push(name); }
  }
  return result;
}

// ─── Mock Ingredients ──────────────────────────────────────────────────────

function buildIngredients(): StockIngredient[] {
  _seed = 42; // reset seed for stability

  const defs: {
    id: string; name: string; ocrId: string; cat: string; sub: string;
    count: number; golden: number; unit: string; price: number;
    type: 'PACK' | 'DIRECT'; pack: { subunits: string; uom: string; measure: string; contentPerPack: string } | null;
    stock: number; dup?: number;
  }[] = [
    { id: 'ING-a1b2c3d4e5f6a1b2', name: 'Aceite Oliva Virgen Extra 5L', ocrId: 'AO-5L', cat: 'Aceites', sub: 'Oliva', count: 8, golden: 8, unit: 'l', price: 9.10, type: 'PACK', pack: { subunits: '1', uom: 'L', measure: '5', contentPerPack: '5' }, stock: 35 },
    { id: 'ING-b2c3d4e5f6a1b2c3', name: 'Tomate Triturado 2.5kg', ocrId: 'TT-2.5', cat: 'Conservas', sub: 'Tomate', count: 6, golden: 6, unit: 'kg', price: 2.35, type: 'PACK', pack: { subunits: '1', uom: 'kg', measure: '2.5', contentPerPack: '2.5' }, stock: 42.5 },
    { id: 'ING-c3d4e5f6a1b2c3d4', name: 'Harina de Trigo 25kg', ocrId: 'HT-25', cat: 'Harinas', sub: 'Trigo', count: 12, golden: 7, unit: 'kg', price: 0.68, type: 'PACK', pack: { subunits: '1', uom: 'kg', measure: '25', contentPerPack: '25' }, stock: 125, dup: 3 },
    { id: 'ING-d4e5f6a1b2c3d4e5', name: 'Salmon Fresco Filete', ocrId: 'SF-KG', cat: 'Pescados', sub: 'Salmon', count: 9, golden: 4, unit: 'kg', price: 18.50, type: 'DIRECT', pack: null, stock: 8.5 },
    { id: 'ING-e5f6a1b2c3d4e5f6', name: 'Leche Entera 1L', ocrId: 'LE-1L', cat: 'Lacteos', sub: 'Leche', count: 15, golden: 10, unit: 'l', price: 0.89, type: 'PACK', pack: { subunits: '1', uom: 'L', measure: '1', contentPerPack: '1' }, stock: 48, dup: 6 },
    { id: 'ING-f6a1b2c3d4e5f6a1', name: 'Pollo Entero Campero', ocrId: 'PC-KG', cat: 'Carnes', sub: 'Pollo', count: 7, golden: 0, unit: 'kg', price: 5.75, type: 'DIRECT', pack: null, stock: 14.2 },
    { id: 'ING-a7b8c9d0e1f2a3b4', name: 'Patatas Nuevas', ocrId: 'PN-KG', cat: 'Verduras', sub: 'Patatas', count: 11, golden: 0, unit: 'kg', price: 1.20, type: 'DIRECT', pack: null, stock: 85 },
    { id: 'ING-b8c9d0e1f2a3b4c5', name: 'Cerveza Lager Barril 30L', ocrId: 'CL-30', cat: 'Bebidas', sub: 'Cerveza', count: 5, golden: 0, unit: 'l', price: 2.15, type: 'PACK', pack: { subunits: '1', uom: 'L', measure: '30', contentPerPack: '30' }, stock: 60 },
    { id: 'ING-c9d0e1f2a3b4c5d6', name: 'Pimiento Rojo', ocrId: 'PR-KG', cat: 'Verduras', sub: 'Pimiento', count: 8, golden: 0, unit: 'kg', price: 3.40, type: 'DIRECT', pack: null, stock: 12 },
    { id: 'ING-d0e1f2a3b4c5d6e7', name: 'Cebolla Blanca', ocrId: 'CB-KG', cat: 'Verduras', sub: 'Cebolla', count: 10, golden: 0, unit: 'kg', price: 0.95, type: 'DIRECT', pack: null, stock: 30 },
    { id: 'ING-e1f2a3b4c5d6e7f8', name: 'Queso Manchego Curado', ocrId: 'QMC-KG', cat: 'Lacteos', sub: 'Queso', count: 6, golden: 2, unit: 'kg', price: 14.80, type: 'DIRECT', pack: null, stock: 4.5 },
    { id: 'ING-f2a3b4c5d6e7f8a9', name: 'Jamon Serrano Reserva', ocrId: 'JSR-KG', cat: 'Embutidos', sub: 'Jamon', count: 4, golden: 4, unit: 'kg', price: 32.50, type: 'DIRECT', pack: null, stock: 6.8 },
    { id: 'ING-a3b4c5d6e7f8a9b0', name: 'Azucar Blanca 1kg', ocrId: 'AB-1K', cat: 'Basicos', sub: 'Azucar', count: 6, golden: 0, unit: 'kg', price: 1.05, type: 'PACK', pack: { subunits: '1', uom: 'kg', measure: '1', contentPerPack: '1' }, stock: 18 },
    { id: 'ING-b4c5d6e7f8a9b0c1', name: 'Mantequilla sin Sal 250g', ocrId: 'MS-250', cat: 'Lacteos', sub: 'Mantequilla', count: 9, golden: 0, unit: 'kg', price: 8.40, type: 'PACK', pack: { subunits: '1', uom: 'kg', measure: '0.25', contentPerPack: '0.25' }, stock: 5.25 },
    { id: 'ING-c5d6e7f8a9b0c1d2', name: 'Gambas Peladas Congeladas', ocrId: 'GPC-KG', cat: 'Pescados', sub: 'Marisco', count: 5, golden: 1, unit: 'kg', price: 22.00, type: 'DIRECT', pack: null, stock: 3 },
  ];

  return defs.map(d => {
    const history = generateStockHistory(d.name, d.count, d.golden, d.unit, d.price, d.type, d.cat, d.pack, d.dup);
    const status: IngredientGoldenStatus = d.golden === 0 ? 'new' : d.golden >= d.count ? 'covered' : 'partial';

    // Compute price stats from history
    const prices = history.map(e => parseFloat(e.calculated_stock_values.cost_per_stock_unit));
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const variationPercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
    let priceChanges = 0;
    for (let i = 1; i < prices.length; i++) {
      if (Math.abs(prices[i] - prices[i - 1]) / prices[i - 1] > 0.01) priceChanges++;
    }

    const priceStats: PriceStats = { minPrice, maxPrice, avgPrice, totalPriceChanges: priceChanges, variationPercent };

    // Derive price alert from variation
    const hasAlert = variationPercent >= 10;
    const alertType: PriceAlert['alertType'] = hasAlert
      ? (prices[prices.length - 1] > avgPrice ? 'price_increase' : 'price_decrease')
      : null;
    const severity: PriceAlert['severity'] = variationPercent >= 25 ? 'critical'
      : variationPercent >= 10 ? 'high'
      : variationPercent >= 1 ? 'medium'
      : 'low';
    const priceAlert: PriceAlert = {
      hasAlert,
      alertType,
      severity: hasAlert ? severity : null,
      changePercent: variationPercent,
      alertDate: hasAlert ? '2026-03-15' : null,
    };

    return {
      ingredientId: d.id,
      ingredientName: d.name,
      originalProductIdOCR: d.ocrId,
      category: d.cat,
      subCategory: d.sub,
      currentStock: {
        quantity: d.stock,
        unit: d.unit,
        lastUpdated: '2026-03-15T10:30:00Z',
        orderCount: d.count,
      },
      currentMeasurementFormat: { type: d.type, unit_of_measure: d.unit.toUpperCase() },
      latestCost: d.price.toFixed(2),
      priceAlert,
      priceStats,
      status,
      totalStockEntries: d.count,
      goldenStockEntries: d.golden,
      suppliers: suppliersFromHistory(history),
      stockHistory: history,
    };
  });
}

export const MOCK_INGREDIENTS: StockIngredient[] = buildIngredients();

// ─── Mock Documents ────────────────────────────────────────────────────────

export const MOCK_DOCUMENTS: StockDocument[] = [
  {
    locationId: 'loc-abc123', categoryDate: '2026-01-15#doc-1001', supplierName: 'DISTRIBUCIONES SUR S.L.', supplierCif: 'B41234567',
    deliveryNoteNumber: 'ALB-2026-0042', date: '2026-01-15', totalProducts: 8, goldenProducts: 6, coveragePercent: 75.0,
    ingredients: [
      { ingredientId: 'ING-a1b2c3d4e5f6a1b2', ingredientName: 'Aceite Oliva Virgen Extra 5L', inGolden: true },
      { ingredientId: 'ING-b2c3d4e5f6a1b2c3', ingredientName: 'Tomate Triturado 2.5kg', inGolden: true },
      { ingredientId: 'ING-c3d4e5f6a1b2c3d4', ingredientName: 'Harina de Trigo 25kg', inGolden: true },
      { ingredientId: 'ING-e5f6a1b2c3d4e5f6', ingredientName: 'Leche Entera 1L', inGolden: true },
      { ingredientId: 'ING-d0e1f2a3b4c5d6e7', ingredientName: 'Cebolla Blanca', inGolden: false },
      { ingredientId: 'ING-a3b4c5d6e7f8a9b0', ingredientName: 'Azucar Blanca 1kg', inGolden: false },
      { ingredientId: 'ING-e1f2a3b4c5d6e7f8', ingredientName: 'Queso Manchego Curado', inGolden: true },
      { ingredientId: 'ING-f2a3b4c5d6e7f8a9', ingredientName: 'Jamon Serrano Reserva', inGolden: true },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-01-22#doc-1002', supplierName: 'FRUTAS GARCIA', supplierCif: 'B91234567',
    deliveryNoteNumber: 'ALB-2026-0089', date: '2026-01-22', totalProducts: 5, goldenProducts: 2, coveragePercent: 40.0,
    ingredients: [
      { ingredientId: 'ING-a7b8c9d0e1f2a3b4', ingredientName: 'Patatas Nuevas', inGolden: false },
      { ingredientId: 'ING-c9d0e1f2a3b4c5d6', ingredientName: 'Pimiento Rojo', inGolden: false },
      { ingredientId: 'ING-d0e1f2a3b4c5d6e7', ingredientName: 'Cebolla Blanca', inGolden: false },
      { ingredientId: 'ING-c3d4e5f6a1b2c3d4', ingredientName: 'Harina de Trigo 25kg', inGolden: true },
      { ingredientId: 'ING-e5f6a1b2c3d4e5f6', ingredientName: 'Leche Entera 1L', inGolden: true },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-02-03#doc-1003', supplierName: 'PESCADOS NORTE S.A.', supplierCif: 'A33456789',
    deliveryNoteNumber: 'ALB-2026-0134', date: '2026-02-03', totalProducts: 3, goldenProducts: 1, coveragePercent: 33.3,
    ingredients: [
      { ingredientId: 'ING-d4e5f6a1b2c3d4e5', ingredientName: 'Salmon Fresco Filete', inGolden: true },
      { ingredientId: 'ING-c5d6e7f8a9b0c1d2', ingredientName: 'Gambas Peladas Congeladas', inGolden: false },
      { ingredientId: 'ING-f6a1b2c3d4e5f6a1', ingredientName: 'Pollo Entero Campero', inGolden: false },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-02-10#doc-1004', supplierName: 'CARNICAS MARTINEZ', supplierCif: 'B29876543',
    deliveryNoteNumber: 'ALB-2026-0178', date: '2026-02-10', totalProducts: 4, goldenProducts: 3, coveragePercent: 75.0,
    ingredients: [
      { ingredientId: 'ING-f6a1b2c3d4e5f6a1', ingredientName: 'Pollo Entero Campero', inGolden: false },
      { ingredientId: 'ING-f2a3b4c5d6e7f8a9', ingredientName: 'Jamon Serrano Reserva', inGolden: true },
      { ingredientId: 'ING-e1f2a3b4c5d6e7f8', ingredientName: 'Queso Manchego Curado', inGolden: true },
      { ingredientId: 'ING-d4e5f6a1b2c3d4e5', ingredientName: 'Salmon Fresco Filete', inGolden: true },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-02-18#doc-1005', supplierName: 'DISTRIBUCIONES SUR S.L.', supplierCif: 'B41234567',
    deliveryNoteNumber: 'ALB-2026-0215', date: '2026-02-18', totalProducts: 10, goldenProducts: 8, coveragePercent: 80.0,
    ingredients: [
      { ingredientId: 'ING-a1b2c3d4e5f6a1b2', ingredientName: 'Aceite Oliva Virgen Extra 5L', inGolden: true },
      { ingredientId: 'ING-b2c3d4e5f6a1b2c3', ingredientName: 'Tomate Triturado 2.5kg', inGolden: true },
      { ingredientId: 'ING-c3d4e5f6a1b2c3d4', ingredientName: 'Harina de Trigo 25kg', inGolden: true },
      { ingredientId: 'ING-e5f6a1b2c3d4e5f6', ingredientName: 'Leche Entera 1L', inGolden: true },
      { ingredientId: 'ING-b8c9d0e1f2a3b4c5', ingredientName: 'Cerveza Lager Barril 30L', inGolden: false },
      { ingredientId: 'ING-b4c5d6e7f8a9b0c1', ingredientName: 'Mantequilla sin Sal 250g', inGolden: false },
      { ingredientId: 'ING-a3b4c5d6e7f8a9b0', ingredientName: 'Azucar Blanca 1kg', inGolden: true },
      { ingredientId: 'ING-e1f2a3b4c5d6e7f8', ingredientName: 'Queso Manchego Curado', inGolden: true },
      { ingredientId: 'ING-f2a3b4c5d6e7f8a9', ingredientName: 'Jamon Serrano Reserva', inGolden: true },
      { ingredientId: 'ING-d4e5f6a1b2c3d4e5', ingredientName: 'Salmon Fresco Filete', inGolden: true },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-03-01#doc-1006', supplierName: 'ACEITES DEL CAMPO', supplierCif: 'A28765432',
    deliveryNoteNumber: 'ALB-2026-0267', date: '2026-03-01', totalProducts: 2, goldenProducts: 2, coveragePercent: 100.0,
    ingredients: [
      { ingredientId: 'ING-a1b2c3d4e5f6a1b2', ingredientName: 'Aceite Oliva Virgen Extra 5L', inGolden: true },
      { ingredientId: 'ING-b2c3d4e5f6a1b2c3', ingredientName: 'Tomate Triturado 2.5kg', inGolden: true },
    ],
  },
  {
    locationId: 'loc-abc123', categoryDate: '2026-03-08#doc-1007', supplierName: 'FRUTAS GARCIA', supplierCif: 'B91234567',
    deliveryNoteNumber: 'ALB-2026-0301', date: '2026-03-08', totalProducts: 6, goldenProducts: 1, coveragePercent: 16.7,
    ingredients: [
      { ingredientId: 'ING-a7b8c9d0e1f2a3b4', ingredientName: 'Patatas Nuevas', inGolden: false },
      { ingredientId: 'ING-c9d0e1f2a3b4c5d6', ingredientName: 'Pimiento Rojo', inGolden: false },
      { ingredientId: 'ING-d0e1f2a3b4c5d6e7', ingredientName: 'Cebolla Blanca', inGolden: false },
      { ingredientId: 'ING-f6a1b2c3d4e5f6a1', ingredientName: 'Pollo Entero Campero', inGolden: false },
      { ingredientId: 'ING-b4c5d6e7f8a9b0c1', ingredientName: 'Mantequilla sin Sal 250g', inGolden: false },
      { ingredientId: 'ING-c3d4e5f6a1b2c3d4', ingredientName: 'Harina de Trigo 25kg', inGolden: true },
    ],
  },
];

// ─── Summary ───────────────────────────────────────────────────────────────

export function getMockSummary(): StockAnnotationsSummary {
  const covered = MOCK_INGREDIENTS.filter(i => i.status === 'covered').length;
  const partial = MOCK_INGREDIENTS.filter(i => i.status === 'partial').length;
  const newCount = MOCK_INGREDIENTS.filter(i => i.status === 'new').length;
  return { total: MOCK_INGREDIENTS.length, covered, partial, new: newCount };
}

// ─── Duplicate detection ───────────────────────────────────────────────────

export function findDuplicateEntries(entries: StockHistoryEntry[]): Set<string> {
  const seen = new Map<string, string>(); // key → first entry id
  const duplicates = new Set<string>();
  for (const e of entries) {
    const key = `${e.delivery_note_number}#${e.timestamp.substring(0, 10)}`;
    const existing = seen.get(key);
    if (existing) {
      duplicates.add(existing);
      duplicates.add(e.stock_entry_id);
    } else {
      seen.set(key, e.stock_entry_id);
    }
  }
  return duplicates;
}

// ─── Mock datasets ─────────────────────────────────────────────────────────

export const MOCK_DATASETS = [
  { datasetId: 'ds-main-001', datasetName: 'Restaurant ABC curated Q1 2026', documentCount: 18 },
  { datasetId: 'ds-main-002', datasetName: 'Hotel Playa Mar Q1 2026', documentCount: 7 },
];
