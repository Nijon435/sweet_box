# Inventory Updates Required

## Summary

1. ✅ Database schema updated (unit & reorder_point columns removed)
2. ✅ Seeds data updated (unit & reorder_point removed from INSERT)
3. ⏳ Fix category matching for "Cakes & Pastries"
4. ⏳ Add scrollable tbody with max 10 items visible
5. ⏳ Add ingredient usage/removal feature
6. ⏳ Update inventory.js to remove unit/reorder_point logic
7. ⏳ Update inventory.html form fields

## Remaining Tasks

### Task 1: Fix Category Name Matching

**Problem**: Category in dropdown says "cakes" but database has "cakes & pastries"

**Solution**: Update inventory.html line ~99

```html
<!-- FROM: -->
<option value="cakes">Cakes & Pastries</option>

<!-- TO: -->
<option value="cakes & pastries">Cakes & Pastries</option>
```

Also update table data-category attribute line ~165:

```html
<!-- FROM: -->
<table class="inventory-table" data-category="cakes">
  <!-- TO: -->
  <table class="inventory-table" data-category="cakes & pastries"></table>
</table>
```

### Task 2: Make Tables Scrollable (Max 10 Items)

**Add to design.css**:

```css
.inventory-table tbody {
  display: block;
  max-height: 500px; /* ~10 rows */
  overflow-y: auto;
}

.inventory-table thead,
.inventory-table tbody tr {
  display: table;
  width: 100%;
  table-layout: fixed;
}

.inventory-table thead {
  width: calc(100% - 17px); /* Account for scrollbar */
}
```

### Task 3: Add Ingredient Usage Feature

**Add to inventory.html** (after Ingredients table, around line 201):

```html
<article class="card" style="margin-top: 1.5rem;">
  <div class="section-heading">
    <h2>Use Ingredients</h2>
    <span class="pill">Staff Access</span>
  </div>
  <form id="ingredient-usage-form">
    <label for="ingredient-select">Select Ingredient</label>
    <select id="ingredient-select" name="ingredientId" required>
      <option value="">Choose ingredient...</option>
    </select>

    <label for="usage-qty">Quantity to Use</label>
    <input
      id="usage-qty"
      name="quantity"
      type="number"
      min="0.1"
      step="0.1"
      required
    />

    <label for="usage-reason">Reason (Optional)</label>
    <input
      id="usage-reason"
      name="reason"
      placeholder="e.g., Baking batch #5"
    />

    <button class="btn btn-primary" type="submit">Record Usage</button>
  </form>
</article>
```

### Task 4: Update inventory.js

**Remove all references to**:

- `item.unit`
- `item.reorderPoint`
- Line ~87: `updated.reorderPoint = Math.max(1, Math.round(updated.quantity * 0.3));`

**Add ingredient usage handler**:

```javascript
// Add after renderInventory function
function setupIngredientUsageForm() {
  const form = document.getElementById("ingredient-usage-form");
  const select = document.getElementById("ingredient-select");

  if (!form || !select) return;

  // Populate ingredient dropdown
  const ingredients = appState.inventory.filter(
    (i) => i.category === "ingredients"
  );
  select.innerHTML = '<option value="">Choose ingredient...</option>';
  ingredients.forEach((ing) => {
    const opt = document.createElement("option");
    opt.value = ing.id;
    opt.textContent = `${ing.name} (Available: ${ing.quantity})`;
    select.appendChild(opt);
  });

  if (form.dataset.bound) return;
  form.dataset.bound = "true";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const ingredientId = data.get("ingredientId");
    const qty = Number(data.get("quantity"));
    const reason = data.get("reason");

    const idx = appState.inventory.findIndex((i) => i.id === ingredientId);
    if (idx < 0) {
      alert("Ingredient not found");
      return;
    }

    if (appState.inventory[idx].quantity < qty) {
      alert(
        `Insufficient quantity. Available: ${appState.inventory[idx].quantity}`
      );
      return;
    }

    appState.inventory[idx].quantity -= qty;

    // Record usage
    const usageRecord = {
      id: "usage-" + Date.now(),
      label: appState.inventory[idx].name,
      used: qty,
      reason: reason || "Staff usage",
      timestamp: new Date().toISOString(),
    };

    if (!appState.inventoryUsage) appState.inventoryUsage = [];
    appState.inventoryUsage.push(usageRecord);

    saveState();
    syncStateToDatabase();
    renderInventory();
    setupIngredientUsageForm(); // Refresh dropdown
    form.reset();

    alert(`Recorded: ${qty} of ${appState.inventory[idx].name} used`);
  });
}

// Call this in renderInventory at the end:
setupIngredientUsageForm();
```

### Task 5: Run Database Migrations

**Local**:

```powershell
psql -U postgres -d sweetbox -f sql/schema.sql
psql -U postgres -d sweetbox -f sql/seeds.sql
```

**Render**:

```powershell
$env:PGPASSWORD="ffPN9al0kWbmuygYlbTs9221nlGtLjw6"
psql -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_user -d sweetbox -f sql/schema.sql
psql -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_user -d sweetbox -f sql/seeds.sql
```

## Testing Checklist

- [ ] Cakes & Pastries items show up in correct table
- [ ] Tables scroll after 10 items
- [ ] Ingredient usage form appears and works
- [ ] Can deduct ingredient quantities
- [ ] No errors about missing unit/reorder_point fields
- [ ] Changes sync to database
- [ ] Works on both local and production

## Implementation Order

1. Fix category name in HTML dropdown & table
2. Update CSS for scrollable tables
3. Add ingredient usage HTML form
4. Update inventory.js logic
5. Test locally
6. Run database migrations locally
7. Commit and push
8. Run database migrations on Render
9. Test production
