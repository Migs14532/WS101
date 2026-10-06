# Model sellable SKUs and preserve stock movements

Each product record represents one sellable size-and-color SKU, rather than a parent style with variants. Stock changes happen through Stock In, Stock Out, or count-based Stock Adjustment transactions; transaction history is immutable and preserves product/SKU snapshots. This keeps quantities auditable and avoids untracked edits to a style-level total.
