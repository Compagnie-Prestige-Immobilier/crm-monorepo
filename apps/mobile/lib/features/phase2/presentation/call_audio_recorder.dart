import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:record/record.dart';

import '../../../core/theme/cpi_tokens.dart';

class CallAudioRecorder extends StatefulWidget {
  const CallAudioRecorder({
    required this.enabled,
    required this.onChanged,
    required this.onRecordingStateChanged,
    super.key,
  });

  final bool enabled;
  final ValueChanged<String?> onChanged;
  final ValueChanged<String?> onRecordingStateChanged;

  @override
  State<CallAudioRecorder> createState() => _CallAudioRecorderState();
}

class _CallAudioRecorderState extends State<CallAudioRecorder> {
  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();
  final List<double> _samples = <double>[];
  StreamSubscription<Amplitude>? _amplitudes;
  StreamSubscription<Duration>? _positions;
  StreamSubscription<Duration?>? _durations;
  StreamSubscription<PlayerState>? _playerState;
  String? _path;
  String? _error;
  bool _recording = false;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  double _speed = 1;

  @override
  void initState() {
    super.initState();
    _positions = _player.positionStream.listen((Duration value) {
      if (mounted) setState(() => _position = value);
    });
    _durations = _player.durationStream.listen((Duration? value) {
      if (mounted && value != null) setState(() => _duration = value);
    });
    _playerState = _player.playerStateStream.listen((PlayerState value) {
      if (!mounted) return;
      setState(() {
        _playing =
            value.playing && value.processingState != ProcessingState.completed;
        if (value.processingState == ProcessingState.completed) {
          _position = Duration.zero;
        }
      });
    });
  }

