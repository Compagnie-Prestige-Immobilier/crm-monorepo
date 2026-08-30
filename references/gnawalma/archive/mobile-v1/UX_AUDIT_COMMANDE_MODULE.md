# UX AUDIT: Module Commande (Orders) - Gnawalma
**Date:** 2026-02-12
**Auditor:** Claude
**Scope:** New Order Flow (`/orders/new`)

---

## 🔴 CRITICAL ISSUES

### 1. **Step 2 Name/Purpose Mismatch**
**Severity:** HIGH
**Location:** `new_order_state.dart:13`

**Problem:**
- Step 2 is labeled "Panier" (Cart/Basket) in the step indicator
- But it's actually the **item builder** where users create individual items
- The actual cart summary only appears AFTER you add at least one item
- This creates cognitive dissonance: "Why am I filling out all these fields if I'm viewing my cart?"

**Current Flow:**
```
Step 1: Select Client ✓
Step 2: "Panier" → But actually:
   - Select beneficiary
   - Choose garment type
   - Add model photos
   - Select fabric (client/stock)
   - Enter measurements
   - Set price
   - Click "Ajouter cet article"
Step 3: Payment ✓
```

**Expected Flow:**
```
Step 1: Select Client ✓
Step 2: "Créer Articles" or "Détails Commande" → Build items
Step 3: "Panier" → Review cart
Step 4: "Paiement" → Payment & delivery
```

**Recommendation:**
- Rename Step 2 to "Détails" or "Articles"
- Add a separate "Panier" step before payment where users review all items
- OR keep 3 steps but change Step 2 to "Créer Article" (singular, active voice)

---

### 2. **Bottom Action Bar Confusion**
**Severity:** HIGH
**Location:** `orders/widgets/order_bottom_bar.dart:29-69`

**Problem:**
```dart
if (state.cartItems.isNotEmpty) ...[
  ElevatedButton.icon(
    onPressed: notifier.nextStep,  // Goes to payment!
    label: const Text('Terminer'),  // Ambiguous!
  ),
],
ElevatedButton.icon(
  onPressed: notifier.addItemToCart,
  label: const Text('Ajouter cet article'),
),
```

**Issues:**
1. **"Terminer" is ambiguous** - Does it mean:
   - Finish building this item? ❌
   - Go to next step? ✓ (actual behavior)
   - Complete the order? ❌

2. **Two buttons with unclear hierarchy**
   - Primary action should be "Add item" (building mode)
   - Secondary action should be "Continue" (when done adding items)

3. **"Terminer" appears conditionally**
   - Only shows when cart has items
   - Users might not know what to do after first item

**Recommendation:**
```dart
// Primary: Add current item
ElevatedButton.icon(
  icon: const Icon(Icons.add_shopping_cart),
  label: const Text('Ajouter au panier'),  // Clearer!
)

// Secondary: Continue to next step
if (state.cartItems.isNotEmpty) ...[
  OutlinedButton.icon(
    icon: const Icon(Icons.arrow_forward),
    label: Text('Continuer (${state.cartItems.length})'),  // Shows count!
  ),
]
```

---

### 3. **Measurements Hidden by Default**
**Severity:** MEDIUM-HIGH
**Location:** `orders/views/steps/item_builder_step.dart:77-81`

**Problem:**
```dart
const CollapsibleSection(
  title: '5. MESURES DU CLIENT',
  initiallyExpanded: false,  // ❌ HIDDEN!
  child: OrderMeasurementSection(),
),
```

**Issues:**
- Measurements are **critical** for tailoring but hidden in collapsed section
- Users might skip this entirely
- The reference history overlay (PiP) exists, suggesting measurements are important
- Why hide them if they're step 5 of the flow?

**Recommendation:**
- **Option A:** Make `initiallyExpanded: true`
- **Option B:** Remove the collapsible and always show measurements
- **Option C:** Add a visual indicator when measurements are missing (⚠️ badge)

---

## 🟡 MODERATE ISSUES

### 4. **No Cart Item Editing**
**Severity:** MEDIUM
**Location:** `payment_step.dart:485-562`

**Problem:**
- Once an item is added to cart, you can only **delete** it
- Cannot edit: beneficiary, garment type, fabric, price, measurements
- User must delete and re-create the entire item to fix mistakes
- This is frustrating for minor corrections

**Current Cart Item Actions:**
```dart
IconButton(
  icon: const Icon(Icons.delete_outline),
  onPressed: () => _confirmDelete(context, notifier, index, item),
),
// NO EDIT BUTTON!
```

**Recommendation:**
Add edit functionality:
```dart
Row(
  children: [
    IconButton(
      icon: const Icon(Icons.edit_outlined),
      onPressed: () => _editItem(index),  // Populate form with item data
    ),
    IconButton(
      icon: const Icon(Icons.delete_outline),
      onPressed: () => _confirmDelete(index),
    ),
  ],
)
```

