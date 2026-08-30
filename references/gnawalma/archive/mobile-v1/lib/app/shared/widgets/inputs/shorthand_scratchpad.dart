import 'package:flutter/material.dart';

import 'package:gnawalma/app/shared/theme/app_colors_extensions.dart';
import 'package:gnawalma/app/shared/theme/app_spacing.dart';
import 'package:gnawalma/app/shared/theme/app_text_styles.dart';
import 'package:gnawalma/app/shared/utils/shorthand_parser.dart';
import '../feedback/app_toast.dart';

class ShorthandScratchpad extends StatefulWidget {
  final Function(Map<String, double>) onParsed;

  const ShorthandScratchpad({super.key, required this.onParsed});

  @override
  State<ShorthandScratchpad> createState() => _ShorthandScratchpadState();
}

class _ShorthandScratchpadState extends State<ShorthandScratchpad> {
  final TextEditingController _controller = TextEditingController();
  Map<String, double> _currentPreview = {};

  void _onChanged(String val) {
    setState(() {
      _currentPreview = ShorthandParser.parse(val);
    });
  }

  void _apply() {
    if (_currentPreview.isNotEmpty) {
      widget.onParsed(_currentPreview);
      _controller.clear();
      setState(() {
        _currentPreview = {};
      });
      AppToast.show(
        title: 'Mesures appliquées',
        message: 'Vérifiez les valeurs avant d’enregistrer.',
        type: ToastType.success,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.edit_note_rounded,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
              const SizedBox(width: 8),
              Text(
                'NOTE RAPIDE (STYLE PAPIER)',
                style: AppTextStyles.overline.copyWith(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _controller,
            onChanged: _onChanged,
            maxLines: 2,
            style: AppTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.bold,
              color: context.textPrimaryColor,
            ),
            decoration: InputDecoration(
              hintText: 'Ex: TP 110 TT 95 LB 125...',
              // Was slate at 50% alpha on a hardcoded white fill — 2.2:1, a
              // placeholder nobody could read. The field also stayed white in
              // dark mode while its container inverted around it.
              hintStyle: AppTextStyles.caption.copyWith(
                color: context.textSecondaryColor,
              ),
              filled: true,
              fillColor: context.surfaceColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          if (_currentPreview.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _currentPreview.entries
                  .map((e) => _buildChip(e.key, e.value))
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _apply,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      AppSpacing.buttonRadius,
                    ),
                  ),
                  elevation: 0,
                ),
                child: const Text('APPLIQUER TOUT'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChip(String key, double value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
        border: Border.all(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
        ),
      ),
      child: Text(
        '${key.substring(0, 2).toUpperCase()}: ${value.toStringAsFixed(0)}',
        style: AppTextStyles.caption.copyWith(
          color: Theme.of(context).colorScheme.onPrimaryContainer,
          fontSize: 10,
        ),
      ),
    );
  }
}
