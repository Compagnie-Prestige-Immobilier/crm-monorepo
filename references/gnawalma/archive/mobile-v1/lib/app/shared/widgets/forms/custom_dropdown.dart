import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_motion.dart';

class CustomDropdown<T> extends StatefulWidget {
  final T? value;
  final List<T> items;
  final String? label;
  final String Function(T) itemLabelBuilder;
  final void Function(T) onChanged;
  final String? hint;
  final Widget? prefixIcon;
  final double? width;

  const CustomDropdown({
    super.key,
    required this.value,
    required this.items,
    this.label,
    required this.itemLabelBuilder,
    required this.onChanged,
    this.hint,
    this.prefixIcon,
    this.width,
  });

  @override
  State<CustomDropdown<T>> createState() => _CustomDropdownState<T>();
}

class _CustomDropdownState<T> extends State<CustomDropdown<T>>
    with SingleTickerProviderStateMixin {
  final LayerLink _layerLink = LayerLink();
  late AnimationController _animationController;
  late Animation<double> _expandAnimation;
  OverlayEntry? _overlayEntry;
  bool _isOpen = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: AppMotion.quick,
    );
    _expandAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    );
  }

  void _toggleDropdown() {
    if (_isOpen) {
      _closeDropdown();
    } else {
      _openDropdown();
    }
  }

  void _openDropdown() {
    _overlayEntry = _createOverlayEntry();
    Overlay.of(context).insert(_overlayEntry!);
    _animationController.forward();
    setState(() {
      _isOpen = true;
    });
  }

  void _closeDropdown() {
    _animationController.reverse().then((_) {
      _overlayEntry?.remove();
      _overlayEntry = null;
      if (mounted) {
        setState(() {
          _isOpen = false;
        });
      }
    });
  }

  OverlayEntry _createOverlayEntry() {
    RenderBox renderBox = context.findRenderObject() as RenderBox;
    var size = renderBox.size;

    return OverlayEntry(
      builder: (context) => Stack(
        children: [
          // Backdrop to close on tap outside
          GestureDetector(
            onTap: _closeDropdown,
            behavior: HitTestBehavior.translucent,
            child: Container(color: Colors.transparent),
          ),
          // Dropdown List
          Positioned(
            width: size.width,
            child: CompositedTransformFollower(
              link: _layerLink,
              showWhenUnlinked: false,
              offset: Offset(0.0, size.height + 5.0),
              child: Container(
                decoration: BoxDecoration(
                  color: context.surfaceColor,
                  borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
                  // An overlay genuinely floats above the page, so it keeps a
                  // shadow — and needs a border too, since on the dark page a
                  // shadow over near-black gives it no edge at all.
                  border: Border.all(color: context.borderColor),
                  boxShadow: AppColors.floatingShadow,
                ),
                child: Material(
                  type: MaterialType.transparency,
                  borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
                  child: SizeTransition(
                    axisAlignment: 1.0,
                    sizeFactor: _expandAnimation,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 250),
                      child: ListView.separated(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: widget.items.length,
                        separatorBuilder: (context, index) => Divider(
                          height: 1,
                          color: context.dividerColor.withValues(alpha: 0.5),
                        ),
                        itemBuilder: (context, index) {
                          final item = widget.items[index];
                          final isSelected = item == widget.value;

                          return InkWell(
                            onTap: () {
                              widget.onChanged(item);
                              _closeDropdown();
                            },
                            borderRadius: BorderRadius.circular(
                              AppSpacing.buttonRadius,
                            ),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.md,
                                horizontal: AppSpacing.gutter,
                              ),
                              color: isSelected
                                  ? Theme.of(
                                      context,
                                    ).colorScheme.primaryContainer
                                  : Colors.transparent,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      widget.itemLabelBuilder(item),
                                      style: isSelected
                                          ? AppTextStyles.bodyMedium.copyWith(
                                              color: Theme.of(
                                                context,
                                              ).colorScheme.onPrimaryContainer,
                                              fontWeight: FontWeight.bold,
                                            )
                                          : AppTextStyles.bodyMedium.copyWith(
                                              color: context.textPrimaryColor,
                                            ),
                                    ),
                                  ),
                                  if (isSelected)
                                    Icon(
                                      Icons.check,
                                      size: 16,
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onPrimaryContainer,
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.width,
      child: CompositedTransformTarget(
        link: _layerLink,
        child: GestureDetector(
          onTap: _toggleDropdown,
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: widget.label,
              prefixIcon: widget.prefixIcon,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
                borderSide: BorderSide(
                  color: _isOpen
                      ? Theme.of(context).colorScheme.primary
                      : context.borderColor,
                  width: _isOpen ? 2.0 : 1.0,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
                borderSide: BorderSide(
                  color: _isOpen
                      ? Theme.of(context).colorScheme.primary
                      : context.borderColor,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
                borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.primary,
                  width: 2.0,
                ),
              ),
              filled: true,
              fillColor: context.surfaceColor,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutter,
                vertical: AppSpacing.sm,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    widget.value != null
                        ? widget.itemLabelBuilder(widget.value as T)
                        : widget.hint ?? 'Sélectionner',
                    style: widget.value != null
                        ? AppTextStyles.bodyMedium.copyWith(
                            color: context.textPrimaryColor,
                          )
                        : AppTextStyles.caption.copyWith(
                            color: context.textSecondaryColor,
                          ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(
                  _isOpen
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  color: _isOpen
                      ? Theme.of(context).colorScheme.primary
                      : context.textSecondaryColor,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    _overlayEntry?.remove();
    super.dispose();
  }
}
