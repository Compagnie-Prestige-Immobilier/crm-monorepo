import 'package:flutter/material.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';

/// Rating and an optional sentence, returned to the caller.
///
/// Kept deliberately short: the API caps the body at 200 characters, and the
/// product asks a client with limited reading comfort for one tap and, at
/// most, one line. Shared between the post-service review flow
/// (`ClientActivityView`) and the visit-based review flow
/// (`WorkshopDetailView`) — same UI either way, only how the result gets
/// submitted differs.
class ReviewSheet extends StatefulWidget {
  const ReviewSheet({super.key, required this.atelierName});

  final String atelierName;

  @override
  State<ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<ReviewSheet> {
  int _rating = 5;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        0,
        AppSpacing.gutter,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Votre avis sur ${widget.atelierName}',
            style: AppTextStyles.h4.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              for (var value = 1; value <= 5; value++)
                IconButton(
                  onPressed: () => setState(() => _rating = value),
                  tooltip: '$value sur 5',
                  icon: Icon(
                    value <= _rating
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    size: 32,
                    color: value <= _rating
                        ? context.accentColor
                        : context.textSecondaryColor,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _controller,
            maxLength: 200,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Ce qui s’est bien passé, ou moins bien (facultatif)',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context, (
                rating: _rating,
                body: _controller.text,
              )),
              child: const Text('Envoyer'),
            ),
          ),
        ],
      ),
    );
  }
}
