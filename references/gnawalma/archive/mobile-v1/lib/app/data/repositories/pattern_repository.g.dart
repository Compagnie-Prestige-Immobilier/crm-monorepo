// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pattern_repository.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(patternRepository)
final patternRepositoryProvider = PatternRepositoryProvider._();

final class PatternRepositoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<PatternRepository>,
          PatternRepository,
          FutureOr<PatternRepository>
        >
    with
        $FutureModifier<PatternRepository>,
        $FutureProvider<PatternRepository> {
  PatternRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'patternRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$patternRepositoryHash();

  @$internal
  @override
  $FutureProviderElement<PatternRepository> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<PatternRepository> create(Ref ref) {
    return patternRepository(ref);
  }
}

String _$patternRepositoryHash() => r'1974fd08c4edfaa221539f4ecde525f5cb0c0974';
