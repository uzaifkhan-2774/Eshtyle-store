# Bulk product import (CSV)

Admin → Products → **Import CSV**. The file is checked first (dry run); nothing changes until you click **Import now**. One row per **variant**; rows sharing a `product_sku` become one product. Existing SKUs are updated.

| Column | Required | Example |
|---|---|---|
| product_sku | yes | ESH-0047 |
| name | yes | Black Clover Station Necklace |
| slug | no | black-clover-station-necklace |
| category_slug | yes | necklaces (must exist) |
| status | no | published / draft / archived (default draft) |
| short_description | no | Onyx-black clovers on a fine chain. |
| tags | no | clover\|bestseller |
| colour, finish, material | no | Black & Gold · Gold-tone · |
| variant_sku | yes | ESH-0047 |
| variant_title | no | Default |
| price_inr | yes | 449 |
| compare_at_inr | no | 599 (must be higher than price; only for a genuine reduction) |
| stock | yes | 12 |
| image_urls | no | https://res.cloudinary.com/...jpg\|https://... |

Tip: **Export CSV** first, edit prices/stock in a spreadsheet, and import it back.
