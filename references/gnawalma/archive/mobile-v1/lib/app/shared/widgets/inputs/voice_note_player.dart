import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../data/services/audio_recorder_service.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';

/// Lecture seule d'une note vocale déjà enregistrée.
///
/// [VoiceNoteRecorder] sait aussi jouer, mais il propose d'enregistrer et de
/// supprimer : sur une commande déjà passée, ces deux gestes n'ont pas de sens.
class VoiceNotePlayer extends StatefulWidget {
  const VoiceNotePlayer({super.key, required this.audioPath});

  final String audioPath;

  @override
  State<VoiceNotePlayer> createState() => _VoiceNotePlayerState();
}

class _VoiceNotePlayerState extends State<VoiceNotePlayer> {
  final AudioRecorderService _audioService = GetIt.I<AudioRecorderService>();
  StreamSubscription<PlayerState>? _subscription;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _subscription = _audioService.audioPlayer.onPlayerStateChanged.listen((
      state,
    ) {
      if (!mounted) return;
      setState(() => _isPlaying = state == PlayerState.playing);
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_isPlaying) {
      await _audioService.stopPlayback();
      return;
    }
    await _audioService.playAudio(widget.audioPath);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton.filledTonal(
          tooltip: _isPlaying ? 'Arrêter' : 'Écouter la note',
          onPressed: _toggle,
          icon: Icon(_isPlaying ? Icons.stop_rounded : Icons.play_arrow_rounded),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            _isPlaying ? 'Lecture en cours…' : 'Note vocale du client',
            style: TextStyle(color: context.textPrimaryColor),
          ),
        ),
      ],
    );
  }
}
