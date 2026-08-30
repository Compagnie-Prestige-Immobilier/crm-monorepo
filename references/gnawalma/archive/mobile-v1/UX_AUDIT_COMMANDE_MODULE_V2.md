# UX AUDIT: Module Commande - Gnawalma (REVISED)
**Date:** 2026-02-12
**Context:** Senegalese Tailor Shop Management
**Scope:** New Order Flow (`/orders/new`)

---

## 🎯 UNDERSTANDING THE REAL WORKFLOW

**A Senegalese Tailor's Reality:**
- Client walks in: "Salam! Je veux faire coudre un boubou pour moi, 2 robes pour mes filles, et un pantalon pour mon fils"
- ONE client, MULTIPLE garments, ONE order, ONE delivery date
- Some garments use client's fabric (they bring), others from tailor's stock
- Returning clients already have measurements on file
- Partial deposit (acompte) is standard, rest paid on delivery
- Delivery date is critical (wedding, baptême, etc.)

**The 3-step flow actually makes sense:**
1. **Client** - Who's ordering (the person paying)
2. **Panier** - Build all garments for this order (could be 1-5+ items)
3. **Paiement** - Deposit + delivery date

**My first audit was WRONG** - I thought "Panier" was misleading, but it's actually correct for this workflow!

---

## 🔴 CRITICAL ISSUES (REAL ONES)

### 1. **Bottom Snackbars Are Intrusive**
**Severity:** CRITICAL
**Location:** Multiple files

**Found Snackbars:**
```dart
// payment_step.dart:609-612 (Delivery date error)
ScaffoldMessenger.of(context).showSnackBar(
  const SnackBar(
    content: Text('Veuillez sélectionner une date de livraison'),
    backgroundColor: Colors.red,
  ),
);

// app_toast.dart:34-79 (All feedback)
scaffoldMessenger.showSnackBar(
  SnackBar(
    behavior: SnackBarBehavior.floating,  // ❌ BOTTOM SNACKBAR
    margin: const EdgeInsets.all(16),
    // ...
  ),
);

// Used in:
// - new_order_provider.dart:207 → "Veuillez remplir les informations"
// - new_order_provider.dart:212 → "Veuillez sélectionner un tissu"
// - new_order_provider.dart:243-247 → "Article ajouté" (success toast)
// - new_order_provider.dart:309 → "Ajouter au moins un article"
// - new_order_provider.dart:314 → "Sélectionner date de livraison"
// - new_order_provider.dart:385-388 → "Commande Créée" (success)
// - new_order_provider.dart:392 → "Erreur lors de création"
```

**Problems:**
1. **Covers bottom action bar** - Users can't see "Ajouter cet article" button when toast appears
2. **Floating snackbars feel temporary** - Important errors disappear after 3s
3. **No visual connection** to the field with error
4. **Interrupts flow** - User fills form, clicks button, snackbar pops up, they forget what they were doing

**Better Alternatives:**
- **Inline validation** - Show error under the specific field
- **Dialog for critical errors** - Forces acknowledgment
- **Top banner** - Doesn't cover action buttons
- **Success: Haptic + visual state change** - No toast needed when button changes to ✓

**Recommendations:**
```dart
// REMOVE all SnackBars, replace with:

// 1. Inline field validation (already exists for price field!)
AppTextField(
  validator: (value) => value.isEmpty ? 'Champ requis' : null,
)

// 2. For cart addition success - NO TOAST, just haptic + visual feedback
void addItemToCart() {
  // ... validation ...

  state = state.copyWith(cartItems: [...state.cartItems, project]);

  // ❌ REMOVE: AppFeedback.showToast(...)

  // ✅ ADD: Haptic feedback
  HapticFeedback.mediumImpact();

  // Cart summary auto-updates, user sees count increase - that's enough!
  _resetItemBuilder();
}

// 3. For critical errors - use AlertDialog instead of SnackBar
if (state.cartItems.isEmpty) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.warning),
          SizedBox(width: 8),
          Text('Panier vide'),
        ],
      ),
      content: Text('Ajoutez au moins un article avant de continuer.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Compris'),
        ),
      ],
    ),
  );
  return false;
}

// 4. For order creation success - Navigate immediately, no toast
final success = await notifier.createOrder();
if (success && context.mounted) {
  // ❌ REMOVE: AppFeedback.showSuccess(...)
  // ✅ Just navigate - arrival at dashboard confirms success
  context.go(AppRoutes.shell);
}
```

---

