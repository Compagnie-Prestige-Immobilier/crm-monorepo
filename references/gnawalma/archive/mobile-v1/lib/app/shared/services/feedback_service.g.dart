// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'feedback_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(FeedbackService)
final feedbackServiceProvider = FeedbackServiceProvider._();

final class FeedbackServiceProvider
    extends $NotifierProvider<FeedbackService, FeedbackState> {
  FeedbackServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'feedbackServiceProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$feedbackServiceHash();

  @$internal
  @override
  FeedbackService create() => FeedbackService();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(FeedbackState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<FeedbackState>(value),
    );
  }
}

String _$feedbackServiceHash() => r'39a050381606ec3f5d0620ac89eb05c324905ec0';

abstract class _$FeedbackService extends $Notifier<FeedbackState> {
  FeedbackState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<FeedbackState, FeedbackState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<FeedbackState, FeedbackState>,
              FeedbackState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
