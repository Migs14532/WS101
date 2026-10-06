(() => {
  "use strict";
  const App = window.App;

  function recordMovement({ productId, type, quantity, newCount, notes = "" }) {
    const product = App.state.products.find((item) => item.id === productId);
    if (!product) throw new Error("Select an active product.");
    if (!["Stock In", "Stock Out", "Stock Adjustment"].includes(type)) throw new Error("Choose a valid transaction type.");
    if (typeof notes !== "string" || notes.length > 500) throw new Error("Notes must be 500 characters or fewer.");

    const previousStock = product.stockQuantity;
    let newStock;
    let recordedQuantity;
    if (type === "Stock Adjustment") {
      if (!Number.isInteger(newCount) || newCount < 0) throw new Error("Counted stock must be a non-negative whole number.");
      if (newCount === previousStock) throw new Error("The counted quantity matches current stock; no adjustment was made.");
      newStock = newCount;
      recordedQuantity = newStock - previousStock;
    } else {
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Movement quantity must be a positive whole number.");
      recordedQuantity = quantity;
      newStock = type === "Stock In" ? previousStock + quantity : previousStock - quantity;
      if (newStock < 0) throw new Error(`Cannot remove ${quantity} units; only ${previousStock} are in stock.`);
    }

    const next = JSON.parse(JSON.stringify(App.state));
    const now = new Date().toISOString();
    const updatedProduct = next.products.find((item) => item.id === productId);
    updatedProduct.stockQuantity = newStock;
    updatedProduct.lastUpdated = now;
    next.inventoryTransactions.push({
      id: App.utils.id("txn"),
      productId,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      type,
      quantity: recordedQuantity,
      previousStock,
      newStock,
      createdAt: now,
      notes: notes.trim()
    });
    App.storage.save(next);
    App.state = next;
    return next.inventoryTransactions[next.inventoryTransactions.length - 1];
  }

  App.inventory = { recordMovement };
})();