### 2. **Button Labels Don't Match Senegalese French**
**Severity:** HIGH
**Location:** `orders/widgets/order_bottom_bar.dart:29-69`

**Problem:**
```dart
ElevatedButton.icon(
  label: const Text('Ajouter cet article'),  // ❌ Formal/textbook French
),
ElevatedButton.icon(
  label: const Text('Terminer'),  // ❌ Ambiguous
),
```

**Issues:**
1. **"Ajouter cet article"** - Sounds textbook, not natural
2. **"Terminer"** - Finish what? The item? The cart? The order?
3. **No indication of cart state** - How many items already in cart?

**In Senegalese French:**
- "Mettre dans le panier" or just "Ajouter"
- "Continuer" or "Passer au paiement"
- Should show cart count: "(3 articles)"

**Recommendations:**
```dart
// Primary action: Add item
Expanded(
  child: ElevatedButton.icon(
    icon: Icon(Icons.add_shopping_cart),
    label: Text('Ajouter'),  // ✓ Simple, clear
    // OR: 'Mettre au panier'
  ),
),

// Secondary action: Continue (only if cart has items)
if (state.cartItems.isNotEmpty) ...[
  SizedBox(width: AppSpacing.md),
  SizedBox(
    height: 56,
    child: OutlinedButton(  // ✓ Secondary style
      child: Row(
        children: [
          Text('Continuer'),
          SizedBox(width: 4),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${state.cartItems.length}',  // ✓ Shows count!
              style: TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
        ],
      ),
      onPressed: notifier.nextStep,
    ),
  ),
],
```

---

### 3. **Measurements: Wrong Approach**
**Severity:** HIGH
**Location:** `item_builder_step.dart:77-81`

**Current:**
```dart
const CollapsibleSection(
  title: '5. MESURES DU CLIENT',
  initiallyExpanded: false,  // Hidden by default
  child: OrderMeasurementSection(),
),
```

**The Real Problem:**
- **Returning clients** - Measurements already on file! Why show this section?
- **New clients** - Measurements ARE critical, why hide them?
- **Beneficiaries** - Different person = different measurements

**Smart Logic Needed:**
```dart
// If selectedBeneficiary has measurements → Don't show section, show badge instead
// If selectedClient (for "Moi-même") has measurements → Show badge + "Utiliser mesures enregistrées"
// If NO measurements → FORCE expand + show warning

Widget _buildMeasurementsSection() {
  final hasMeasurements = state.selectedForWhom == 'Moi-même'
      ? state.selectedClient?.latestMeasurement != null
      : state.selectedBeneficiary?.measurements != null;

  if (hasMeasurements) {
    // Compact: Just show badge + toggle
    return Container(
      padding: EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle, color: AppColors.success),
          SizedBox(width: 8),
          Expanded(
            child: Text('Mesures disponibles pour ${state.selectedForWhom}'),
          ),
          TextButton(
            child: Text('Modifier'),
            onPressed: () => setState(() => showMeasurements = true),
          ),
        ],
      ),
    );
  } else {
    // NO measurements → FORCE show + warn
    return Column(
      children: [
        Container(
          padding: EdgeInsets.all(AppSpacing.sm),
          color: AppColors.warning.withValues(alpha: 0.15),
          child: Row(
            children: [
              Icon(Icons.warning_amber, color: AppColors.warning, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Aucune mesure enregistrée. Ajoutez-les maintenant ou plus tard.',
                  style: TextStyle(fontSize: 13),
                ),
              ),
            ],
          ),
        ),
        // Always expanded if no measurements
        OrderMeasurementSection(),
      ],
    );
  }
}
```

---

### 4. **Delivery Date: Pre-Validation Error State**
**Severity:** MEDIUM-HIGH
**Location:** `payment_step.dart:272-339`

**Problem:**
```dart
Container(
  decoration: BoxDecoration(
    border: Border.all(
      color: state.deliveryDate == null
          ? Colors.red[300]!  // ❌ Shows red BEFORE user tries!
          : context.borderColor,
      width: state.deliveryDate == null ? 2 : 1,
    ),
  ),
  // ...
)

Text(
  state.deliveryDate == null
      ? 'Sélectionner une date *'  // ❌ Red asterisk before attempt
      : DateFormat('EEEE dd MMMM yyyy', 'fr_FR').format(state.deliveryDate!),
  style: AppTextStyles.bodyLarge.copyWith(
    color: state.deliveryDate == null
        ? Colors.red[700]  // ❌ Error color prematurely
        : context.textPrimaryColor,
  ),
)
```

