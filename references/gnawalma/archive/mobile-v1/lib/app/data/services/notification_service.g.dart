// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(notification)
final notificationProvider = NotificationProvider._();

final class NotificationProvider
    extends
        $FunctionalProvider<
          AsyncValue<NotificationService>,
          NotificationService,
          FutureOr<NotificationService>
        >
    with
        $FutureModifier<NotificationService>,
        $FutureProvider<NotificationService> {
  NotificationProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationHash();

  @$internal
  @override
  $FutureProviderElement<NotificationService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NotificationService> create(Ref ref) {
    return notification(ref);
  }
}

String _$notificationHash() => r'164c7e114a5539aa259a80667ab9538a8de58d9f';
