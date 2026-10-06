(() => {
  "use strict";
  const App = window.App;
  const utils = App.utils;
  const pageContent = document.querySelector("#page-content");
  const dialog = document.querySelector("#app-dialog");
  const dialogContent = document.querySelector("#dialog-content");
  const pageNames = {
    dashboard: "Dashboard", products: "Products", inventory: "Inventory",
    categories: "Categories", "low-stock": "Low stock", history: "History", settings: "Settings"
  };
  const state = {
    page: "dashboard",
    productFilters: { search: "", category: "", brand: "", size: "", color: "", status: "", sort: "name", direction: "asc", page: 1 },
    inventorySearch: "",
    historyFilters: { type: "", productId: "", from: "", to: "", page: 1 },
    stale: false
  };

  function pageHeading(title, subtitle, actions = "") {
    return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
  }

  function empty(title, description, button = "") {
    return `<div class="empty-state"><strong>${utils.escape(title)}</strong>${utils.escape(description)}${button ? `<div style="margin-top:14px">${button}</div>` : ""}</div>`;
  }

  function transactionType(type) {
    const className = type === "Stock Out" ? "type-out" : type === "Stock Adjustment" ? "type-adjust" : "";
    return `<span class="type-pill ${className}">${utils.escape(type)}</span>`;
  }

  function transactionRows(transactions) {
    if (!transactions.length) return `<tr><td colspan="6">${empty("No inventory activity yet", "Stock movements will appear here.")}</td></tr>`;
    return transactions.map((transaction) => `
      <tr>
        <td>${utils.dateTime(transaction.createdAt)}</td>
        <td><div class="product-cell">${utils.escape(transaction.productNameSnapshot)}<small class="sku">${utils.escape(transaction.skuSnapshot)}</small></div></td>
        <td>${transactionType(transaction.type)}</td>
        <td class="stock-number">${transaction.type === "Stock Adjustment" && transaction.quantity > 0 ? "+" : ""}${transaction.quantity.toLocaleString()}</td>
        <td>${transaction.previousStock.toLocaleString()} <span aria-hidden="true">→</span> <strong>${transaction.newStock.toLocaleString()}</strong></td>
        <td>${utils.escape(transaction.notes || "—")}</td>
      </tr>`).join("");
  }

  function renderDashboard() {
    const summary = App.dashboard.summary();
    const currency = App.state.settings.currency;
    const recent = summary.recentTransactions;
    const alerts = summary.lowStockProducts.slice(0, 5);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const metrics = [
      ["Total products", summary.totalProducts.toLocaleString(), "Active catalog items", "◫", ""],
      ["Inventory quantity", summary.totalQuantity.toLocaleString(), "Individual units on hand", "▦", ""],
      ["Low stock", summary.lowStock.toLocaleString(), "Products to replenish", "⌁", "warning"],
      ["Out of stock", summary.outOfStock.toLocaleString(), "Products at zero units", "!", "danger"],
      ["Inventory value", utils.money(summary.totalValue, currency), "At purchase price", "◈", ""]
    ];
    pageContent.innerHTML = `
      ${pageHeading(`Good ${greeting}`,
        "Here’s what’s happening with your inventory today.",
        '<button class="btn" type="button" data-page="history">View history</button><button class="btn btn-primary" type="button" data-action="new-product">＋ Add product</button>')}
      <div class="stats-grid">${metrics.map(([label, value, hint, icon, className]) => `
        <article class="card stat-card ${className}"><div class="stat-label"><span class="stat-icon" aria-hidden="true">${icon}</span>${label}</div>
          <strong class="stat-value">${value}</strong><div class="stat-hint">${hint}</div></article>`).join("")}</div>
      <div class="dashboard-grid">
        <section class="card section-card">
          <div class="section-title-row"><div><h2>Recent inventory activity</h2><p class="section-subtitle">Latest stock movements across your products</p></div><button class="text-link" type="button" data-page="history">View all →</button></div>
          <div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Stock change</th></tr></thead>
          <tbody>${recent.length ? recent.map((transaction) => `
            <tr><td>${utils.dateTime(transaction.createdAt)}</td>
              <td><div class="product-cell">${utils.escape(transaction.productNameSnapshot)}<small class="sku">${utils.escape(transaction.skuSnapshot)}</small></div></td>
              <td>${transactionType(transaction.type)}</td>
              <td class="stock-number">${transaction.type === "Stock Adjustment" && transaction.quantity > 0 ? "+" : ""}${transaction.quantity.toLocaleString()}</td>
              <td>${transaction.previousStock} <span aria-hidden="true">→</span> <strong>${transaction.newStock}</strong></td></tr>`).join("") :
            `<tr><td colspan="5">${empty("No stock movements", "Your inventory activity will appear here.")}</td></tr>`}</tbody></table></div>
        </section>
        <section class="card section-card">
          <div class="section-title-row"><div><h2>Needs attention</h2><p class="section-subtitle">${summary.lowStock} products at or below reorder level</p></div><button class="text-link" type="button" data-page="low-stock">See all →</button></div>
          <div class="quick-alert-list">${alerts.length ? alerts.map((product) => `
            <div class="alert-row"><div class="alert-product"><strong>${utils.escape(product.name)}</strong><small>${utils.escape(product.sku)} · ${utils.escape(product.size)} / ${utils.escape(product.color)}</small></div>
            <div class="alert-qty"><strong>${product.stockQuantity} left</strong><small>Reorder at ${product.reorderLevel}</small></div></div>`).join("") :
            empty("All caught up", "No products currently need restocking.")}</div>
        </section>
      </div>`;
  }

  function filteredProducts() {
    const filter = state.productFilters;
    let items = [...App.state.products];
    const search = filter.search.trim().toLocaleLowerCase();
    if (search) items = items.filter((item) => item.name.toLocaleLowerCase().includes(search) || item.sku.toLocaleLowerCase().includes(search));
    for (const key of ["category", "brand", "size", "color"]) {
      if (filter[key]) items = items.filter((item) => item[key] === filter[key]);
    }
    if (filter.status) items = items.filter((item) => utils.status(item).key === filter.status);
    items.sort((a, b) => {
      const key = filter.sort;
      let compare;
      if (["stockQuantity", "purchasePrice", "sellingPrice", "lastUpdated"].includes(key)) {
        compare = key === "lastUpdated"
          ? Date.parse(a[key]) - Date.parse(b[key])
          : a[key] - b[key];
      } else {
        compare = String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true, sensitivity: "base" });
      }
      return compare * (filter.direction === "desc" ? -1 : 1);
    });
    return items;
  }

  function sortHeading(key, label) {
    const active = state.productFilters.sort === key;
    return `<button class="sort-button" type="button" data-sort="${key}" aria-label="Sort by ${label}${active ? state.productFilters.direction === "asc" ? ", ascending" : ", descending" : ""}">${label}${active ? (state.productFilters.direction === "asc" ? " ↑" : " ↓") : ""}</button>`;
  }

  function productTableRow(product) {
    const status = utils.status(product);
    return `<tr>
      <td><div class="product-cell">${utils.thumb(product)}<span>${utils.escape(product.name)}<small>${utils.escape(product.brand)} · ${utils.escape(product.size)} / ${utils.escape(product.color)}</small></span></div></td>
      <td class="sku">${utils.escape(product.sku)}</td><td>${utils.escape(product.category)}</td>
      <td class="stock-number">${product.stockQuantity.toLocaleString()}</td><td>${utils.statusPill(product)}</td>
      <td>${utils.money(product.purchasePrice, App.state.settings.currency)}</td>
      <td>${utils.money(product.sellingPrice, App.state.settings.currency)}</td><td>${utils.date(product.lastUpdated)}</td>
      <td><div class="row-actions"><button class="btn btn-quiet" data-action="view-product" data-id="${utils.escape(product.id)}" aria-label="View ${utils.escape(product.name)}">View</button>
        <button class="btn btn-quiet" data-action="edit-product" data-id="${utils.escape(product.id)}" aria-label="Edit ${utils.escape(product.name)}">Edit</button>
        <button class="btn btn-quiet" data-action="product-menu-delete" data-id="${utils.escape(product.id)}" aria-label="Delete ${utils.escape(product.name)}">Delete</button></div></td>
    </tr>`;
  }

  function productCard(product) {
    return `<article class="mobile-product-card"><div class="mobile-product-top">${utils.thumb(product)}<div class="product-cell"><span>${utils.escape(product.name)}<small>${utils.escape(product.brand)} · ${utils.escape(product.sku)}</small></span></div>${utils.statusPill(product)}</div>
      <div class="mobile-product-meta"><div><small>Category</small><strong>${utils.escape(product.category)}</strong></div><div><small>Size / color</small><strong>${utils.escape(product.size)} / ${utils.escape(product.color)}</strong></div><div><small>On hand</small><strong>${product.stockQuantity}</strong></div></div>
      <div class="mobile-card-actions"><button class="btn btn-small" data-action="view-product" data-id="${utils.escape(product.id)}">Details</button><button class="btn btn-small" data-action="edit-product" data-id="${utils.escape(product.id)}">Edit</button><button class="btn btn-small btn-danger" data-action="product-menu-delete" data-id="${utils.escape(product.id)}">Delete</button></div>
    </article>`;
  }

  function filterSelect(key, label, values, className = "") {
    const selection = state.productFilters[key];
    const allLabel = { category: "All categories", brand: "All brands", size: "All sizes", color: "All colors" }[key] || `All ${label}`;
    return `<label class="sr-only" for="filter-${key}">${label}</label><select class="select ${className}" id="filter-${key}" data-product-filter="${key}"><option value="">${allLabel}</option>${utils.optionList(values.filter(Boolean).sort((a, b) => a.localeCompare(b)), selection)}</select>`;
  }

  function renderProducts() {
    const filter = state.productFilters;
    const all = filteredProducts();
    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
    filter.page = Math.min(filter.page, pageCount);
    const pageItems = all.slice((filter.page - 1) * pageSize, filter.page * pageSize);
    const products = App.state.products;
    const countLabel = `${all.length} ${all.length === 1 ? "product" : "products"}`;
    const prevDisabled = filter.page <= 1 ? "disabled" : "";
    const nextDisabled = filter.page >= pageCount ? "disabled" : "";
    const brandOptions = [...new Set(products.map((item) => item.brand))];
    const sizeOptions = [...new Set(products.map((item) => item.size))];
    const colorOptions = [...new Set(products.map((item) => item.color))];
    pageContent.innerHTML = `
      ${pageHeading("Products", "Manage your catalog, product details, and selling prices.",
        '<button class="btn btn-primary" type="button" data-action="new-product">＋ Add product</button>')}
      <div class="toolbar" role="search">
        <div class="search-box"><span aria-hidden="true">⌕</span><label class="sr-only" for="product-search">Search product name or SKU</label><input class="search-input" id="product-search" data-product-filter="search" type="search" placeholder="Search product name or SKU…" value="${utils.escape(filter.search)}"></div>
        ${filterSelect("category", "category", App.categories, "wide-filter")}
        ${filterSelect("brand", "brand", brandOptions)}
        ${filterSelect("size", "size", sizeOptions)}
        ${filterSelect("color", "color", colorOptions)}
        <label class="sr-only" for="filter-status">Stock status</label><select class="select" id="filter-status" data-product-filter="status"><option value="">All statuses</option><option value="in"${filter.status === "in" ? " selected" : ""}>In stock</option><option value="low"${filter.status === "low" ? " selected" : ""}>Low stock</option><option value="out"${filter.status === "out" ? " selected" : ""}>Out of stock</option></select>
        <span class="filter-count">${countLabel}</span>
      </div>
      <section class="card table-card">
        <div class="table-toolbar"><strong>Product catalog</strong><span class="filter-count">Sort by any column</span></div>
        ${all.length ? `<div class="table-wrap desktop-table"><table><thead><tr>
          <th>${sortHeading("name", "Product")}</th><th>${sortHeading("sku", "SKU")}</th><th>${sortHeading("category", "Category")}</th>
          <th>${sortHeading("stockQuantity", "On hand")}</th><th>Status</th><th>${sortHeading("purchasePrice", "Cost")}</th>
          <th>${sortHeading("sellingPrice", "Selling price")}</th><th>${sortHeading("lastUpdated", "Last updated")}</th><th>Actions</th>
        </tr></thead><tbody>${pageItems.map(productTableRow).join("")}</tbody></table></div>
        <div class="product-cards">${pageItems.map(productCard).join("")}</div>
        <div class="pagination"><span>Showing ${Math.min((filter.page - 1) * pageSize + 1, all.length)}–${Math.min(filter.page * pageSize, all.length)} of ${all.length}</span>
          <div class="pagination-actions"><button class="btn btn-small" data-action="products-page" data-page-number="${filter.page - 1}" ${prevDisabled}>Previous</button><span class="filter-count">Page ${filter.page} of ${pageCount}</span><button class="btn btn-small" data-action="products-page" data-page-number="${filter.page + 1}" ${nextDisabled}>Next</button></div></div>` :
        empty("No products found", products.length ? "Try changing or clearing your filters." : "Add your first product to get started.",
          products.length ? '<button class="btn btn-small" data-action="clear-product-filters">Clear filters</button>' : '<button class="btn btn-primary btn-small" data-action="new-product">Add a product</button>')}
      </section>`;
  }

  function renderInventory() {
    const search = state.inventorySearch.trim().toLocaleLowerCase();
    const products = [...App.state.products]
      .filter((product) => !search || product.name.toLocaleLowerCase().includes(search) || product.sku.toLocaleLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
    pageContent.innerHTML = `
      ${pageHeading("Inventory", "Track on-hand quantities and record every stock movement.",
        '<button class="btn btn-primary" type="button" data-action="new-stock-movement">＋ Record movement</button>')}
      <div class="toolbar"><div class="search-box"><span aria-hidden="true">⌕</span><label class="sr-only" for="inventory-search">Search inventory</label><input class="search-input" id="inventory-search" type="search" data-inventory-search placeholder="Search product name or SKU…" value="${utils.escape(state.inventorySearch)}"></div><span class="filter-count">${products.length} products</span></div>
      <section class="card table-card">
        ${products.length ? `<div class="table-wrap desktop-table"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Status</th><th>Stock actions</th></tr></thead><tbody>
          ${products.map((product) => `<tr><td><div class="product-cell">${utils.thumb(product)}<span>${utils.escape(product.name)}<small>${utils.escape(product.brand)} · ${utils.escape(product.size)} / ${utils.escape(product.color)}</small></span></div></td>
          <td class="sku">${utils.escape(product.sku)}</td><td>${utils.escape(product.category)}</td><td class="stock-number">${product.stockQuantity.toLocaleString()}</td><td>${product.reorderLevel}</td><td>${utils.statusPill(product)}</td>
          <td><div class="inventory-actions"><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock In">Stock in</button><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock Out">Stock out</button><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock Adjustment">Adjust</button></div></td></tr>`).join("")}
        </tbody></table></div>
        <div class="product-cards">${products.map((product) => `<article class="mobile-product-card"><div class="mobile-product-top">${utils.thumb(product)}<div class="product-cell"><span>${utils.escape(product.name)}<small>${utils.escape(product.sku)}</small></span></div>${utils.statusPill(product)}</div>
          <div class="mobile-product-meta"><div><small>On hand</small><strong>${product.stockQuantity}</strong></div><div><small>Reorder level</small><strong>${product.reorderLevel}</strong></div><div><small>Category</small><strong>${utils.escape(product.category)}</strong></div></div>
          <div class="mobile-card-actions"><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock In">Stock in</button><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock Out">Stock out</button><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock Adjustment">Adjust</button></div></article>`).join("")}</div>` :
        empty(search ? "No matching products" : "No products to track", search ? "Try another product name or SKU." : "Add products to begin managing your stock.",
          search ? "" : '<button class="btn btn-primary btn-small" data-action="new-product">Add a product</button>')}
      </section>`;
  }

  function renderCategories() {
    const icons = ["◌", "◍", "♧", "▱", "⌁", "◫", "◔", "◇", "◠", "↗", "✳", "＋"];
    pageContent.innerHTML = `${pageHeading("Categories", "Browse your fixed apparel categories and see how your catalog is organized.")}
      <div class="category-grid">${App.categories.map((category, index) => {
        const count = App.state.products.filter((product) => product.category === category).length;
        return `<button class="category-card" type="button" data-action="open-category" data-category="${utils.escape(category)}"><span class="category-icon" aria-hidden="true">${icons[index]}</span><span><strong>${utils.escape(category)}</strong><small>${count} ${count === 1 ? "product" : "products"}</small></span></button>`;
      }).join("")}</div>`;
  }

  function renderLowStock() {
    const products = App.dashboard.summary().lowStockProducts;
    pageContent.innerHTML = `${pageHeading("Low stock", "Products with stock above zero and at or below their reorder level.")}
      <section class="card table-card"><div class="table-toolbar"><strong>${products.length} ${products.length === 1 ? "product needs" : "products need"} replenishment</strong></div>
      ${products.length ? `<div class="table-wrap desktop-table"><table><thead><tr><th>Product</th><th>SKU</th><th>Current stock</th><th>Reorder level</th><th>Status</th><th>Action</th></tr></thead><tbody>${products.map((product) => `
        <tr><td><div class="product-cell">${utils.thumb(product)}<span>${utils.escape(product.name)}<small>${utils.escape(product.brand)} · ${utils.escape(product.size)} / ${utils.escape(product.color)}</small></span></div></td>
        <td class="sku">${utils.escape(product.sku)}</td><td class="stock-number">${product.stockQuantity}</td><td>${product.reorderLevel}</td><td>${utils.statusPill(product)}</td>
        <td><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock In">＋ Stock in</button></td></tr>`).join("")}</tbody></table></div>
      <div class="product-cards">${products.map((product) => `<article class="mobile-product-card"><div class="mobile-product-top">${utils.thumb(product)}<div class="product-cell"><span>${utils.escape(product.name)}<small>${utils.escape(product.sku)}</small></span></div>${utils.statusPill(product)}</div><div class="mobile-product-meta"><div><small>Current stock</small><strong>${product.stockQuantity}</strong></div><div><small>Reorder level</small><strong>${product.reorderLevel}</strong></div></div><button class="btn btn-small" data-action="stock-action" data-id="${utils.escape(product.id)}" data-type="Stock In">＋ Stock in</button></article>`).join("")}</div>` :
      empty("No products need restocking", "Low-stock items will appear here when their quantity reaches the reorder level.")}</section>`;
  }

  function historyTransactions() {
    const filter = state.historyFilters;
    return [...App.state.inventoryTransactions]
      .filter((transaction) => !filter.type || transaction.type === filter.type)
      .filter((transaction) => !filter.productId || transaction.productId === filter.productId)
      .filter((transaction) => {
        const date = new Date(transaction.createdAt);
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function renderHistory() {
    const filter = state.historyFilters;
    const transactions = historyTransactions();
    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
    filter.page = Math.min(filter.page, pageCount);
    const pageItems = transactions.slice((filter.page - 1) * pageSize, filter.page * pageSize);
    const historicProducts = new Map();
    for (const transaction of App.state.inventoryTransactions) {
      const current = App.state.products.find((product) => product.id === transaction.productId);
      historicProducts.set(transaction.productId, {
        id: transaction.productId,
        name: current?.name || transaction.productNameSnapshot,
        sku: current?.sku || transaction.skuSnapshot
      });
    }
    pageContent.innerHTML = `${pageHeading("Inventory history", "A permanent record of stock movements and counted adjustments.")}
      <div class="toolbar">
        <label class="sr-only" for="history-type">Transaction type</label><select class="select" id="history-type" data-history-filter="type"><option value="">All transaction types</option>${["Stock In", "Stock Out", "Stock Adjustment"].map((type) => `<option value="${type}"${filter.type === type ? " selected" : ""}>${type}</option>`).join("")}</select>
        <label class="sr-only" for="history-product">Product</label><select class="select wide-filter" id="history-product" data-history-filter="productId"><option value="">All products</option>${[...historicProducts.values()].sort((a, b) => a.name.localeCompare(b.name)).map((product) => `<option value="${utils.escape(product.id)}"${filter.productId === product.id ? " selected" : ""}>${utils.escape(product.name)} · ${utils.escape(product.sku)}</option>`).join("")}</select>
        <label class="sr-only" for="history-from">From date</label><input class="field" id="history-from" type="date" aria-label="From date" data-history-filter="from" value="${utils.escape(filter.from)}">
        <label class="sr-only" for="history-to">To date</label><input class="field" id="history-to" type="date" aria-label="To date" data-history-filter="to" value="${utils.escape(filter.to)}">
        <button class="btn btn-small" data-action="clear-history-filters">Clear</button>
      </div>
      ${filter.from && filter.to && filter.from > filter.to ? '<p class="form-error" role="alert">Start date must be on or before the end date.</p>' : ""}
      <section class="card table-card"><div class="table-toolbar"><strong>${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}</strong><span class="filter-count">History is read-only</span></div>
      ${transactions.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Quantity</th><th>Previous stock</th><th>New stock</th><th>Notes</th></tr></thead><tbody>${transactionRows(pageItems)}</tbody></table></div>
      <div class="pagination"><span>Showing ${Math.min((filter.page - 1) * pageSize + 1, transactions.length)}–${Math.min(filter.page * pageSize, transactions.length)} of ${transactions.length}</span><div class="pagination-actions"><button class="btn btn-small" data-action="history-page" data-page-number="${filter.page - 1}" ${filter.page <= 1 ? "disabled" : ""}>Previous</button><span class="filter-count">Page ${filter.page} of ${pageCount}</span><button class="btn btn-small" data-action="history-page" data-page-number="${filter.page + 1}" ${filter.page >= pageCount ? "disabled" : ""}>Next</button></div></div>` :
        empty("No transactions found", "Stock movements matching these filters will appear here.")}</section>`;
  }

  function renderSettings() {
    const locked = App.state.products.length > 0;
    pageContent.innerHTML = `${pageHeading("Settings & backup", "Manage how prices display and keep a portable copy of your inventory.")}
      <div class="settings-grid">
        <section class="card settings-card"><h2>Currency</h2><p>Prices and inventory value are displayed in this currency. Changing currency does not convert stored amounts.</p>
          <div class="settings-row"><label for="currency-code"><strong style="font-size:12px">Currency code</strong><small class="field-hint" style="display:block;margin-top:4px">Three-letter ISO code</small></label><input class="field" id="currency-code" maxlength="3" minlength="3" pattern="[A-Za-z]{3}" value="${utils.escape(App.state.settings.currency)}" ${locked ? "disabled" : ""}></div>
          <div class="settings-notice">${locked ? "Currency is locked while product records exist. Delete every product before changing it." : "Currency can be changed while the product catalog is empty."}</div>
          ${locked ? "" : '<div style="margin-top:12px"><button class="btn btn-primary btn-small" data-action="save-currency">Save currency</button></div>'}
        </section>
        <section class="card settings-card"><h2>Backup & restore</h2><p>Export products, stock history, and settings to a JSON file. Restore replaces all current app data after validation and confirmation.</p>
          <div class="backup-actions"><button class="btn btn-primary" data-action="export-backup">↓ Export backup</button><button class="btn" data-action="choose-backup">↑ Restore backup</button><input class="sr-only" type="file" id="backup-file" accept="application/json,.json" aria-label="Select JSON backup"></div>
          <div class="settings-notice">Keep backup files somewhere safe. Browser storage can be cleared with browser data or lost with this device.</div>
        </section>
      </div>
      <div class="disclaimer"><strong>Device-only storage.</strong> This app stores data in this browser on this device. It does not sync between devices or send inventory to a server. Use JSON backups to move or protect your data.</div>`;
  }

  function renderPage() {
    document.querySelector("#page-crumb").textContent = pageNames[state.page];
    document.querySelectorAll(".nav-item[data-page]").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === state.page);
      if (button.dataset.page === "low-stock") {
        button.querySelector(".nav-count").textContent = String(App.dashboard.summary().lowStock);
      }
    });
    document.querySelector("#today-label").textContent = utils.date(new Date());
    ({
      dashboard: renderDashboard,
      products: renderProducts,
      inventory: renderInventory,
      categories: renderCategories,
      "low-stock": renderLowStock,
      history: renderHistory,
      settings: renderSettings
    })[state.page]();
  }

  function navigate(page) {
    if (!pageNames[page]) return;
    state.page = page;
    document.querySelector("#sidebar").classList.remove("open");
    document.querySelector("#sidebar-scrim").classList.remove("open");
    document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
    renderPage();
    pageContent.focus({ preventScroll: true });
  }

  function openDialog(content, focusSelector = null) {
    dialogContent.innerHTML = content;
    dialog.showModal();
    if (focusSelector) dialog.querySelector(focusSelector)?.focus();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function productForm(product = null) {
    const editing = Boolean(product);
    const values = product || {
      name: "", category: App.categories[0], brand: "", size: "", color: "",
      gender: "Unisex", sku: "", purchasePrice: "", sellingPrice: "",
      stockQuantity: 0, reorderLevel: 5, imageUrl: "", description: ""
    };
    openDialog(`
      <form id="product-form" data-id="${utils.escape(product?.id || "")}" novalidate>
        <div class="dialog-header"><div><h2 id="dialog-title">${editing ? "Edit product" : "Add a product"}</h2><p>${editing ? "Update the product details. Stock is managed separately." : "Add one sellable size and color combination to your catalog."}</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
        <div class="form-grid">
          <div class="form-field"><label for="product-name">Product name *</label><input class="field" id="product-name" name="name" maxlength="100" required value="${utils.escape(values.name)}" autocomplete="off"></div>
          <div class="form-field"><label for="product-category">Category *</label><select class="select" id="product-category" name="category" required>${utils.optionList(App.categories, values.category)}</select></div>
          <div class="form-field"><label for="product-brand">Brand *</label><input class="field" id="product-brand" name="brand" maxlength="60" required value="${utils.escape(values.brand)}"></div>
          <div class="form-field"><label for="product-sku">SKU *</label><input class="field" id="product-sku" name="sku" maxlength="60" required value="${utils.escape(values.sku)}" autocomplete="off"><small class="field-hint">Must be unique, regardless of letter case.</small></div>
          <div class="form-field"><label for="product-size">Size *</label><input class="field" id="product-size" name="size" maxlength="30" required placeholder="e.g. M, 32, One Size" value="${utils.escape(values.size)}"></div>
          <div class="form-field"><label for="product-color">Color *</label><input class="field" id="product-color" name="color" maxlength="40" required value="${utils.escape(values.color)}"></div>
          <div class="form-field"><label for="product-gender">Gender *</label><select class="select" id="product-gender" name="gender" required>${utils.optionList(App.genders, values.gender)}</select></div>
          <div class="form-field"><label for="product-reorder">Reorder level *</label><input class="field" id="product-reorder" name="reorderLevel" type="number" min="0" step="1" required value="${utils.escape(values.reorderLevel)}"></div>
          <div class="form-field"><label for="product-purchase">Purchase price (${utils.escape(App.state.settings.currency)}) *</label><input class="field" id="product-purchase" name="purchasePrice" type="number" min="0" step="0.01" required value="${utils.escape(values.purchasePrice)}"></div>
          <div class="form-field"><label for="product-selling">Selling price (${utils.escape(App.state.settings.currency)}) *</label><input class="field" id="product-selling" name="sellingPrice" type="number" min="0" step="0.01" required value="${utils.escape(values.sellingPrice)}"></div>
          ${editing ? `<div class="form-field full"><label>Current stock</label><div class="field" aria-readonly="true">${values.stockQuantity} units · change quantities from Inventory</div></div>` :
          '<div class="form-field"><label for="product-stock">Opening stock *</label><input class="field" id="product-stock" name="stockQuantity" type="number" min="0" step="1" required value="0"><small class="field-hint">Opening stock above zero is logged as Stock In.</small></div>'}
          <div class="form-field${editing ? "" : ""}"><label for="product-image">Product image URL</label><input class="field" id="product-image" name="imageUrl" type="url" maxlength="500" placeholder="https://…" value="${utils.escape(values.imageUrl)}"><small class="field-hint">Optional HTTP or HTTPS image address.</small></div>
          <div class="form-field full"><label for="product-description">Description</label><textarea class="field" id="product-description" name="description" maxlength="1000" placeholder="Optional product details…">${utils.escape(values.description)}</textarea></div>
        </div>
        <p class="form-error" id="form-error" role="alert"></p>
        <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">${editing ? "Save changes" : "Add product"}</button></div>
      </form>`, "#product-name");
  }

  function deleteConfirmation(product) {
    openDialog(`<div class="dialog-header"><div><h2 id="dialog-title">Delete product?</h2><p>This action removes the product from your active catalog.</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
      <p class="confirmation-copy">Delete <strong>${utils.escape(product.name)}</strong> (SKU <strong>${utils.escape(product.sku)}</strong>)? It currently has <strong>${product.stockQuantity} units</strong> on hand.</p>
      <div class="dialog-warning">Past inventory transactions will be preserved with this product’s name and SKU. The SKU can be reused after deletion.</div>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-danger" type="button" data-action="confirm-delete" data-id="${utils.escape(product.id)}">Delete product</button></div>`);
  }

  function productDetails(product) {
    const history = [...App.state.inventoryTransactions]
      .filter((transaction) => transaction.productId === product.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5);
    const fields = [
      ["Product ID", product.id], ["Brand", product.brand], ["Category", product.category], ["Size", product.size],
      ["Color", product.color], ["Gender", product.gender], ["Purchase price", utils.money(product.purchasePrice, App.state.settings.currency)],
      ["Selling price", utils.money(product.sellingPrice, App.state.settings.currency)], ["On-hand stock", `${product.stockQuantity} units`],
      ["Reorder level", `${product.reorderLevel} units`], ["Date added", utils.date(product.dateAdded)],
      ["Last updated", utils.dateTime(product.lastUpdated)]
    ];
    openDialog(`<div class="dialog-header"><div><h2 id="dialog-title">Product details</h2><p>Catalog information and recent stock history</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
      <div class="detail-layout">${utils.thumb(product, true)}<div><h3 class="detail-title">${utils.escape(product.name)}</h3><p class="detail-sku">SKU ${utils.escape(product.sku)}</p><div class="detail-tags">${utils.statusPill(product)}<span class="type-pill">${utils.escape(product.category)}</span></div>
        <div class="detail-grid">${fields.map(([label, value]) => `<div class="detail-item"><small>${utils.escape(label)}</small><strong>${utils.escape(value)}</strong></div>`).join("")}</div>
        ${product.description ? `<p class="detail-description">${utils.escape(product.description)}</p>` : ""}</div></div>
      <section class="detail-history"><h3>Recent inventory history</h3>${history.length ? history.map((transaction) => `<div class="detail-history-row"><span>${utils.dateTime(transaction.createdAt)}<br>${transactionType(transaction.type)}</span><span>${transaction.type === "Stock Adjustment" && transaction.quantity > 0 ? "+" : ""}${transaction.quantity}</span><strong>${transaction.previousStock} → ${transaction.newStock}</strong></div>`).join("") : '<p class="field-hint">No inventory movements recorded.</p>'}</section>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Close</button><button class="btn" type="button" data-action="edit-from-detail" data-id="${utils.escape(product.id)}">Edit</button><button class="btn btn-primary" type="button" data-action="stock-action-from-detail" data-id="${utils.escape(product.id)}" data-type="Stock In">Stock movement</button></div>`);
  }

  function movementDialog(productId = "", type = "Stock In") {
    const product = App.state.products.find((item) => item.id === productId);
    const options = [...App.state.products].sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => `<option value="${utils.escape(item.id)}"${item.id === productId ? " selected" : ""}>${utils.escape(item.name)} · ${utils.escape(item.sku)} (${item.stockQuantity} on hand)</option>`).join("");
    const currentType = ["Stock In", "Stock Out", "Stock Adjustment"].includes(type) ? type : "Stock In";
    openDialog(`<form id="movement-form" data-product-id="${utils.escape(productId)}" novalidate>
      <div class="dialog-header"><div><h2 id="dialog-title">Record stock movement</h2><p>Every change is added to the permanent inventory history.</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>
      ${App.state.products.length ? `<div class="form-grid">
        <div class="form-field full"><label for="movement-product">Product *</label><select class="select" id="movement-product" name="productId" required><option value="">Choose a product</option>${options}</select></div>
        <div class="form-field"><label for="movement-type">Transaction type *</label><select class="select" id="movement-type" name="type">${["Stock In", "Stock Out", "Stock Adjustment"].map((value) => `<option value="${value}"${value === currentType ? " selected" : ""}>${value}</option>`).join("")}</select></div>
        <div class="form-field" id="movement-quantity-field"><label for="movement-quantity">Quantity to ${currentType === "Stock Out" ? "remove" : "add"} *</label><input class="field" id="movement-quantity" name="quantity" type="number" min="1" step="1" value="1"></div>
        <div class="form-field" id="movement-count-field" hidden><label for="movement-count">New counted quantity *</label><input class="field" id="movement-count" name="newCount" type="number" min="0" step="1" value="${product ? product.stockQuantity : 0}"><small class="field-hint">Current quantity: <span id="movement-current-stock">${product ? product.stockQuantity : "select a product"}</span>. History records the difference.</small></div>
        <div class="form-field full"><label for="movement-notes">Notes (optional)</label><textarea class="field" id="movement-notes" name="notes" maxlength="500" placeholder="Reason or reference…"></textarea></div>
      </div><p class="form-error" id="form-error" role="alert"></p>
      <div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">Save movement</button></div>` :
      `<div class="dialog-header"><div><h2 id="dialog-title">No products yet</h2><p>Add a product before recording stock movements.</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">×</button></div>${empty("Inventory is empty", "Add a product to begin recording stock.", '<button class="btn btn-primary btn-small" type="button" data-action="create-product-from-empty">Add product</button>')}<div class="dialog-actions"><button class="btn" type="button" data-action="close-dialog">Close</button></div>`}
      </form>`, App.state.products.length ? "#movement-product" : null);
    updateMovementFields();
  }

  function updateMovementFields() {
    const form = document.querySelector("#movement-form");
    if (!form) return;
    const type = form.elements.type?.value;
    const isAdjustment = type === "Stock Adjustment";
    document.querySelector("#movement-quantity-field").hidden = isAdjustment;
    document.querySelector("#movement-count-field").hidden = !isAdjustment;
    const product = App.state.products.find((item) => item.id === form.elements.productId.value);
    const count = document.querySelector("#movement-count");
    const current = document.querySelector("#movement-current-stock");
    if (current) current.textContent = product ? String(product.stockQuantity) : "select a product";
    if (count && product && !count.dataset.touched) count.value = String(product.stockQuantity);
    const label = document.querySelector('label[for="movement-quantity"]');
    if (label) label.textContent = `Quantity to ${type === "Stock Out" ? "remove" : "add"} *`;
  }

  function showFormError(message) {
    const target = document.querySelector("#form-error");
    if (target) target.textContent = message;
  }

  function markDataStale() {
    state.stale = true;
    document.querySelector("#stale-banner").hidden = false;
    if (dialog.open && !dialogContent.querySelector(".stale-dialog-notice")) {
      dialogContent.insertAdjacentHTML("afterbegin", `<div class="dialog-warning stale-dialog-notice" role="alert">Inventory changed in another tab. This draft is preserved but cannot be saved until you reload. <button class="btn btn-small" id="reload-data-dialog" type="button">Reload data</button></div>`);
    }
  }

  function preserveFocusAndRender(render) {
    const active = document.activeElement;
    const focusData = active?.dataset?.productFilter
      ? ["productFilter", active.dataset.productFilter]
      : active?.dataset?.historyFilter
        ? ["historyFilter", active.dataset.historyFilter]
        : active?.dataset?.inventorySearch !== undefined
          ? ["inventorySearch", ""]
          : null;
    const selection = active && typeof active.selectionStart === "number"
      ? [active.selectionStart, active.selectionEnd]
      : null;
    render();
    if (!focusData) return;
    const selector = focusData[0] === "productFilter"
      ? `[data-product-filter="${focusData[1]}"]`
      : focusData[0] === "historyFilter"
        ? `[data-history-filter="${focusData[1]}"]`
        : "[data-inventory-search]";
    const next = pageContent.querySelector(selector);
    next?.focus();
    if (selection && next?.setSelectionRange) next.setSelectionRange(...selection);
  }

  function performAction(action, button) {
    const id = button.dataset.id;
    const product = App.state.products.find((item) => item.id === id);
    switch (action) {
      case "new-product": productForm(); break;
      case "edit-product": if (product) productForm(product); break;
      case "view-product": if (product) productDetails(product); break;
      case "product-menu-delete": if (product) deleteConfirmation(product); break;
      case "confirm-delete":
        try {
          const removed = App.products.remove(id);
          closeDialog();
          utils.toast(`${removed.name} was deleted. Its inventory history was preserved.`);
          renderPage();
        } catch (error) { showFormError(error.message); utils.toast(error.message, "error"); }
        break;
      case "edit-from-detail": if (product) { closeDialog(); productForm(product); } break;
      case "stock-action": movementDialog(id, button.dataset.type); break;
      case "stock-action-from-detail": closeDialog(); movementDialog(id, button.dataset.type); break;
      case "new-stock-movement": movementDialog(); break;
      case "create-product-from-empty": closeDialog(); productForm(); break;
      case "close-dialog": closeDialog(); break;
      case "products-page":
        state.productFilters.page = Number(button.dataset.pageNumber) || 1;
        renderProducts();
        break;
      case "history-page":
        state.historyFilters.page = Number(button.dataset.pageNumber) || 1;
        renderHistory();
        break;
      case "clear-product-filters":
        state.productFilters = { search: "", category: "", brand: "", size: "", color: "", status: "", sort: "name", direction: "asc", page: 1 };
        renderProducts();
        break;
      case "clear-history-filters":
        state.historyFilters = { type: "", productId: "", from: "", to: "", page: 1 };
        renderHistory();
        break;
      case "open-category":
        state.productFilters.category = button.dataset.category;
        state.productFilters.page = 1;
        navigate("products");
        break;
      case "export-backup": exportBackup(); break;
      case "choose-backup": document.querySelector("#backup-file").click(); break;
      case "save-currency": saveCurrency(); break;
      default: break;
    }
  }

  function exportBackup() {
    try {
      const backup = new Blob([JSON.stringify(App.state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(backup);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `threadline-inventory-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      utils.toast("Inventory backup exported.");
    } catch (error) {
      console.error("Backup export failed", error);
      utils.toast(`Backup export failed: ${error.message}`, "error");
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      utils.toast("Backup file is larger than 10 MB.", "error");
      return;
    }
    try {
      const replacement = App.storage.importBackup(await file.text());
      const confirmed = window.confirm(
        `Restore this backup and replace all current app data?\n\n` +
        `${replacement.products.length} products · ${replacement.inventoryTransactions.length} inventory transactions · Currency ${replacement.settings.currency}\n\n` +
        "This cannot be undone. Export a backup of current data first if needed."
      );
      if (!confirmed) return;
      if (state.stale) throw new Error("Inventory changed in another tab. Reload before restoring a backup.");
      App.storage.save(replacement);
      App.state = replacement;
      state.page = "dashboard";
      renderPage();
      utils.toast("Backup restored successfully.");
    } catch (error) {
      console.error("Backup restore failed", error);
      utils.toast(`Backup restore failed: ${error.message}`, "error");
    } finally {
      document.querySelector("#backup-file").value = "";
    }
  }

  function saveCurrency() {
    if (state.stale) {
      utils.toast("Reload the inventory before saving changes.", "error");
      return;
    }
    const input = document.querySelector("#currency-code");
    const currency = input.value.trim().toUpperCase();
    if (!utils.isCurrencyCode(currency)) {
      utils.toast("Enter a valid three-letter ISO currency code, such as PHP.", "error");
      input.focus();
      return;
    }
    if (App.state.products.length > 0) {
      utils.toast("Currency cannot be changed while product records exist.", "error");
      return;
    }
    const next = JSON.parse(JSON.stringify(App.state));
    next.settings.currency = currency;
    try {
      App.storage.save(next);
      App.state = next;
      renderPage();
      utils.toast(`Currency set to ${currency}. Stored amounts were not converted.`);
    } catch (error) {
      utils.toast(error.message, "error");
    }
  }

  function requiredNumber(form, name, label, integer = false) {
    const input = form.elements[name];
    if (!input || input.value.trim() === "") throw new Error(`${label} is required.`);
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) throw new Error(`${label} must be a valid number.`);
    if (integer && !Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
    return value;
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#reload-data-dialog")) {
      window.location.reload();
      return;
    }
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      navigate(pageButton.dataset.page);
      return;
    }
    const sortButton = event.target.closest("[data-sort]");
    if (sortButton) {
      const key = sortButton.dataset.sort;
      if (state.productFilters.sort === key) {
        state.productFilters.direction = state.productFilters.direction === "asc" ? "desc" : "asc";
      } else {
        state.productFilters.sort = key;
        state.productFilters.direction = "asc";
      }
      state.productFilters.page = 1;
      renderProducts();
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) performAction(actionButton.dataset.action, actionButton);
  });

  pageContent.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-product-filter]")) {
      state.productFilters[input.dataset.productFilter] = input.value;
      state.productFilters.page = 1;
      preserveFocusAndRender(renderProducts);
    } else if (input.matches("[data-inventory-search]")) {
      state.inventorySearch = input.value;
      preserveFocusAndRender(renderInventory);
    }
  });

  pageContent.addEventListener("change", (event) => {
    const input = event.target;
    if (input.matches("[data-product-filter]")) {
      state.productFilters[input.dataset.productFilter] = input.value;
      state.productFilters.page = 1;
      renderProducts();
    } else if (input.matches("[data-history-filter]")) {
      state.historyFilters[input.dataset.historyFilter] = input.value;
      state.historyFilters.page = 1;
      renderHistory();
    }
  });

  dialogContent.addEventListener("input", (event) => {
    if (event.target.id === "movement-count") event.target.dataset.touched = "true";
    if (event.target.closest("form") && document.querySelector("#form-error")) showFormError("");
  });

  dialogContent.addEventListener("change", (event) => {
    if (event.target.id === "movement-type" || event.target.id === "movement-product") updateMovementFields();
  });

  dialogContent.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) performAction(actionButton.dataset.action, actionButton);
  });

  dialogContent.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.stale) {
      showFormError("Inventory changed in another tab. Your draft is preserved; reload before saving.");
      return;
    }
    const form = event.target;
    if (form.id === "product-form") {
      try {
        const data = new FormData(form);
        const id = form.dataset.id;
        const input = {
          name: data.get("name"),
          category: data.get("category"),
          brand: data.get("brand"),
          size: data.get("size"),
          color: data.get("color"),
          gender: data.get("gender"),
          sku: data.get("sku"),
          purchasePrice: requiredNumber(form, "purchasePrice", "Purchase price"),
          sellingPrice: requiredNumber(form, "sellingPrice", "Selling price"),
          reorderLevel: requiredNumber(form, "reorderLevel", "Reorder level", true),
          stockQuantity: id ? undefined : requiredNumber(form, "stockQuantity", "Opening stock", true),
          imageUrl: data.get("imageUrl") || "",
          description: data.get("description") || ""
        };
        const saved = App.products.save(input, id);
        closeDialog();
        renderPage();
        utils.toast(id ? `${saved.name} was updated.` : `${saved.name} was added.`);
      } catch (error) {
        showFormError(error.message);
      }
    } else if (form.id === "movement-form") {
      try {
        const type = form.elements.type.value;
        const productId = form.elements.productId.value;
        if (!productId) throw new Error("Choose a product.");
        const movement = {
          productId,
          type,
          notes: form.elements.notes.value
        };
        if (type === "Stock Adjustment") {
          movement.newCount = requiredNumber(form, "newCount", "Counted stock", true);
        } else {
          movement.quantity = requiredNumber(form, "quantity", "Quantity", true);
        }
        const transaction = App.inventory.recordMovement(movement);
        closeDialog();
        renderPage();
        utils.toast(`${transaction.type} recorded. New stock: ${transaction.newStock}.`);
      } catch (error) {
        showFormError(error.message);
      }
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "backup-file") importBackup(event.target.files[0]);
  });

  document.querySelector("#menu-toggle").addEventListener("click", () => {
    const open = document.querySelector("#sidebar").classList.toggle("open");
    document.querySelector("#sidebar-scrim").classList.toggle("open", open);
    document.querySelector("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  document.querySelector("#sidebar-scrim").addEventListener("click", () => {
    document.querySelector("#sidebar").classList.remove("open");
    document.querySelector("#sidebar-scrim").classList.remove("open");
    document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
  });
  document.querySelector("#reload-data").addEventListener("click", () => window.location.reload());

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="save-currency"]')) saveCurrency();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== App.storage.key && event.key !== null) return;
    if (event.newValue === null) {
      markDataStale();
      utils.toast("Inventory storage was cleared in another tab. Reload to continue.", "error");
      return;
    }
    if (dialog.open) {
      markDataStale();
      return;
    }
    try {
      App.state = App.storage.validateState(JSON.parse(event.newValue));
      renderPage();
      utils.toast("Inventory refreshed from another tab.");
    } catch (error) {
      console.error("Could not refresh inventory from another tab", error);
      utils.toast(`Could not refresh inventory: ${error.message}`, "error");
    }
  });

  try {
    App.state = App.storage.load();
    renderPage();
  } catch (error) {
    console.error("Application could not initialize", error);
    pageContent.innerHTML = `<section class="card section-card" role="alert"><h1>Inventory could not be loaded</h1><p>${utils.escape(error.message)}</p><p>Saved information has not been replaced. Check browser storage access or restore a valid backup.</p><button class="btn" type="button" onclick="window.location.reload()">Try again</button></section>`;
  }
})();
