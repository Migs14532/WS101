# Apparel Inventory

The Apparel Inventory context manages sellable clothing items and their on-hand quantities for a single operator. It gives the operator a consistent vocabulary for products, stock movements, and replenishment.

## Products and stock

**Product**:
A sellable clothing item identified by its SKU and specific size and color. A different size or color is a separate product record.

**SKU**:
The business-assigned code that identifies one sellable product.

**On-hand stock**:
The number of individual units currently recorded as available in inventory.
_Avoid_: Inventory level, stock balance (when referring to the item count)

**Reorder level**:
The on-hand quantity threshold at or below which a product with remaining stock is considered low stock.

**Stock status**:
The product's inventory condition: out of stock at zero units, low stock above zero and at or below its reorder level, or in stock above its reorder level.

## Inventory movements

**Inventory transaction**:
An immutable record of a change to a product's on-hand stock, including the before-and-after quantities.
_Avoid_: Inventory activity (when referring to the recorded transaction)

**Stock In**:
An inventory transaction that increases a product's on-hand stock.

**Stock Out**:
An inventory transaction that decreases a product's on-hand stock.

**Stock Adjustment**:
An inventory transaction that reconciles recorded stock to a newly counted physical quantity.

## Pricing

**Purchase price**:
The per-unit cost used to value the stock currently on hand.

**Selling price**:
The per-unit price offered to a customer; it may be lower than the purchase price.

**Inventory value**:
The purchase-price value of on-hand stock, calculated from each product's purchase price and quantity.