  @override
  void dispose() {
    unawaited(_amplitudes?.cancel());
    unawaited(_positions?.cancel());
    unawaited(_durations?.cancel());
    unawaited(_playerState?.cancel());
    unawaited(_recorder.dispose());
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) {
      setState(
        () => _error =
            'Autorisez le microphone pour enregistrer une note vocale.',
      );
      return;
    }
    final Directory directory = Directory(
      p.join((await getApplicationSupportDirectory()).path, 'call-recordings'),
    );
    await directory.create(recursive: true);
    final String path = p.join(
      directory.path,
      'note-${DateTime.now().microsecondsSinceEpoch}.m4a',
    );
    await _player.stop();
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 16000,
      ),
      path: path,
    );
    await _amplitudes?.cancel();
    _amplitudes = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 100))
        .listen((Amplitude amplitude) {
          if (!mounted) return;
          setState(() {
            _samples.add(((amplitude.current + 60) / 60).clamp(0.05, 1));
            if (_samples.length > 72) _samples.removeAt(0);
          });
        });
    setState(() {
      _path = path;
      _recording = true;
      _samples.clear();
      _error = null;
      _position = Duration.zero;
      _duration = Duration.zero;
    });
    widget.onRecordingStateChanged(path);
    widget.onChanged(null);
  }

  Future<void> _stop() async {
    final String? path = await _recorder.stop();
    await _amplitudes?.cancel();
    widget.onRecordingStateChanged(null);
    if (path == null) {
      setState(() {
        _recording = false;
        _error = 'La note vocale n’a pas pu être conservée.';
      });
      return;
    }
    await _player.setFilePath(path);
    setState(() {
      _path = path;
      _recording = false;
    });
    widget.onChanged(path);
  }

  Future<void> _togglePlayback() async {
    if (_playing) {
      await _player.pause();
      return;
    }
    if (_player.processingState == ProcessingState.completed) {
      await _player.seek(Duration.zero);
    }
    unawaited(_player.play());
  }

  Future<void> _replace() async {
    await _player.stop();
    final String? previous = _path;
    if (previous != null) {
      await File(previous).delete().catchError((_) => File(previous));
    }
    setState(() {
      _path = null;
      _samples.clear();
      _duration = Duration.zero;
      _position = Duration.zero;
    });
    widget.onChanged(null);
    await _start();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool ready = _path != null && !_recording;
    final double progress = _duration.inMilliseconds == 0
        ? 0
        : (_position.inMilliseconds / _duration.inMilliseconds).clamp(0, 1);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Note vocale de l’appel', style: theme.textTheme.titleSmall),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              'Le microphone du téléphone est enregistré. Prévenez la personne.',
              style: theme.textTheme.bodySmall,
            ),
            if (_recording || ready) ...<Widget>[
              const SizedBox(height: CpiSpacing.sm),
              SizedBox(
                height: 48,
                child: CustomPaint(
                  painter: _WaveformPainter(
                    samples: List<double>.of(_samples),
                    progress: _recording ? 1 : progress,
                    color: theme.colorScheme.primary,
                    background: theme.colorScheme.outlineVariant,
                  ),
                  child: ready
                      ? Slider(
                          value: progress,
                          onChanged: (double value) =>
                              _player.seek(_duration * value),
                          semanticFormatterCallback: (_) => _time(_position),
                        )
                      : null,
                ),
              ),
            ],
            const SizedBox(height: CpiSpacing.xs),
            if (_recording)
              FilledButton.icon(
                onPressed: _stop,
                icon: const Icon(PhosphorIconsFill.stop, size: 18),
                label: const Text('Arrêter l’enregistrement'),
              )
            else if (!ready)
              OutlinedButton.icon(
                onPressed: widget.enabled ? _start : null,
                icon: const Icon(PhosphorIconsRegular.microphone, size: 20),
                label: const Text('Enregistrer une note vocale'),
              )
            else
              Row(
                children: <Widget>[
                  IconButton.filled(
                    onPressed: _togglePlayback,
                    tooltip: _playing ? 'Pause' : 'Écouter',
                    icon: Icon(
                      _playing
                          ? PhosphorIconsFill.pause
                          : PhosphorIconsFill.play,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text('${_time(_position)} / ${_time(_duration)}'),
                  ),
                  DropdownButton<double>(
                    value: _speed,
                    underline: const SizedBox.shrink(),
                    items: const <double>[1, 1.25, 1.5, 2]
                        .map(
                          (double value) => DropdownMenuItem<double>(
                            value: value,
                            child: Text('$value×'),
                          ),
                        )
                        .toList(),
                    onChanged: (double? value) async {
                      if (value == null) return;
                      await _player.setSpeed(value);
                      setState(() => _speed = value);
                    },
                  ),
                  IconButton(
                    onPressed: widget.enabled ? _replace : null,
                    tooltip: 'Recommencer',
                    icon: const Icon(
                      PhosphorIconsRegular.arrowCounterClockwise,
                      size: 20,
                    ),
                  ),
                ],
              ),
            if (_error != null) ...<Widget>[
              const SizedBox(height: CpiSpacing.xs),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ],
          ],
        ),
      ),
    );
  }
}

String _time(Duration value) {
  final int minutes = value.inMinutes;
  final int seconds = value.inSeconds.remainder(60);
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

class _WaveformPainter extends CustomPainter {
  const _WaveformPainter({
    required this.samples,
    required this.progress,
    required this.color,
    required this.background,
  });

  final List<double> samples;
  final double progress;
  final Color color;
  final Color background;

  @override
  void paint(Canvas canvas, Size size) {
    final List<double> bars = samples.isEmpty
        ? List<double>.filled(48, 0.18)
        : samples;
    final double width = size.width / bars.length;
    for (int index = 0; index < bars.length; index += 1) {
      final double height = (size.height * bars[index]).clamp(4, size.height);
      final Paint paint = Paint()
        ..color = index / bars.length <= progress ? color : background
        ..strokeWidth = (width * 0.55).clamp(2, 5)
        ..strokeCap = StrokeCap.round;
      final double x = (index + 0.5) * width;
      canvas.drawLine(
        Offset(x, (size.height - height) / 2),
        Offset(x, (size.height + height) / 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_WaveformPainter oldDelegate) =>
      oldDelegate.samples != samples || oldDelegate.progress != progress;
}
