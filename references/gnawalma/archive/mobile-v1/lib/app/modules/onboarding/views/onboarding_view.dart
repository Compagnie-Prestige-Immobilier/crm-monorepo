import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_assets.dart';
import '../../../shared/widgets/buttons/animated_primary_button.dart';
import '../controllers/onboarding_controller.dart';
import '../../../shared/theme/app_motion.dart';

class OnboardingView extends ConsumerStatefulWidget {
  const OnboardingView({super.key});

  @override
  ConsumerState<OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends ConsumerState<OnboardingView> {
  late final PageController _pageController;
  bool _isCompleting = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _nextPage() async {
    if (_isCompleting) return;
    final currentIndex = ref.read(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);

    HapticFeedback.selectionClick();
    if (currentIndex < controller.pages.length - 1) {
      await _pageController.animateToPage(
        currentIndex + 1,
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    setState(() => _isCompleting = true);
    await controller.completeOnboarding();
  }

  Future<void> _skip() async {
    if (_isCompleting) return;
    HapticFeedback.lightImpact();
    setState(() => _isCompleting = true);
    await ref.read(onboardingControllerProvider.notifier).completeOnboarding();
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);
    final pages = controller.pages;
    final isLastPage = currentIndex == pages.length - 1;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Hero(
                    tag: 'app_logo',
                    child: Image.asset(
                      AppAssets.logo,
                      width: 42,
                      height: 42,
                      semanticLabel: 'Gnawalma',
                      errorBuilder: (context, _, _) => Icon(
                        Icons.checkroom_rounded,
                        size: 36,
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Gnawalma',
                    style: AppTextStyles.h5.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                  const Spacer(),
                  ExcludeSemantics(
                    excluding: isLastPage,
                    child: IgnorePointer(
                      ignoring: isLastPage,
                      child: AnimatedOpacity(
                        opacity: isLastPage ? 0 : 1,
                        duration: AppMotion.quick,
                        child: TextButton(
                          onPressed: isLastPage || _isCompleting ? null : _skip,
                          child: const Text('Passer'),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Row(
                children: List.generate(
                  pages.length,
                  (index) => Expanded(
                    child: AnimatedContainer(
                      duration: AppMotion.quick,
                      height: 4,
                      margin: EdgeInsets.only(
                        right: index == pages.length - 1 ? 0 : AppSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: index <= currentIndex
                            ? Theme.of(context).colorScheme.primary
                            : context.borderColor,
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusCircular,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: pages.length,
                onPageChanged: (index) {
                  controller.onPageChanged(index);
                  HapticFeedback.selectionClick();
                },
                itemBuilder: (context, index) {
                  final page = pages[index];
                  return _OnboardingPage(
                    page: page,
                    index: index,
                    total: pages.length,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      pages.length,
                      (index) => AnimatedContainer(
                        duration: AppMotion.quick,
                        curve: Curves.easeOutCubic,
                        margin: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xxs,
                        ),
                        height: 7,
                        width: currentIndex == index ? 28 : 7,
                        decoration: BoxDecoration(
                          color: currentIndex == index
                              ? Theme.of(context).colorScheme.primary
                              : context.borderColor,
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusCircular,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.gutter),
                  AnimatedPrimaryButton(
                    label: isLastPage ? 'Choisir mon espace' : 'Continuer',
                    enabled: true,
                    loading: _isCompleting,
                    backgroundColor: isLastPage
                        ? Theme.of(context).colorScheme.secondary
                        : Theme.of(context).colorScheme.primary,
                    icon: Icons.arrow_forward_rounded,
                    onPressed: _nextPage,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({
    required this.page,
    required this.index,
    required this.total,
  });

  final OnboardingPageModel page;
  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxHeight < 560;
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
          child: Column(
            children: [
              Container(
                height: compact ? 230 : 300,
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: context.surfaceColor,
                  borderRadius: BorderRadius.circular(
                    AppSpacing.radiusSheetTop,
                  ),
                  border: Border.all(
                    color: context.borderColor.withValues(alpha: 0.72),
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: Theme.of(
                            context,
                          ).colorScheme.secondaryContainer,
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusCircular,
                          ),
                        ),
                        child: Text(
                          '${index + 1}/$total',
                          style: AppTextStyles.caption.copyWith(
                            color: Theme.of(
                              context,
                            ).colorScheme.onSecondaryContainer,
                          ),
                        ),
                      ),
                    ),
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(10, 22, 10, 0),
                        child: Image.asset(
                          page.imageAsset,
                          fit: BoxFit.contain,
                          excludeFromSemantics: true,
                          errorBuilder: (_, _, _) => Center(
                            child: Icon(
                              Icons.auto_awesome_outlined,
                              size: 64,
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: compact ? 24 : 34),
              Text(
                page.title,
                textAlign: TextAlign.center,
                style: AppTextStyles.h1.copyWith(
                  color: context.textPrimaryColor,
                  fontSize: compact ? 28 : 32,
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 470),
                child: Text(
                  page.description,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.bodyLarge.copyWith(
                    color: context.textSecondaryColor,
                    height: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              _PageBenefit(index: index),
            ],
          ),
        );
      },
    );
  }
}

class _PageBenefit extends StatelessWidget {
  const _PageBenefit({required this.index});

  final int index;

  @override
  Widget build(BuildContext context) {
    const benefits = [
      ('Mesures fiables', Icons.straighten_rounded),
      ('Suivi sans oubli', Icons.task_alt_rounded),
      ('Service plus clair', Icons.favorite_outline_rounded),
    ];
    final item = benefits[index];

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: context.surfaceLightColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(item.$2, size: 18, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: AppSpacing.xs),
          Text(
            item.$1,
            style: AppTextStyles.caption.copyWith(
              color: context.textPrimaryColor,
            ),
          ),
        ],
      ),
    );
  }
}