**Why This Is Bad:**
- User hasn't done anything wrong yet
- Red border/text creates anxiety: "Did I make a mistake?"
- Error states should only appear AFTER user attempts to proceed

**And the SnackBar on line 609:**
```dart
if (state.deliveryDate == null) {
  ScaffoldMessenger.of(context).showSnackBar(  // ❌ BOTTOM SNACKBAR
    const SnackBar(
      content: Text('Veuillez sélectionner une date de livraison'),
      backgroundColor: Colors.red,
    ),
  );
  return;
}
```

**Fix:**
```dart
// Only show error state AFTER user tries to submit
final showError = state.orderCreationAttempted && state.deliveryDate == null;

Container(
  decoration: BoxDecoration(
    border: Border.all(
      color: showError ? Colors.red[300]! : context.borderColor,
      width: showError ? 2 : 1,
    ),
  ),
  // ...
)

// REMOVE the SnackBar completely - inline error is enough
// Or use Dialog if you must block:
if (state.deliveryDate == null) {
  await showDialog(...);  // Modal, can't dismiss by accident
  return;
}
```

---

## 🟡 MODERATE ISSUES

### 5. **Cart Item Editing Missing**
**Severity:** MEDIUM
**Location:** `payment_step.dart:485-562`

**Real Scenario:**
- Tailor adds: "Boubou pour Papa - 25,000 FCFA"
- Client: "Ah non, c'est 23,000 on a dit!"
- Tailor: *has to delete entire item and re-add* ❌

**Current:**
```dart
IconButton(
  icon: const Icon(Icons.delete_outline),
  onPressed: () => _confirmDelete(context, notifier, index, item),
),
// NO EDIT BUTTON!
```

**Solution:**
```dart
Row(
  mainAxisSize: MainAxisSize.min,
  children: [
    IconButton(
      icon: Icon(Icons.edit_outlined),
      tooltip: 'Modifier',
      onPressed: () {
        // Populate form with item data
        notifier.loadItemForEdit(index);
        // Go back to step 2
        notifier.goToStep(1);
      },
    ),
    SizedBox(width: 4),
    IconButton(
      icon: Icon(Icons.delete_outline, color: AppColors.error),
      tooltip: 'Supprimer',
      onPressed: () => _confirmDelete(context, notifier, index, item),
    ),
  ],
)
```

---

### 6. **Smart Templates Unclear**
**Severity:** MEDIUM
**Location:** `item_builder_step.dart:48-50`

**Current:**
```
1. QUI HABILLONS-NOUS?
2. MODÈLES RAPIDES  ← What are these? Do they auto-fill?
3. PROJET & TISSU
```

**Questions:**
- Do templates auto-fill garment type + measurements?
- Are they just garment type shortcuts?
- Do they include pricing?

**Without seeing `SmartTemplatesList` implementation, I can't audit properly, but:**

**If they're garment type shortcuts:**
```dart
// Show as horizontal chips BEFORE "Type de modèle" field
Wrap(
  spacing: 8,
  children: [
    'Boubou', 'Robe', 'Pantalon', 'Ensemble', 'Caftan'
  ].map((type) =>
    ActionChip(
      label: Text(type),
      onPressed: () => notifier.setGarmentType(type),
    ),
  ).toList(),
),
```

**If they're full templates with measurements:**
```dart
// Show as modal sheet (doesn't take space)
FloatingActionButton.extended(
  icon: Icon(Icons.auto_awesome),
  label: Text('Modèle rapide'),
  onPressed: () => _showTemplatesModal(),
)
```

---

### 7. **Deposit Field: Unclear Optionality**
**Severity:** MEDIUM
**Location:** `payment_step.dart:140-167`

**Current:**
```dart
AppTextField(
  label: 'Acompte versé maintenant',  // ❌ Looks required!
  validator: (value) {
    if (value == null || value.isEmpty) {
      return null; // Actually optional
    }
    // ...
  },
)
```

**Problem:**
- Field looks required (no "(Optionnel)" indicator)
- Help text says "Généralement 30-50%" but allows 0%
- In Senegal, it's RARE to take an order without deposit (trust issues)
- Should this actually be optional? Or should we enforce minimum deposit?

**Options:**

**A) Truly optional:**
```dart
AppTextField(
  label: 'Acompte versé maintenant (Optionnel)',
  hint: 'Laisser vide si aucun acompte',
  // ...
)
```

**B) Enforce minimum (more realistic):**
```dart
validator: (value) {
  if (value == null || value.isEmpty) {
    return 'Un acompte est requis';  // Required!
  }
  final amount = double.tryParse(value);
  if (amount == null || amount <= 0) {
    return 'Montant invalide';
  }
  if (amount < totalAmount * 0.2) {  // Min 20%
    return 'Minimum 20% du total';
  }
  return null;
}
```

