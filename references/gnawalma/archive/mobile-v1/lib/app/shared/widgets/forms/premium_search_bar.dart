import 'package:flutter/material.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_motion.dart';

/// Quiet search field with a single visible focus state.
class PremiumSearchBar extends StatefulWidget {
  const PremiumSearchBar({
    super.key,
    this.hintText = 'Rechercher…',
    this.onChanged,
    this.onSubmitted,
    this.onClear,
    this.isLoading = false,
    this.iconAsset,
    this.controller,
    this.accentColor,
    this.autofocus = false,
  });

  final String hintText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onClear;
  final bool isLoading;
  final String? iconAsset;
  final TextEditingController? controller;
  final Color? accentColor;
  final bool autofocus;

  @override
  State<PremiumSearchBar> createState() => _PremiumSearchBarState();
}

class _PremiumSearchBarState extends State<PremiumSearchBar> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  bool _ownsController = false;
  bool _focused = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _controller = widget.controller ?? TextEditingController();
    _focusNode = FocusNode();
    _hasText = _controller.text.isNotEmpty;
    _focusNode.addListener(_onFocusChanged);
    _controller.addListener(_onTextChanged);
  }

  void _onFocusChanged() {
    if (mounted) setState(() => _focused = _focusNode.hasFocus);
  }

  void _onTextChanged() {
    final hasText = _controller.text.isNotEmpty;
    if (mounted && hasText != _hasText) setState(() => _hasText = hasText);
    widget.onChanged?.call(_controller.text);
  }

  void _clear() {
    _controller.clear();
    widget.onClear?.call();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _focusNode
      ..removeListener(_onFocusChanged)
      ..dispose();
    _controller.removeListener(_onTextChanged);
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accentColor ?? Theme.of(context).colorScheme.primary;
    return AnimatedContainer(
      duration: AppMotion.duration(context, AppMotion.exit),
      decoration: BoxDecoration(
        color: context.surfaceLightColor,
        borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        border: _focused
            ? Border.all(color: accent.withValues(alpha: .75), width: 1.4)
            : Border.all(color: Colors.transparent, width: 1.4),
      ),
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        autofocus: widget.autofocus,
        textInputAction: TextInputAction.search,
        onSubmitted: widget.onSubmitted,
        style: AppTextStyles.input.copyWith(color: context.textPrimaryColor),
        decoration: InputDecoration(
          hintText: widget.hintText,
          hintStyle: AppTextStyles.bodyMedium.copyWith(
            color: context.textSecondaryColor,
          ),
          prefixIcon: Padding(
            padding: const EdgeInsets.all(13),
            child: widget.isLoading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator.adaptive(
                      valueColor: AlwaysStoppedAnimation(accent),
                    ),
                  )
                : widget.iconAsset != null
                ? Image.asset(
                    widget.iconAsset!,
                    width: 20,
                    height: 20,
                    color: _focused ? accent : context.textSecondaryColor,
                    errorBuilder: (_, _, _) => Icon(
                      Icons.search_rounded,
                      color: _focused ? accent : context.textSecondaryColor,
                    ),
                  )
                : Icon(
                    Icons.search_rounded,
                    color: _focused ? accent : context.textSecondaryColor,
                  ),
          ),
          suffixIcon: _hasText
              ? IconButton(
                  tooltip: 'Effacer la recherche',
                  onPressed: _clear,
                  icon: const Icon(Icons.close_rounded, size: 19),
                )
              : null,
          filled: false,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 15,
          ),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
        ),
      ),
    );
  }
}
