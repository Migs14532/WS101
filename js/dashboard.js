(() => {
  "use strict";
  const App = window.App;

  function summary() {
    const products = App.state.products;
    let lowStock = 0;
    let outOfStock = 0;
    let totalQuantity = 0;
    let totalValue = 0;
    for (const product of products) {
      totalQuantity += product.stockQuantity;
      totalValue += product.purchasePrice * product.stockQuantity;
      const status = App.utils.status(product).key;
      if (status === "low") lowStock += 1;
      if (status === "out") outOfStock += 1;
    }
    return {
      totalProducts: products.length,
      totalQuantity,
      lowStock,
      outOfStock,
      totalValue: Math.round((totalValue + Number.EPSILON) * 100) / 100,
      recentTransactions: [...App.state.inventoryTransactions]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 7),
      lowStockProducts: products
        .filter((product) => App.utils.status(product).key === "low")
        .sort((a, b) => a.stockQuantity - b.stockQuantity || a.name.localeCompare(b.name))
    };
  }

  App.dashboard = { summary };
})();
