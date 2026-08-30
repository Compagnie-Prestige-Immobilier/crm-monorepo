// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audio_recorder_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(audioRecorder)
final audioRecorderProvider = AudioRecorderProvider._();

final class AudioRecorderProvider
    extends
        $FunctionalProvider<
          AsyncValue<AudioRecorderService>,
          AudioRecorderService,
          FutureOr<AudioRecorderService>
        >
    with
        $FutureModifier<AudioRecorderService>,
        $FutureProvider<AudioRecorderService> {
  AudioRecorderProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'audioRecorderProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$audioRecorderHash();

  @$internal
  @override
  $FutureProviderElement<AudioRecorderService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<AudioRecorderService> create(Ref ref) {
    return audioRecorder(ref);
  }
}

String _$audioRecorderHash() => r'e8f6b514ee0b0bf74c501790a32e5a12e5c992ed';