**C) Smart default (best UX):**
```dart
// Auto-fill 30% when payment step loads
@override
void initState() {
  super.initState();
  final defaultDeposit = (notifier.totalAmount * 0.3).toStringAsFixed(0);
  _depositController.text = defaultDeposit;
  notifier.setDepositAmount(double.parse(defaultDeposit));
}
```

---

### 8. **Price Field: No Auto-Calculation**
**Severity:** LOW-MEDIUM
**Location:** `project_details_card.dart:216-232`

**Missing Feature:**
- User selects fabric from stock (has price/meter)
- User specifies quantity (e.g., 3 meters)
- Price field is EMPTY - user must calculate manually

**Should auto-fill:**
```dart
// When fabric selected AND quantity entered:
void _updatePriceEstimate() {
  if (state.fabricType == 'Stock' && state.selectedFabric != null) {
    final fabricCost = state.selectedFabric!.pricePerMeter * state.fabricQuantity;
    final laborCost = _getAverageLaborCost(state.garmentType);  // From history
    final suggestedPrice = fabricCost + laborCost;

    // Pre-fill but allow editing
    priceController.text = suggestedPrice.toStringAsFixed(0);
    notifier.setItemPrice(suggestedPrice);
  }
}
```

---

## 🟢 MINOR ISSUES

### 9. **Voice Note Broken**
**Severity:** LOW (feature incomplete)
**Location:** `item_builder_step.dart:60-71`

**Current:**
```dart
VoiceNoteRecorder(
  onRecordingComplete: (path) {
    // TODO: implement in provider if needed
  },
  onDelete: () {
    // TODO
  },
),
```

**Fix:**
Either implement or remove entirely. Half-working features confuse users.

---

### 10. **Fabric Toggle: ALL CAPS**
**Severity:** VERY LOW
**Location:** `project_details_card.dart:164-173`

**Current:**
```dart
label: 'TISSU CLIENT',  // ❌ Aggressive
label: 'TISSU STOCK',
```

**Better:**
```dart
label: 'Tissu du client',  // ✓ Friendlier
label: 'Tissu du stock',
```

---

### 11. **Step Progress: No Labels**
**Severity:** LOW
**Location:** `new_order_view.dart:118-175`

**Current:**
- Shows circles with numbers: ① ② ③
- Header shows current step name
- But progress bar has no labels

**Enhancement:**
```dart
// Add tiny labels under circles
Column(
  mainAxisSize: MainAxisSize.min,
  children: [
    _buildProgressCircle(stepIndex),
    SizedBox(height: 2),
    Text(
      state.steps[stepIndex],
      style: TextStyle(
        fontSize: 9,
        color: isActive ? AppColors.primary : context.textSecondaryColor,
      ),
    ),
  ],
)
```

---

## 📊 CORRECTED FLOW ANALYSIS