---

### 5. **Deposit Amount UX Issues**
**Severity:** MEDIUM
**Location:** `payment_step.dart:140-197`

**Problem:**
1. **Optional but not clear:**
   ```dart
   validator: (value) {
     if (value == null || value.isEmpty) {
       return null; // Optional field - no error
     }
     // ... other validation
   }
   ```
   - Field is optional, but this isn't visually indicated
   - No placeholder like "(Optionnel)" in the label

2. **Remaining balance shows before deposit entered:**
   - Displays "Reste à payer: [TOTAL] FCFA" when deposit is 0
   - Might confuse users: "Why does it show a remaining balance if I haven't entered anything?"

3. **Help text suggests 30-50% but doesn't enforce it:**
   - Info box says "Généralement 30-50% du total"
   - But validation allows 0% to 100%
   - Should there be a minimum deposit? Or is 0% truly acceptable?

**Recommendation:**
```dart
AppTextField(
  label: 'Acompte versé maintenant (Optionnel)',  // Add "(Optionnel)"
  hint: 'Minimum suggéré: ${(totalAmount * 0.3).toStringAsFixed(0)} FCFA',
  // ...
)

// Maybe add a visual warning if deposit < 30%?
if (depositAmount < totalAmount * 0.3 && depositAmount > 0) {
  Container(
    child: Text('⚠️ Acompte inférieur aux 30% recommandés'),
  ),
}
```

---

### 6. **Smart Templates List Position**
**Severity:** LOW-MEDIUM
**Location:** `item_builder_step.dart:48-50`

**Problem:**
- "MODÈLES RAPIDES" (Smart Templates) appears as section 2
- Before "PROJET & TISSU" (section 3)
- But templates likely auto-fill project details
- Seems backwards: templates should come after you start filling details manually

**Current Order:**
```
1. QUI HABILLONS-NOUS? (Beneficiary)
2. MODÈLES RAPIDES (Templates)  ← Auto-fill?
3. PROJET & TISSU (Manual entry)  ← Gets filled by template?
4. NOTE VOCALE
5. MESURES DU CLIENT
```

**Recommendation:**
Either:
- **Option A:** Move templates to the top (before beneficiary) if they set everything
- **Option B:** Remove templates if they're not being used effectively
- **Option C:** Make templates a floating action or modal instead of inline section

---

### 7. **Delivery Date Field Styling**
**Severity:** LOW
**Location:** `payment_step.dart:272-339`

**Problem:**
- When no date is selected, the field shows a red border (width: 2)
- Text says "Sélectionner une date *" in red
- This is **error state styling** applied before user interaction
- Users haven't made a mistake yet, but are shown an error

**Current Code:**
```dart
border: Border.all(
  color: state.deliveryDate == null
      ? Colors.red[300]!  // ❌ Pre-validation error state
      : context.borderColor,
  width: state.deliveryDate == null ? 2 : 1,
),
```

**Recommendation:**
Only show error state after user tries to proceed without selecting:
```dart
border: Border.all(
  color: state.orderCreationAttempted && state.deliveryDate == null
      ? Colors.red[300]!
      : context.borderColor,
  width: state.orderCreationAttempted && state.deliveryDate == null ? 2 : 1,
),
```

---

## 🟢 MINOR ISSUES

### 8. **Step Progress Indicator Semantics**
**Severity:** LOW
**Location:** `new_order_view.dart:118-175`

**Problem:**
- Progress indicator uses circles with numbers/checkmarks
- "Completed" steps show checkmark, current shows number
- But step indicators don't have labels
- Users must remember: "What was step 2 called again?"

**Recommendation:**
Add step labels below circles:
```dart
Column(
  children: [
    // Circle with number/check
    _buildProgressCircle(stepIndex),
    SizedBox(height: 4),
    // Label
    Text(
      state.steps[stepIndex],
      style: TextStyle(fontSize: 10),
    ),
  ],
)
```

---

### 9. **Voice Note Section Unused**
**Severity:** LOW
**Location:** `item_builder_step.dart:60-71`

**Problem:**
```dart
VoiceNoteRecorder(
  onRecordingComplete: (path) {
    // notifier.setAudioNotePath(path); // TODO: implement in provider if needed
  },
  onDelete: () {
    // notifier.setAudioNotePath(null);
  },
),
```

- Voice note callbacks are commented out
- Feature exists in UI but doesn't function
- Confusing for users: "Why isn't this working?"

**Recommendation:**
- **Option A:** Implement the callbacks
- **Option B:** Remove the voice note section until implemented
- **Option C:** Disable the widget with a "Coming soon" overlay

---

### 10. **Fabric Selection Toggle Labels**
**Severity:** LOW
**Location:** `project_details_card.dart:164-173`

