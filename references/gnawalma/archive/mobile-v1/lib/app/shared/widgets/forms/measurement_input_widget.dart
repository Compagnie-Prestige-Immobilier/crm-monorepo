import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../constants/unified_measurements.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../../../data/models/client_model.dart';
import '../inputs/kinetic_thumb_wheel.dart';
import '../../theme/app_motion.dart';

/// Unified measurement widget for Senegalese tailoring
///
/// Implements a high-fidelity "No-Keyboard" Studio View layout:
/// - Top: Premium Selection HUD with large value display
/// - Bottom: Kinetic Thumb-Wheel for precise entry without keyboard
class MeasurementInputWidget extends StatefulWidget {
  final Map<String, double> initialValues;
  final Gender initialGender;
  final String garmentType;
  final Function(String key, double value) onMeasurementChanged;
  final Function(Gender gender) onGenderChanged;

  const MeasurementInputWidget({
    super.key,
    required this.initialValues,
    required this.initialGender,
    required this.garmentType,
    required this.onMeasurementChanged,
    required this.onGenderChanged,
  });

  @override
  State<MeasurementInputWidget> createState() => _MeasurementInputWidgetState();
}

class _MeasurementInputWidgetState extends State<MeasurementInputWidget> {
  late Gender _selectedGender;
  final Map<String, double> _values = {};
  String? _highlightedPart;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _selectedGender = widget.initialGender;
    _initializeValues();
    // Default highlight
    _highlightedPart = UnifiedMeasurements.fields.first.key;
  }

  void _initializeValues() {
    for (final field in UnifiedMeasurements.fields) {
      final initialVal =
          widget.initialValues[field.key] ??
          widget.initialValues[field.labelFr] ??
          0.0;

      // Clamp to min/max if value exists, otherwise use 0.0 or field.min as default
      if (initialVal > 0) {
        _values[field.key] = initialVal.clamp(field.min, field.max);
      } else {
        _values[field.key] = 0.0;
      }
    }
  }

  /// A field is "set" only once someone has entered a value for it; 0 is the
  /// sentinel for untouched, never a real measurement.
  bool _isSet(String key) => (_values[key] ?? 0.0) > 0.0;

  void _onPartSelected(String part) {
    // Selecting a part only moves the focus. It used to seed the field with
    // its minimum and report that upwards, so merely tapping a card to look at
    // it recorded a real body measurement, marked the form complete and let it
    // be saved — a garment cut from a number nobody entered. A value is now
    // committed only when the wheel actually moves.
    setState(() => _highlightedPart = part);
    HapticFeedback.lightImpact();

    // Scroll to the selected field in the list
    final index = UnifiedMeasurements.fields.indexWhere((f) => f.key == part);
    if (index != -1) {
      _scrollController.animateTo(
        index * 80.0, // Approximate item height
        duration: AppMotion.standard,
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeField = _highlightedPart != null
        ? UnifiedMeasurements.fields.firstWhere(
            (f) => f.key == _highlightedPart,
          )
        : null;
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        // 1. PREMIUM STUDIO HUD
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: context.surfaceColor,
            border: Border(
              bottom: BorderSide(color: context.dividerColor, width: 1.5),
            ),
            boxShadow: [
              BoxShadow(
                color: colorScheme.shadow.withValues(alpha: 0.02),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                child: Row(
                  children: [
                    // Field Identity
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: colorScheme.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'SÉLECTION ACTIVE',
                                style: AppTextStyles.overline.copyWith(
                                  color: colorScheme.primary,
                                  letterSpacing: 2,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (activeField != null)
                            Text(
                              activeField.labelFr.toUpperCase(),
                              style: AppTextStyles.h2.copyWith(
                                color: context.textPrimaryColor,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                              ),
                            ),
                        ],
                      ),
                    ),

                    // LARGE VALUE DISPLAY
                    if (_highlightedPart != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.primary.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusContainer,
                          ),
                          border: Border.all(
                            color: colorScheme.primary.withValues(alpha: 0.1),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              _isSet(_highlightedPart!)
                                  ? _values[_highlightedPart!]!.toStringAsFixed(
                                      _values[_highlightedPart!]! % 1 == 0
                                          ? 0
                                          : 1,
                                    )
                                  : '—',
                              style: AppTextStyles.h1.copyWith(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.w900,
                                fontSize: 48,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'CM',
                              style: AppTextStyles.caption.copyWith(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),

              // THUMB WHEEL
              if (_highlightedPart != null && activeField != null)
                Padding(
                  padding: const EdgeInsets.only(
                    bottom: 24,
                    left: 24,
                    right: 24,
                  ),
                  child: KineticThumbWheel(
                    value: _values[_highlightedPart!] ?? activeField.min,
                    min: activeField.min,
                    max: activeField.max,
                    onChanged: (val) {
                      setState(() {
                        _values[_highlightedPart!] = val;
                      });
                      widget.onMeasurementChanged(_highlightedPart!, val);
                    },
                  ),
                ),
            ],
          ),
        ),

        // 2. SCROLLABLE LIST OF ALL MEASUREMENTS
        Expanded(
          child: Container(
            color: context.backgroundColor,
            child: ListView(
              controller: _scrollController,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutter,
                vertical: AppSpacing.lg,
              ),
              children: [
                _buildSectionHeader(context, 'TOURS DE CORPS', Icons.sync),
                ...UnifiedMeasurements.tours.map(
                  (field) => _buildMeasurementCard(context, field),
                ),

                const SizedBox(height: 32),

                _buildSectionHeader(
                  context,
                  'LONGUEURS & HAUTEURS',
                  Icons.straighten,
                ),
                ...UnifiedMeasurements.longueurs.map(
                  (field) => _buildMeasurementCard(context, field),
                ),

                SizedBox(
                  height: MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
                ),
              ],
            ),
          ),
        ),

        // 3. ATELIER CONTROLS
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: context.surfaceColor,
            border: Border(top: BorderSide(color: context.dividerColor)),
          ),
          child: SafeArea(
            child: Row(
              children: [
                _buildCompactGenderToggle(context),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    'Saisie rapide sans clavier. Touchez une mesure pour l\'ajuster.',
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(
    BuildContext context,
    String title,
    IconData icon,
  ) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 14, color: context.textSecondaryColor),
          const SizedBox(width: 8),
          Text(
            title,
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
              letterSpacing: 1.5,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactGenderToggle(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.surfaceLightColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildCompactOption(context, Gender.female, Icons.female),
          _buildCompactOption(context, Gender.male, Icons.male),
        ],
      ),
    );
  }

  Widget _buildCompactOption(
    BuildContext context,
    Gender gender,
    IconData icon,
  ) {
    final isSelected = _selectedGender == gender;
    final colorScheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: () {
        setState(() => _selectedGender = gender);
        widget.onGenderChanged(gender);
        HapticFeedback.mediumImpact();
      },
      borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      child: AnimatedContainer(
        duration: AppMotion.quick,
        constraints: const BoxConstraints(minWidth: 52, minHeight: 44),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          // A selected segment sits *in* the control, it does not float above
          // it. The drop shadow that used to mark selection here read as a
          // rendering fault next to the flat segment beside it; a border is
          // the honest cue and survives dark mode.
          color: isSelected ? context.surfaceColor : Colors.transparent,
          borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
          border: isSelected
              ? Border.all(color: colorScheme.primary, width: 1.4)
              : null,
        ),
        child: Icon(
          icon,
          size: 20,
          color: isSelected ? colorScheme.primary : context.textSecondaryColor,
        ),
      ),
    );
  }

  Widget _buildMeasurementCard(BuildContext context, MeasurementField field) {
    final isSelected = _highlightedPart == field.key;
    final value = _values[field.key] ?? 0.0;
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _onPartSelected(field.key),
        borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
        child: AnimatedContainer(
          duration: AppMotion.quick,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isSelected
                ? colorScheme.primary.withValues(alpha: 0.05)
                : context.surfaceColor,
            borderRadius: BorderRadius.circular(AppSpacing.radiusContainer),
            border: Border.all(
              color: isSelected
                  ? colorScheme.primary
                  : context.borderColor.withValues(alpha: 0.5),
              width: isSelected ? 2.0 : 1.0,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: colorScheme.primary.withValues(alpha: 0.05),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isSelected
                      ? colorScheme.primary
                      : context.surfaceLightColor,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
                ),
                child: Icon(
                  _getIconData(field.icon),
                  color: isSelected
                      ? colorScheme.onPrimary
                      : context.textSecondaryColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      field.labelFr.toUpperCase(),
                      style: AppTextStyles.bodyMedium.copyWith(
                        fontWeight: FontWeight.w900,
                        color: isSelected
                            ? colorScheme.primary
                            : context.textPrimaryColor,
                        fontSize: 13,
                        letterSpacing: 0.5,
                      ),
                    ),
                    if (field.helperText != null)
                      Text(
                        field.helperText!,
                        style: AppTextStyles.caption.copyWith(
                          fontSize: 10,
                          color: context.textSecondaryColor.withValues(
                            alpha: 0.7,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        value.toStringAsFixed(value % 1 == 0 ? 0 : 1),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: isSelected
                              ? colorScheme.primary
                              : context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Text(
                        'cm',
                        style: AppTextStyles.caption.copyWith(
                          color: context.textSecondaryColor,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (isSelected)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      width: 40,
                      height: 2,
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusCircle,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIconData(String iconName) {
    switch (iconName) {
      case 'circle_outlined':
        return Icons.circle_outlined;
      case 'accessibility_new':
        return Icons.accessibility_new;
      case 'favorite_border':
        return Icons.favorite_border;
      case 'radio_button_unchecked':
        return Icons.radio_button_unchecked;
      case 'panorama_horizontal_select':
        return Icons.panorama_horizontal_select;
      case 'height':
        return Icons.height;
      case 'straighten':
        return Icons.straighten;
      case 'vertical_align_bottom':
        return Icons.vertical_align_bottom;
      default:
        return Icons.straighten;
    }
  }
}
