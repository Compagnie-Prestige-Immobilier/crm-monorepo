import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:get_it/get_it.dart';
import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../shared/utils/app_logger.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';

import 'database_service.dart';
import '../../shared/utils/app_feedback.dart';
import '../../shared/utils/app_dialogs.dart';
import '../../core/navigation/app_navigator.dart';
import '../../routes/app_routes.dart';

part 'backup_service.g.dart';

@Riverpod(keepAlive: true)
BackupService backup(Ref ref) {
  return BackupService(ref);
}

class BackupService {
  final Ref? _ref;

  BackupService([this._ref]);

  /// Create a backup of the Isar database and share it
  Future<void> createBackup() async {
    try {
      Isar isar;
      if (_ref != null) {
        isar = await _ref.read(databaseProvider.future);
      } else {
        isar = GetIt.I<DatabaseService>().isar;
      }

      // 1. Get DB Directory
      final dbDir = await getApplicationDocumentsDirectory();

      // 2. Prepare Backup Filename (include seconds for uniqueness)
      final dateStr = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final backupFileName = 'gnawalma_backup_$dateStr.isar';
      final backupFile = File('${dbDir.path}/$backupFileName');

      // 3. Copy Isar DB to backup file
      // If file exists (rare with seconds, but possible), delete it first
      if (await backupFile.exists()) {
        await backupFile.delete();
      }

      // Isar.copyToFile is synchronous in some versions, async in others.
      isar.copyToFile(backupFile.path);

      // 4. Share the file
      // ignore: deprecated_member_use
      final result = await Share.shareXFiles(
        [XFile(backupFile.path)],
        subject: 'Sauvegarde Gnawalma $dateStr',
        text: 'Voici ma sauvegarde Gnawalma du $dateStr',
      );

      if (result.status == ShareResultStatus.success) {
        AppFeedback.showSuccess(
          title: 'Succès',
          message: 'Sauvegarde partagée avec succès',
        );
      }
    } catch (e) {
      AppLogger.e('Backup Error', e);
      AppFeedback.showError('Erreur lors de la sauvegarde: $e');
    }
  }

  /// Restore the Isar database from a backup file
  Future<void> restoreBackup() async {
    try {
      // 1. Pick File
      final result = await FilePicker.platform.pickFiles(
        type: FileType
            .any, // 'custom' with 'isar' can fail on some Android versions
        // allowedExtensions: ['isar'],
      );

      if (result == null || result.files.isEmpty) return;

      final path = result.files.single.path;
      if (path == null) return;

      // 2. Confirm Action
      AppDialogs.showConfirmDialog(
        title: 'Restaurer les données ?',
        message:
            'Attention: Toutes les données actuelles seront remplacées par la sauvegarde. L\'application va redémarrer.',
        confirmText: 'Restaurer',
        isDangerous: true,
        onConfirm: () async {
          // Processing logic inside callback
          await _performRestore(path);
        },
      );
    } catch (e) {
      AppLogger.e('Restore Selection Error', e);
    }
  }

  Future<void> _performRestore(String sourcePath) async {
    try {
      // Get DB Directory
      final dbDir = await getApplicationDocumentsDirectory();
      final dbPath = '${dbDir.path}/gnawalma_db.isar';
      final dbLockPath = '${dbDir.path}/gnawalma_db.isar.lock';

      // Close Isar
      if (_ref != null) {
        final isar = await _ref.read(databaseProvider.future);
        isar.close();
      } else {
        await GetIt.I<DatabaseService>().close();
      }

      // Overwrite DB file
      final sourceFile = File(sourcePath);
      if (await sourceFile.exists()) {
        await sourceFile.copy(dbPath);
      } else {
        throw Exception('Fichier source introuvable');
      }

      // Remove lock file if exists
      final lockFile = File(dbLockPath);
      if (await lockFile.exists()) {
        await lockFile.delete();
      }

      // Success & Navigate
      AppFeedback.showSuccess(
        title: 'Succès',
        message: 'Restauration réussie. Veuillez redémarrer l\'application.',
      );

      // Attempt to restart navigation state
      await Future.delayed(const Duration(seconds: 2));

      // Re-initialize Isar (might fail if lock is weird, but worth a shot)
      try {
        if (_ref != null) {
          _ref.invalidate(databaseProvider);
          await _ref.read(databaseProvider.future);
        } else {
          await GetIt.I<DatabaseService>().initialize();
        }
        AppNavigator.offAll(
          AppRoutes.shell,
        ); // Navigate to Shell instead of /home
      } catch (e) {
        // If re-init fails, user must kill app.
        AppFeedback.showError(
          'Veuillez redémarrer manuellement l\'application.',
        );
      }
    } catch (e) {
      AppLogger.e('Restore Logic Error', e);
      // Try to re-init if restore failed to at least keep app running
      try {
        if (_ref != null) {
          _ref.invalidate(databaseProvider);
          await _ref.read(databaseProvider.future);
        } else {
          try {
            await GetIt.I<DatabaseService>().initialize();
          } catch (e) {
            AppLogger.e('Error reinitializing database after restore', e);
            // Continue - error will be shown below
          }
        }
      } catch (e) {
        AppLogger.e('Error during backup restore', e);
      }
      AppFeedback.showError('Erreur lors de la restauration: $e');
    }
  }
}
