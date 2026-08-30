// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'template_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(templateService)
final templateServiceProvider = TemplateServiceProvider._();

final class TemplateServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<TemplateService>,
          TemplateService,
          FutureOr<TemplateService>
        >
    with $FutureModifier<TemplateService>, $FutureProvider<TemplateService> {
  TemplateServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'templateServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$templateServiceHash();

  @$internal
  @override
  $FutureProviderElement<TemplateService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<TemplateService> create(Ref ref) {
    return templateService(ref);
  }
}

String _$templateServiceHash() => r'172f3b0373dcaaf282091b57dbb82147163f00c3';
