import 'dart:async';
import 'dart:io';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';
import '../../shared/utils/app_logger.dart';

part 'audio_recorder_service.g.dart';

@Riverpod(keepAlive: true)
Future<AudioRecorderService> audioRecorder(Ref ref) async {
  final service = AudioRecorderService();
  await service.init();
  ref.onDispose(() => service.dispose());
  return service;
}

class AudioRecorderService {
  final AudioRecorder _audioRecorder = AudioRecorder();
  final AudioPlayer _audioPlayer = AudioPlayer();

  bool isRecording = false;
  bool isPlaying = false;
  String? currentRecordingPath;

  // Stream for amplitude updates
  StreamSubscription<Amplitude>? _amplitudeSubscription;
  final _amplitudeController = StreamController<double>.broadcast();
  Stream<double> get amplitudeStream => _amplitudeController.stream;

  // Initialize and check permissions
  Future<bool> init() async {
    final status = await Permission.microphone.request();
    if (status == PermissionStatus.granted) {
      AppLogger.i('Microphone permission granted');
      return true;
    } else {
      AppLogger.e('Microphone permission denied: $status');
      return false;
    }
  }

  // Start recording with amplitude monitoring
  Future<void> startRecording() async {
    try {
      final hasPermission = await _audioRecorder.hasPermission();
      AppLogger.i('Has permission check: $hasPermission');

      if (hasPermission) {
        final directory = await getApplicationDocumentsDirectory();
        final fileName = 'note_${const Uuid().v4()}.m4a';
        final path = '${directory.path}/$fileName';

        // Configure for better audio quality
        const config = RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 96000,
          sampleRate: 44100,
        );

        await _audioRecorder.start(config, path: path);
        isRecording = true;
        currentRecordingPath = path;
        AppLogger.i('Started recording to $path');

        // Start listening for amplitude
        _amplitudeSubscription = _audioRecorder
            .onAmplitudeChanged(const Duration(milliseconds: 100))
            .listen((amp) {
              // Normalize amplitude (dB is usually negative, closer to 0 = louder)
              // Convert to 0-1 range for visualization
              final normalized = (amp.current + 60) / 60; // -60dB to 0dB range
              _amplitudeController.add(normalized.clamp(0.0, 1.0));
            });
      } else {
        AppLogger.e('No microphone permission');
      }
    } catch (e) {
      AppLogger.e('Error starting recording', e);
    }
  }

  // Stop recording
  Future<String?> stopRecording() async {
    try {
      _amplitudeSubscription?.cancel();
      _amplitudeSubscription = null;

      final path = await _audioRecorder.stop();
      isRecording = false;
      AppLogger.i('Stopped recording. File saved at $path');

      // Verify file was created
      if (path != null && File(path).existsSync()) {
        final file = File(path);
        final size = await file.length();
        AppLogger.i('Recording file size: $size bytes');
        if (size > 0) {
          return path;
        } else {
          AppLogger.e('Recording file is empty!');
          return null;
        }
      }
      return path;
    } catch (e) {
      AppLogger.e('Error stopping recording', e);
      return null;
    }
  }

  // Play audio
  Future<void> playAudio(String path) async {
    try {
      if (File(path).existsSync()) {
        await _audioPlayer.play(DeviceFileSource(path));
        isPlaying = true;
        AppLogger.i('Playing audio from $path');
      } else {
        AppLogger.e('Audio file not found at $path');
      }
    } catch (e) {
      AppLogger.e('Error playing audio', e);
    }
  }

  // Stop playback
  Future<void> stopPlayback() async {
    await _audioPlayer.stop();
    isPlaying = false;
  }

  // Get audio player for listening to completion
  AudioPlayer get audioPlayer => _audioPlayer;

  // Dispose
  void dispose() {
    _amplitudeSubscription?.cancel();
    _amplitudeController.close();
    _audioRecorder.dispose();
    _audioPlayer.dispose();
  }
}
