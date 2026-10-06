(() => {
  "use strict";
  const App = (window.App = window.App || {});
  App.categories = [
    "T-Shirts", "Polo Shirts", "Hoodies", "Jackets", "Pants", "Jeans",
    "Shorts", "Dresses", "Skirts", "Activewear", "Accessories", "Other"
  ];
  App.genders = ["Men", "Women", "Unisex", "Kids", "Other"];
  App.utils = {
    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[char]);
    },
    id(prefix) {
      const value = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
      return `${prefix}-${value}`;
    },
    normalizeSku(value) {
      return String(value ?? "").trim().toUpperCase();
    },
    money(value, currency) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency", currency: currency || "PHP", maximumFractionDigits: 2
        }).format(Number(value) || 0);
      } catch (error) {
        console.error("Unable to format currency", error);
        return `${currency || "PHP"} ${(Number(value) || 0).toFixed(2)}`;
      }
    },
    isCurrencyCode(value) {
      const code = String(value ?? "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return false;
      if (typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf("currency").includes(code);
      }
      try {
        new Intl.NumberFormat(undefined, { style: "currency", currency: code });
        return true;
      } catch {
        return false;
      }
    },
    date(value, options = { year: "numeric", month: "short", day: "numeric" }) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, options).format(date);
    },
    dateTime(value) {
      return this.date(value, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    },
    status(product) {
      if (product.stockQuantity === 0) return { key: "out", label: "Out of stock", className: "status-out" };
      if (product.stockQuantity <= product.reorderLevel) return { key: "low", label: "Low stock", className: "status-low" };
      return { key: "in", label: "In stock", className: "status-in" };
    },
    statusPill(product) {
      const status = this.status(product);
      return `<span class="status-pill ${status.className}">${status.label}</span>`;
    },
    imageUrl(value) {
      const url = String(value ?? "").trim();
      if (!url) return "";
      try {
        const parsed = new URL(url);
        return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
      } catch {
        return "";
      }
    },
    thumb(product, large = false) {
      const image = this.imageUrl(product.imageUrl);
      const className = large ? "detail-image" : "product-thumb";
      return image
        ? `<span class="${className}"><img src="${this.escape(image)}" alt="${this.escape(product.name)}" loading="lazy"></span>`
        : `<span class="${className}${large ? " detail-placeholder" : ""}" aria-hidden="true">♧</span>`;
    },
    toast(message, type = "success") {
      const region = document.querySelector("#toast-region");
      if (!region) return;
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.textContent = message;
      region.append(toast);
      window.setTimeout(() => toast.remove(), 4200);
    },
    optionList(values, selected = "", includeAll = false) {
      const first = includeAll ? '<option value="">All</option>' : "";
      return first + values.map((value) =>
        `<option value="${this.escape(value)}"${value === selected ? " selected" : ""}>${this.escape(value)}</option>`
      ).join("");
    },
    isValidIsoDate(value) {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return false;
      try {
        return new Date(value).toISOString() === value;
      } catch {
        return false;
      }
    }
  };
})();
