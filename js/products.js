(() => {
  "use strict";
  const App = window.App;

  function cloneState() {
    return JSON.parse(JSON.stringify(App.state));
  }

  function validateProduct(input, currentId = "") {
    const fields = [
      ["name", "Product name"], ["category", "Category"], ["brand", "Brand"],
      ["size", "Size"], ["color", "Color"], ["gender", "Gender"], ["sku", "SKU"]
    ];
    for (const [key, label] of fields) {
      if (typeof input[key] !== "string" || !input[key].trim()) throw new Error(`${label} is required.`);
    }
    if (!App.categories.includes(input.category)) throw new Error("Choose a valid category.");
    if (!App.genders.includes(input.gender)) throw new Error("Choose a valid gender.");
    const sku = input.sku.trim();
    if (App.state.products.some((product) =>
      product.id !== currentId && App.utils.normalizeSku(product.sku) === App.utils.normalizeSku(sku)
    )) {
      throw new Error("That SKU is already in use. SKUs are unique regardless of letter case.");
    }
    for (const [key, label] of [["purchasePrice", "Purchase price"], ["sellingPrice", "Selling price"]]) {
      if (!Number.isFinite(input[key]) || input[key] < 0) throw new Error(`${label} must be zero or greater.`);
    }
    for (const [key, label] of [["reorderLevel", "Reorder level"]]) {
      if (!Number.isInteger(input[key]) || input[key] < 0) throw new Error(`${label} must be a non-negative whole number.`);
    }
    if (!currentId && (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0)) {
      throw new Error("Opening stock must be a non-negative whole number.");
    }
    if (input.imageUrl && !App.utils.imageUrl(input.imageUrl)) {
      throw new Error("Image URL must be a valid HTTP or HTTPS address.");
    }
    return {
      name: input.name.trim(),
      category: input.category,
      brand: input.brand.trim(),
      size: input.size.trim(),
      color: input.color.trim(),
      gender: input.gender,
      sku,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      reorderLevel: input.reorderLevel,
      imageUrl: input.imageUrl.trim(),
      description: input.description.trim()
    };
  }

  function saveProduct(input, id = "") {
    const clean = validateProduct(input, id);
    const next = cloneState();
    const now = new Date().toISOString();
    if (id) {
      const index = next.products.findIndex((product) => product.id === id);
      if (index < 0) throw new Error("This product no longer exists. Reload the inventory and try again.");
      next.products[index] = {
        ...next.products[index],
        ...clean,
        lastUpdated: now
      };
    } else {
      const product = {
        id: App.utils.id("prd"),
        ...clean,
        stockQuantity: input.stockQuantity,
        dateAdded: now,
        lastUpdated: now
      };
      next.products.push(product);
      if (product.stockQuantity > 0) {
        next.inventoryTransactions.push({
          id: App.utils.id("txn"),
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          type: "Stock In",
          quantity: product.stockQuantity,
          previousStock: 0,
          newStock: product.stockQuantity,
          createdAt: now,
          notes: "Opening stock"
        });
      }
    }
    App.storage.save(next);
    App.state = next;
    return id ? App.state.products.find((product) => product.id === id) : next.products[next.products.length - 1];
  }

  function deleteProduct(id) {
    const product = App.state.products.find((item) => item.id === id);
    if (!product) throw new Error("This product no longer exists.");
    const next = cloneState();
    next.products = next.products.filter((item) => item.id !== id);
    App.storage.save(next);
    App.state = next;
    return product;
  }

  App.products = { validate: validateProduct, save: saveProduct, remove: deleteProduct };
})();
