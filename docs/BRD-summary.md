# Business requirements summary

Purpose: one standardized, role-based dashboard showing handset stock and sales for 10 Jazz Experience Centers: Faisalabad, Gujranwala, Islamabad, KHI Jazz House, KHI North Nazimabad (KHI NNZ), Lahore Eden, Lahore Jazz House, Multan, Peshawar, Rahim Yar Khan (RYK). Must scale to additional centers later.

- Inventory visibility: available quantity at Experience Center -> Brand -> Model -> Color (-> Specifications).
- Sales visibility: Real-time (if possible) or Day-1 sales, MTD (current calendar month), YTD (1 Jan to date). Analyzable by Center, Brand, Model, Color, Date.
- Main dashboard: one row per center with Available Qty, Day-1 Sales, MTD, YTD, plus a Total row. Drill-down: Center -> Brand -> Model -> Color -> Specifications. Brand-wise, Model-wise, and Color-wise views each show Available Qty, Day-1, MTD, YTD.
- KPIs: Total Available Handsets, Day-1 Sales, MTD, YTD; additional: brand contribution, model contribution, stock-to-sales ratio, fast-moving, low-stock, zero-stock models, center-wise sales contribution.
- Filters (combinable): Date, Experience Center, Sales Type (Cash / Installment / FNF), Product-wise (Cash / Installment / FNF), Cluster, Brand, Model, Specifications, Color, Stock Status, Sales Period, Dispatched from Warehouse, Dispatched from Experience Center.
- Roles: Head of Experience Centers (view, centralized performance and support), Cluster Heads (view), Experience Center Supervisor (view/edit, assigned center only), Experience Center Manager (view/edit, assigned center only), Other Stakeholders (view only, where approved). Access must be configurable per role. View-only users cannot modify data; may export if permitted. Editors can add/update inventory, update master data where applicable, correct permitted fields.
- Data refresh: near-real-time preferred; otherwise an agreed frequency (real-time / hourly / daily). The last refresh date/time must be visible on the dashboard.
- Validation: unique handset/model identification, standardized brand/model/color masters, duplicate prevention, stock quantity validation.
- Audit trail for every edit: user ID, timestamp, field changed, previous value, new value.
- Export: Excel, CSV, PDF, reflecting the applied filters.
- Customer feedback capture is mentioned in the title but not specified; do not build it yet.
- Journeys: (view) Login -> select center -> brand -> model -> color -> stock -> Day-1 -> MTD -> YTD. (edit) Login -> assigned center -> update permitted data -> save -> system validates -> audit trail generated -> dashboard updated.