**Problem:**
```dart
ToggleSwitchOption<String>(
  value: 'Client',
  label: 'TISSU CLIENT',  // ALL CAPS
  icon: Icons.person_outline,
),
ToggleSwitchOption<String>(
  value: 'Stock',
  label: 'TISSU STOCK',  // ALL CAPS
  icon: Icons.inventory_2_outlined,
),
```

**Issues:**
- Labels are all caps (aggressive)
- "TISSU CLIENT" might be confusing: "Client fabric" or "Client's fabric"?
- Could be clearer: "Du client" vs "Du stock"

**Recommendation:**
```dart
label: 'Du Client',  // Softer, clearer
label: 'Du Stock',
```

---

## 📊 FLOW ANALYSIS

### Current User Journey (3 Steps)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Client                                         │
│ ─────────────────────────────────────────────────────  │
│ ✓ Search/select existing client                       │
│ ✓ OR quick-create new client                          │
│ ✓ Clear and straightforward                           │
└─────────────────────────────────────────────────────────┘
                      ↓ [Next Step]
┌─────────────────────────────────────────────────────────┐
│ STEP 2: "Panier" (❌ MISLEADING NAME)                  │
│ ─────────────────────────────────────────────────────  │
│ 1. Select beneficiary (Moi-même or autre)             │
│ 2. See smart templates (optional)                     │
│ 3. Enter garment type                                 │
│ 4. Add model photos                                   │
│ 5. Choose fabric source (Client/Stock)                │
│    - If Client: note + photo                          │
│    - If Stock: select from inventory                  │
│ 6. Enter price                                        │
│ 7. [Measurements - HIDDEN in collapsed section] ❌     │
│ 8. Click "Ajouter cet article"                        │
│    → Item added to cart                               │
│    → Form resets? Or keeps values?                    │
│ 9. Repeat 1-8 for more items                          │
│ 10. Click "Terminer" (❌ AMBIGUOUS)                    │
└─────────────────────────────────────────────────────────┘
                      ↓ [Terminer]
┌─────────────────────────────────────────────────────────┐
│ STEP 3: Paiement                                       │
│ ─────────────────────────────────────────────────────  │
│ ✓ Review cart items                                   │
│ ✓ See total amount                                    │
│ ○ Enter deposit (optional, but not clear)             │
│ ✓ Select delivery date (required, error state before  │
│   user interaction)                                   │
│ ✓ Confirm order                                       │
│ ✓ Clear confirmation dialog                           │
└─────────────────────────────────────────────────────────┘
```

### Proposed Improved Journey (4 Steps)

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Client ✓ (No changes needed)                   │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Détails Article                               │
│ ─────────────────────────────────────────────────────  │
│ • Select beneficiary                                  │
│ • Smart templates (top of screen or modal)            │
│ • Garment type                                        │
│ • Model photos                                        │
│ • Fabric (Client/Stock)                               │
│ • Measurements (ALWAYS VISIBLE) ✓                      │
│ • Price                                               │
│ • Voice note (if implemented)                         │
│ • [Ajouter au panier] (primary)                       │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: Panier (NEW)                                  │
│ ─────────────────────────────────────────────────────  │
│ • Review all items                                    │
│ • Edit items (not just delete) ✓                      │
│ • Add more items                                      │
│ • See total                                           │
│ • [Continuer vers paiement]                           │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 4: Paiement ✓                                     │
│ • Same as current Step 3                              │
│ • But no cart editing, just review                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 SUMMARY & PRIORITY FIXES

### Must Fix (HIGH Priority)
1. ✅ **Rename Step 2** from "Panier" to "Détails" or add a cart review step
2. ✅ **Clarify bottom bar buttons**: "Ajouter au panier" + "Continuer (X items)"
3. ✅ **Show measurements by default** (`initiallyExpanded: true`)

### Should Fix (MEDIUM Priority)
4. ⚠️ **Add cart item editing** (not just deletion)
5. ⚠️ **Improve deposit UX** (mark as optional, don't show error state early)
6. ⚠️ **Fix delivery date error styling** (only show red after attempt)

### Nice to Have (LOW Priority)
7. 💡 **Add step labels** to progress indicator
8. 💡 **Implement or remove** voice note feature
9. 💡 **Soften toggle labels** (remove ALL CAPS)
10. 💡 **Reconsider smart templates position**

---

## 🔧 QUICK WINS (Can implement in < 1 hour)

```dart
// 1. Rename step
@Default(['Client', 'Détails', 'Paiement']) List<String> steps,

// 2. Show measurements
initiallyExpanded: true,

// 3. Mark deposit as optional
label: 'Acompte versé maintenant (Optionnel)',

// 4. Fix delivery date error state
final showError = state.orderCreationAttempted && state.deliveryDate == null;
border: Border.all(
  color: showError ? Colors.red[300]! : context.borderColor,
),

// 5. Better button labels
Text('Ajouter au panier'),
Text('Continuer (${state.cartItems.length})'),
```

---

**End of Audit**
