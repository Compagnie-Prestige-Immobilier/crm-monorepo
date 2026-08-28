import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:record/record.dart';

import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_forui.dart';
import '../../../ui/widgets/cpi_kit.dart';

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
    // La boîte de permission Android met l'application en pause : au retour, ce
    // State peut avoir été détruit et tout `setState` d'ici plante.
    if (!await _recorder.hasPermission()) {
      if (!mounted) return;
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
    if (!mounted) return;
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
      if (!mounted) return;
      setState(() {
        _recording = false;
        _error = 'La note vocale n’a pas pu être conservée.';
      });
      return;
    }
    await _player.setFilePath(path);
    // Le fichier existe : la fiche doit le recevoir même si l'écran est parti.
    widget.onChanged(path);
    if (!mounted) return;
    setState(() {
      _path = path;
      _recording = false;
    });
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
    final bool? ok = await cpiConfirm(
      context,
      title: 'Effacer cette note ?',
      message: 'L\'enregistrement actuel sera supprimé.',
      confirmLabel: 'Effacer et recommencer',
      danger: true,
    );
    if (ok != true || !mounted) return;
    await _player.stop();
    final String? previous = _path;
    if (previous != null) {
      await File(previous).delete().catchError((_) => File(previous));
    }
    if (!mounted) return;
    setState(() {
      _path = null;
      _samples.clear();
      _duration = Duration.zero;
      _position = Duration.zero;
    });
    widget.onChanged(null);
    await _start();
  }

  /// La bande d'onde EST la molette de position : le doigt s'y pose et y
  /// glisse. Un curseur séparé demandait une seconde cible sur un bloc déjà
  /// serré, et il n'y avait pas la place.
  void _seekTo(Offset local, double width) {
    if (width <= 0) return;
    unawaited(_player.seek(_duration * (local.dx / width).clamp(0, 1)));
  }

  Future<void> _pickSpeed(BuildContext context) async {
    final double? choix = await showCpiSheet<double>(
      context,
      title: 'Vitesse de lecture',
      builder: (BuildContext context) => CpiCard.rows(<CpiRow>[
        for (final double value in const <double>[1, 1.25, 1.5, 2])
          CpiRow(
            title: '$value×',
            trailing: value == _speed
                ? const Icon(
                    PhosphorIconsFill.checkCircle,
                    size: CpiIconSize.md,
                  )
                : null,
            onTap: () => Navigator.of(context).pop(value),
          ),
      ]),
    );
    if (choix == null) return;
    await _player.setSpeed(choix);
    if (!mounted) return;
    setState(() => _speed = choix);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final bool ready = _path != null && !_recording;
      final double progress = _duration.inMilliseconds == 0
          ? 0
          : (_position.inMilliseconds / _duration.inMilliseconds).clamp(0, 1);

      return CpiCard(
        padding: const EdgeInsets.all(CpiSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Note vocale de l’appel', style: theme.textTheme.titleSmall),
            const SizedBox(height: CpiSpacing.xxs),
            Text(
              'Le microphone du téléphone est enregistré. Prévenez la personne.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (_recording || ready) ...<Widget>[
              const SizedBox(height: CpiSpacing.sm),
              _Waveform(
                samples: List<double>.of(_samples),
                progress: _recording ? 1 : progress,
                color: theme.colorScheme.primary,
                background: context.theme.colors.border,
                position: _time(_position),
                onSeek: ready ? _seekTo : null,
              ),
            ],
            const SizedBox(height: CpiSpacing.xs),
            if (_recording)
              CpiButton(
                'Arrêter l’enregistrement',
                icon: PhosphorIconsFill.stop,
                onPressed: _stop,
              )
            else if (!ready)
              CpiButton(
                'Enregistrer une note vocale',
                variant: CpiButtonVariant.secondary,
                icon: PhosphorIconsRegular.microphone,
                onPressed: widget.enabled ? _start : null,
              )
            else
              Row(
                spacing: CpiSpacing.xs,
                children: <Widget>[
                  _IconAction(
                    label: _playing ? 'Pause' : 'Écouter',
                    icon: _playing
                        ? PhosphorIconsFill.pause
                        : PhosphorIconsFill.play,
                    variant: FButtonVariant.primary,
                    onPress: _togglePlayback,
                  ),
                  Expanded(
                    child: Text('${_time(_position)} / ${_time(_duration)}'),
                  ),
                  Builder(
                    builder: (BuildContext context) => CpiButton(
                      '$_speed×',
                      variant: CpiButtonVariant.ghost,
                      expand: false,
                      onPressed: () => unawaited(_pickSpeed(context)),
                    ),
                  ),
                  _IconAction(
                    label: 'Recommencer',
                    icon: PhosphorIconsRegular.arrowCounterClockwise,
                    variant: FButtonVariant.ghost,
                    onPress: widget.enabled ? _replace : null,
                  ),
                ],
              ),
            if (_error != null) ...<Widget>[
              const SizedBox(height: CpiSpacing.xs),
              Semantics(
                liveRegion: true,
                child: FAlert(
                  variant: FAlertVariant.destructive,
                  icon: const Icon(PhosphorIconsRegular.warningCircle),
                  title: Text(_error!),
                ),
              ),
            ],
          ],
        ),
      );
    },
  );
}

/// Bouton d'action sans libellé visible : le lecteur d'écran en reçoit un.
class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.label,
    required this.icon,
    required this.variant,
    required this.onPress,
  });

  final String label;
  final IconData icon;
  final FButtonVariant variant;
  final VoidCallback? onPress;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    child: ExcludeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: kCpiMinTouchTarget,
          minHeight: kCpiMinTouchTarget,
        ),
        child: FButton.icon(
          variant: variant,
          onPress: onPress,
          child: Icon(icon, size: CpiIconSize.md),
        ),
      ),
    ),
  );
}

class _Waveform extends StatelessWidget {
  const _Waveform({
    required this.samples,
    required this.progress,
    required this.color,
    required this.background,
    required this.position,
    required this.onSeek,
  });

  final List<double> samples;
  final double progress;
  final Color color;
  final Color background;
  final String position;
  final void Function(Offset local, double width)? onSeek;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints box) {
      final Widget onde = SizedBox(
        height: kCpiMinTouchTarget,
        child: CustomPaint(
          size: Size(box.maxWidth, kCpiMinTouchTarget),
          painter: _WaveformPainter(
            samples: samples,
            progress: progress,
            color: color,
            background: background,
          ),
        ),
      );
      final void Function(Offset, double)? seek = onSeek;
      if (seek == null) return onde;
      return Semantics(
        slider: true,
        label: 'Position de lecture',
        value: position,
        child: ExcludeSemantics(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (TapDownDetails d) =>
                seek(d.localPosition, box.maxWidth),
            onHorizontalDragUpdate: (DragUpdateDetails d) =>
                seek(d.localPosition, box.maxWidth),
            child: onde,
          ),
        ),
      );
    },
  );
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
