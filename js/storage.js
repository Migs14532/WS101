(() => {
  "use strict";
  const App = window.App;
  const STORAGE_KEY = "threadline.apparelInventory.v1";

  function emptyState() {
    return {
      version: 1,
      products: [],
      categories: [...App.categories],
      inventoryTransactions: [],
      settings: { currency: "PHP" },
      initialized: true
    };
  }

  function sampleState() {
    const products = [
      ["Everyday Cotton Tee", "T-Shirts", "Northline", "M", "Forest Green", "Unisex", "NL-TEE-014", 8.5, 22, 32, 6, "A breathable everyday cotton crew neck."],
      ["Classic Pique Polo", "Polo Shirts", "Harbor & Field", "L", "Navy", "Men", "HF-POL-008", 13, 34, 18, 5, "Textured pique polo with a clean finish."],
      ["Studio Fleece Hoodie", "Hoodies", "Common Thread", "S", "Oatmeal", "Women", "CT-HOO-021", 21, 54, 4, 5, "Midweight brushed fleece with a relaxed fit."],
      ["Utility Shell Jacket", "Jackets", "Northline", "XL", "Charcoal", "Men", "NL-JKT-031", 38, 89, 0, 3, "Water-resistant shell with concealed pockets."],
      ["Straight Leg Chino", "Pants", "Daymark", "32", "Sand", "Men", "DM-PNT-112", 19, 48, 14, 4, "Cotton twill with a comfortable straight fit."],
      ["Relaxed Denim Jean", "Jeans", "Harbor & Field", "28", "Washed Blue", "Women", "HF-JEA-044", 24, 62, 2, 4, "Soft washed denim in a relaxed silhouette."],
      ["Weekend Drawstring Short", "Shorts", "Common Thread", "M", "Terracotta", "Unisex", "CT-SHO-019", 11.5, 29, 26, 6, "Easy pull-on short for warm days."],
      ["Linen Wrap Dress", "Dresses", "Daymark", "M", "Sage", "Women", "DM-DRE-007", 27, 72, 9, 3, "Lightweight linen blend with a waist tie."],
      ["Pleated Midi Skirt", "Skirts", "Daymark", "S", "Black", "Women", "DM-SKI-016", 18, 46, 3, 4, "Fluid pleats and an elasticated waistband."],
      ["Active Training Legging", "Activewear", "Northline", "M", "Plum", "Women", "NL-ACT-053", 16, 42, 21, 5, "Four-way stretch with a high-rise waist."],
      ["Ribbed Beanie", "Accessories", "Harbor & Field", "One Size", "Rust", "Unisex", "HF-ACC-003", 6, 18, 0, 2, "Soft rib-knit winter beanie."],
      ["Canvas Market Tote", "Other", "Common Thread", "One Size", "Natural", "Unisex", "CT-OTH-001", 7, 20, 7, 3, "Heavyweight cotton canvas carryall."]
    ];
    const state = emptyState();
    const now = Date.now();
    state.products = products.map((row, index) => ({
      id: App.utils.id("prd"),
      name: row[0],
      category: row[1],
      brand: row[2],
      size: row[3],
      color: row[4],
      gender: row[5],
      sku: row[6],
      purchasePrice: row[7],
      sellingPrice: row[8],
      stockQuantity: row[9],
      reorderLevel: row[10],
      imageUrl: "",
      description: row[11],
      dateAdded: new Date(now - (index + 2) * 86400000).toISOString(),
      lastUpdated: new Date(now - (index + 2) * 86400000).toISOString()
    }));
    state.inventoryTransactions = state.products
      .filter((product) => product.stockQuantity > 0)
      .map((product, index) => ({
        id: App.utils.id("txn"),
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        type: "Stock In",
        quantity: product.stockQuantity,
        previousStock: 0,
        newStock: product.stockQuantity,
        createdAt: new Date(now - (index + 1) * 3600000).toISOString(),
        notes: "Sample opening stock"
      }));
    return state;
  }

  function validateState(value) {
    if (!value || typeof value !== "object" || value.version !== 1 ||
        !Array.isArray(value.products) || !Array.isArray(value.categories) ||
        !Array.isArray(value.inventoryTransactions) || !value.settings ||
        typeof value.settings.currency !== "string" || value.settings.currency !== value.settings.currency.toUpperCase() ||
        !App.utils.isCurrencyCode(value.settings.currency) ||
        value.initialized !== true) {
      throw new Error("This file is not a supported Threadline inventory backup.");
    }
    if (JSON.stringify(value.categories) !== JSON.stringify(App.categories)) {
      throw new Error("The backup’s apparel categories do not match this version of the app.");
    }
    const ids = new Set();
    const skus = new Set();
    for (const product of value.products) {
      if (!product || typeof product.id !== "string" || !product.id ||
          typeof product.name !== "string" || !product.name.trim() ||
          !App.categories.includes(product.category) || typeof product.brand !== "string" ||
          !product.brand.trim() || typeof product.size !== "string" || !product.size.trim() ||
          typeof product.color !== "string" || !product.color.trim() ||
          !App.genders.includes(product.gender) || typeof product.sku !== "string" ||
          !product.sku.trim() || !Number.isFinite(product.purchasePrice) || product.purchasePrice < 0 ||
          !Number.isFinite(product.sellingPrice) || product.sellingPrice < 0 ||
          !Number.isInteger(product.stockQuantity) || product.stockQuantity < 0 ||
          !Number.isInteger(product.reorderLevel) || product.reorderLevel < 0 ||
          typeof product.imageUrl !== "string" || typeof product.description !== "string" ||
          !App.utils.isValidIsoDate(product.dateAdded) || !App.utils.isValidIsoDate(product.lastUpdated)) {
        throw new Error("The backup contains a product with invalid or missing fields.");
      }
      const sku = App.utils.normalizeSku(product.sku);
      if (ids.has(product.id) || skus.has(sku)) throw new Error("The backup contains duplicate product IDs or SKUs.");
      ids.add(product.id);
      skus.add(sku);
      if (product.imageUrl && !App.utils.imageUrl(product.imageUrl)) {
        throw new Error(`The image URL for ${product.name} is invalid.`);
      }
    }
    const transactionIds = new Set();
    for (const transaction of value.inventoryTransactions) {
      if (!transaction || typeof transaction.id !== "string" || !transaction.id ||
          transactionIds.has(transaction.id) || typeof transaction.productId !== "string" ||
          typeof transaction.productNameSnapshot !== "string" || typeof transaction.skuSnapshot !== "string" ||
          !["Stock In", "Stock Out", "Stock Adjustment"].includes(transaction.type) ||
          !Number.isInteger(transaction.quantity) || !Number.isInteger(transaction.previousStock) ||
          !Number.isInteger(transaction.newStock) || transaction.previousStock < 0 || transaction.newStock < 0 ||
          !App.utils.isValidIsoDate(transaction.createdAt) || typeof transaction.notes !== "string") {
        throw new Error("The backup contains an invalid inventory transaction.");
      }
      if (transaction.type === "Stock In" &&
          (transaction.quantity <= 0 || transaction.newStock !== transaction.previousStock + transaction.quantity)) {
        throw new Error("The backup contains an inconsistent Stock In transaction.");
      }
      if (transaction.type === "Stock Out" &&
          (transaction.quantity <= 0 || transaction.newStock !== transaction.previousStock - transaction.quantity)) {
        throw new Error("The backup contains an inconsistent Stock Out transaction.");
      }
      if (transaction.type === "Stock Adjustment" &&
          (transaction.quantity === 0 || transaction.newStock - transaction.previousStock !== transaction.quantity)) {
        throw new Error("The backup contains an inconsistent Stock Adjustment transaction.");
      }
      transactionIds.add(transaction.id);
    }
    return value;
  }

  function load() {
    let raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      throw new Error(`Browser storage is unavailable: ${error.message}`);
    }
    if (raw === null) {
      const initial = sampleState();
      save(initial);
      return initial;
    }
    try {
      return validateState(JSON.parse(raw));
    } catch (error) {
      throw new Error(`Saved inventory could not be loaded: ${error.message}`);
    }
  }

  function save(state) {
    validateState(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      const reason = error && error.name === "QuotaExceededError"
        ? "Browser storage is full. Export a backup and remove unused data or images before retrying."
        : `Unable to save to browser storage: ${error.message}`;
      throw new Error(reason);
    }
  }

  function importBackup(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
    return validateState(parsed);
  }

  App.storage = { key: STORAGE_KEY, load, save, validateState, importBackup };
})();
