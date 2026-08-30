import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

import '../../../data/services/audio_recorder_service.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/app_feedback.dart';

class VoiceNoteRecorder extends StatefulWidget {
  final Function(String?) onRecordingComplete;
  final String? existingAudioPath;
  final VoidCallback? onDelete;

  const VoiceNoteRecorder({
    super.key,
    required this.onRecordingComplete,
    this.existingAudioPath,
    this.onDelete,
  });

  @override
  State<VoiceNoteRecorder> createState() => _VoiceNoteRecorderState();
}

class _VoiceNoteRecorderState extends State<VoiceNoteRecorder> {
  final AudioRecorderService _audioService = GetIt.I<AudioRecorderService>();

  StreamSubscription<PlayerState>? _playerSubscription;
  bool _isRecording = false;
  bool _isPlaying = false;
  String? _currentPath;

  @override
  void initState() {
    super.initState();
    _currentPath = widget.existingAudioPath;
    _playerSubscription = _audioService.audioPlayer.onPlayerStateChanged.listen(
      (state) {
        if (!mounted) return;
        setState(() {
          _isPlaying = state == PlayerState.playing;
        });
      },
    );
  }

  @override
  void dispose() {
    _playerSubscription?.cancel();
    super.dispose();
  }

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      final path = await _audioService.stopRecording();
      if (!mounted) return;
      setState(() {
        _isRecording = false;
        _currentPath = path;
      });
      if (path != null) {
        widget.onRecordingComplete(path);
        AppFeedback.showSuccess(
          title: 'Note vocale',
          message: 'Enregistrement sauvegardé',
        );
      } else {
        AppFeedback.showError('Erreur lors de l\'enregistrement');
      }
      return;
    }

    final hasPermission = await _audioService.init();
    if (!hasPermission) {
      AppFeedback.showError('Permission microphone requise');
      return;
    }

    await _audioService.startRecording();
    if (!mounted) return;
    setState(() {
      _isRecording = true;
      _currentPath = null;
      _isPlaying = false;
    });
  }

  Future<void> _togglePlayback() async {
    if (_currentPath == null) return;
    if (_isPlaying) {
      await _audioService.stopPlayback();
      return;
    }
    await _audioService.playAudio(_currentPath!);
  }

  Future<void> _deleteRecording() async {
    await _audioService.stopPlayback();
    if (!mounted) return;
    setState(() {
      _currentPath = null;
      _isPlaying = false;
      _isRecording = false;
    });
    widget.onDelete?.call();
    widget.onRecordingComplete(null);
  }

  @override
  Widget build(BuildContext context) {
    final hasRecording = _currentPath != null;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: _isRecording
            ? context.statusSurface(AppColors.error)
            : context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
        border: Border.all(
          color: _isRecording
              ? context.statusForeground(AppColors.error)
              : (hasRecording
                    ? Theme.of(context).colorScheme.primary
                    : context.borderColor),
          width: _isRecording ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          IconButton(
            // Icon-only, and the icon changes meaning with the state — without
            // a label it announced as "button" in all four of them.
            tooltip: _isRecording
                ? 'Arrêter l’enregistrement'
                : hasRecording
                ? (_isPlaying ? 'Mettre en pause' : 'Écouter la note')
                : 'Enregistrer une note vocale',
            onPressed: hasRecording && !_isRecording
                ? _togglePlayback
                : _toggleRecording,
            icon: Icon(
              _isRecording
                  ? Icons.stop
                  : hasRecording
                  ? (_isPlaying ? Icons.pause : Icons.play_arrow)
                  : Icons.mic,
              color: _isRecording || hasRecording
                  ? Theme.of(context).colorScheme.primary
                  : context.textSecondaryColor,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              _isRecording
                  ? 'Enregistrement en cours...'
                  : hasRecording
                  ? 'Note vocale enregistrée'
                  : 'Appuyez pour enregistrer',
            ),
          ),
          if (hasRecording && !_isRecording)
            IconButton(
              tooltip: 'Supprimer la note vocale',
              onPressed: _deleteRecording,
              icon: const Icon(Icons.delete_outline, color: AppColors.error),
            ),
        ],
      ),
    );
  }
}