### Current Flow (ACTUALLY GOOD!)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Client                                         │
│ ─────────────────────────────────────────────────────  │
│ ✓ Search existing or quick-create new                 │
│ ✓ Loads beneficiaries (family members)                │
│ ✓ Loads recent clients (smart ordering)               │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Panier (CORRECT NAME!)                        │
│ ─────────────────────────────────────────────────────  │
│ FOR EACH GARMENT IN ORDER:                            │
│   1. Who? (Client himself or beneficiary)             │
│   2. Template? (Optional quick-fill)                  │
│   3. Garment type (Boubou, Robe, etc.)                │
│   4. Model photos (Reference images)                  │
│   5. Fabric source:                                   │
│      • Client's fabric → Note + photo                 │
│      • Stock fabric → Select + quantity               │
│   6. Measurements (smart: show if needed)             │
│   7. Price                                            │
│   8. Voice note (if implemented)                      │
│   [Ajouter] → Adds to cart                           │
│                                                        │
│ REPEAT for multiple garments                          │
│ [Continuer (X)] → Next step                           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: Paiement                                       │
│ ─────────────────────────────────────────────────────  │
│ ✓ Review all items                                    │
│ ✓ Total amount                                        │
│ ✓ Deposit (with smart default)                        │
│ ✓ Remaining balance                                   │
│ ✓ Delivery date (required, critical)                  │
│ ✓ Confirm → Creates order + projects                  │
└─────────────────────────────────────────────────────────┘
```

**This flow is actually CORRECT for a tailor shop!**

---

## 🎯 REVISED PRIORITY FIXES

### CRITICAL (Do Now)
1. ✅ **REMOVE ALL BOTTOM SNACKBARS** - Replace with:
   - Inline validation for fields
   - AlertDialog for blocking errors
   - Haptic feedback for success
   - Visual state changes (button checkmark, cart count)

2. ✅ **Fix button labels**:
   - "Ajouter" instead of "Ajouter cet article"
   - "Continuer (X)" instead of "Terminer"
   - Show cart count badge

3. ✅ **Smart measurements**:
   - Hide if beneficiary/client has measurements on file
   - Show compact badge: "✓ Mesures disponibles"
   - Force expand + warn if NO measurements

### HIGH (Do Soon)
4. ⚠️ **Add cart item editing** - Don't force delete/recreate
5. ⚠️ **Fix delivery date error state** - Only show red after submit attempt
6. ⚠️ **Clarify deposit field** - Add "(Optionnel)" OR enforce minimum OR smart default

### MEDIUM (Nice to Have)
7. 💡 **Auto-calculate price** - When fabric + quantity selected
8. 💡 **Fix or remove voice note** - Don't show broken features
9. 💡 **Soften fabric toggle** - Remove ALL CAPS

---

## 🔧 CODE CHANGES NEEDED

### 1. Remove SnackBars (CRITICAL)

**File:** `payment_step.dart:609-615`
```dart
// ❌ REMOVE THIS:
if (state.deliveryDate == null) {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text('Veuillez sélectionner une date de livraison'),
      backgroundColor: Colors.red,
    ),
  );
  return;
}

// ✅ REPLACE WITH: (Already handled by form validator + visual state)
// Just check, don't show snackbar - user sees red border
if (state.deliveryDate == null) {
  return;  // Form won't submit, visual feedback already shown
}
```

**File:** `new_order_provider.dart:243-247`
```dart
// ❌ REMOVE THIS:
AppFeedback.showToast(
  title: 'Article ajouté',
  message: '${project.name} a été ajouté au panier.',
  type: ToastType.success,
);

// ✅ REPLACE WITH:
HapticFeedback.mediumImpact();  // That's it! Cart updates visually.
```

**File:** `new_order_provider.dart:385-388`
```dart
// ❌ REMOVE THIS:
AppFeedback.showSuccess(
  title: 'Commande Créée',
  message: 'La commande a été créée avec succès.',
);
return true;

// ✅ REPLACE WITH: (Just return, navigation confirms success)
return true;
```

**File:** `new_order_provider.dart:207-214` (and similar)
```dart
// ❌ REMOVE THESE:
if (state.garmentType.isEmpty || state.itemPrice <= 0) {
  AppFeedback.showError('Veuillez remplir les informations du vêtement');
  return;
}

// ✅ REPLACE WITH: Inline validators (already exist for some fields!)
// Let form validation handle it, or use AlertDialog for complex logic
```

---

### 2. Better Button Labels

**File:** `order_bottom_bar.dart:29-69`
```dart
// ❌ CURRENT:
Text('Ajouter cet article'),
Text('Terminer'),

// ✅ REPLACE WITH:
Expanded(
  child: ElevatedButton(
    onPressed: notifier.addItemToCart,
    child: Text('Ajouter'),
  ),
),
if (state.cartItems.isNotEmpty) ...[
  SizedBox(width: 12),
  OutlinedButton(
    onPressed: notifier.nextStep,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Continuer'),
        SizedBox(width: 6),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '${state.cartItems.length}',
            style: TextStyle(color: Colors.white, fontSize: 11),
          ),
        ),
      ],
    ),
  ),
],
```

---

## 🌟 INSIGHTS FROM REAL USAGE

**What I Got Wrong Initially:**
- I thought "Panier" was misleading → It's actually perfect for building a multi-item order
- I thought measurements should always be visible → They should be SMART (show only if needed)
- I suggested 4 steps → 3 is correct, adding a review step is redundant

**What the Codebase Got Right:**
- 3-step flow matches tailor workflow perfectly
- Beneficiary selection (one client, multiple recipients)
- Fabric toggle (client vs stock)
- Reference history overlay (PiP for measurements)
- Deposit + delivery date model

**What Needs Fixing:**
- ❌ Bottom snackbars cover action buttons
- ❌ Button labels don't match natural Senegalese French
- ❌ Measurements aren't smart (should check if on file first)
- ❌ Error states appear before user tries (premature validation)
- ❌ Can't edit cart items, only delete

---

**End of Revised Audit**
