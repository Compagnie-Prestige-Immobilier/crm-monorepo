import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/constants/unified_measurements.dart';
import '../../../core/navigation/app_navigator.dart';
import 'add_edit_measurement_state.dart';

part 'add_edit_measurement_provider.g.dart';

@riverpod
class AddEditMeasurement extends _$AddEditMeasurement {
  late final TextEditingController bustController;
  late final TextEditingController waistController;
  late final TextEditingController hipController;
  late final TextEditingController backLengthController;
  late final TextEditingController sleeveLengthController;
  late final TextEditingController inseamLengthController;
  late final TextEditingController neckController;
  late final TextEditingController shoulderWidthController;
  late final TextEditingController totalHeightController;
  late final TextEditingController armCircController;
  late final TextEditingController skirtLengthController;
  late final TextEditingController pantsLengthController;
  late final TextEditingController notesController;
  final formKey = GlobalKey<FormState>();

  @override
  AddEditMeasurementState build({ClientModel? initialClient}) {
    _initControllers();

    if (initialClient == null) {
      throw Exception('Client is required');
    }

    // Pre-fill with latest measurements if available
    final latestMeasurement = initialClient.latestMeasurement;
    if (latestMeasurement != null) {
      _loadMeasurementData(latestMeasurement);
    }

    return AddEditMeasurementState(client: initialClient);
  }

  void _initControllers() {
    bustController = TextEditingController();
    waistController = TextEditingController();
    hipController = TextEditingController();
    backLengthController = TextEditingController();
    sleeveLengthController = TextEditingController();
    inseamLengthController = TextEditingController();
    neckController = TextEditingController();
    shoulderWidthController = TextEditingController();
    totalHeightController = TextEditingController();
    armCircController = TextEditingController();
    skirtLengthController = TextEditingController();
    pantsLengthController = TextEditingController();
    notesController = TextEditingController();

    ref.onDispose(() {
      bustController.dispose();
      waistController.dispose();
      hipController.dispose();
      backLengthController.dispose();
      sleeveLengthController.dispose();
      inseamLengthController.dispose();
      neckController.dispose();
      shoulderWidthController.dispose();
      totalHeightController.dispose();
      armCircController.dispose();
      skirtLengthController.dispose();
      pantsLengthController.dispose();
      notesController.dispose();
    });
  }

  void _loadMeasurementData(MeasurementRecord measurement) {
    if (measurement.bustCircumference != null) {
      bustController.text = measurement.bustCircumference.toString();
    }
    if (measurement.waistCircumference != null) {
      waistController.text = measurement.waistCircumference.toString();
    }
    if (measurement.hipCircumference != null) {
      hipController.text = measurement.hipCircumference.toString();
    }
    if (measurement.backLength != null) {
      backLengthController.text = measurement.backLength.toString();
    }
    if (measurement.sleeveLength != null) {
      sleeveLengthController.text = measurement.sleeveLength.toString();
    }
    if (measurement.inseamLength != null) {
      inseamLengthController.text = measurement.inseamLength.toString();
    }
    if (measurement.neckCircumference != null) {
      neckController.text = measurement.neckCircumference.toString();
    }
    if (measurement.shoulderWidth != null) {
      shoulderWidthController.text = measurement.shoulderWidth.toString();
    }
    if (measurement.totalHeight != null) {
      totalHeightController.text = measurement.totalHeight.toString();
    }
    if (measurement.armCircumference != null) {
      armCircController.text = measurement.armCircumference.toString();
    }
    if (measurement.skirtLength != null) {
      skirtLengthController.text = measurement.skirtLength.toString();
    }
    if (measurement.pantsLength != null) {
      pantsLengthController.text = measurement.pantsLength.toString();
    }
    if (measurement.notes != null) {
      notesController.text = measurement.notes!;
    }

    // Load custom measurements
    for (var custom in measurement.customMeasurements) {
      addCustomMeasurement(custom.name, custom.value);
    }
  }

  void addCustomMeasurement(String name, double value) {
    if (name.trim().isEmpty) return;
    state = state.copyWith(
      customMeasurements: {...state.customMeasurements, name.trim(): value},
    );
  }

  void removeCustomMeasurement(String name) {
    final newMap = {...state.customMeasurements}..remove(name);
    state = state.copyWith(customMeasurements: newMap);
  }

  Future<void> saveMeasurement() async {
    if (!formKey.currentState!.validate()) return;

    state = state.copyWith(isSaving: true);
    try {
      final measurement = MeasurementRecord()
        ..recordedDate = DateTime.now()
        ..bustCircumference = _parseDouble(bustController.text)
        ..waistCircumference = _parseDouble(waistController.text)
        ..hipCircumference = _parseDouble(hipController.text)
        ..backLength = _parseDouble(backLengthController.text)
        ..sleeveLength = _parseDouble(sleeveLengthController.text)
        ..inseamLength = _parseDouble(inseamLengthController.text)
        ..neckCircumference = _parseDouble(neckController.text)
        ..shoulderWidth = _parseDouble(shoulderWidthController.text)
        ..totalHeight = _parseDouble(totalHeightController.text)
        ..armCircumference = _parseDouble(armCircController.text)
        ..skirtLength = _parseDouble(skirtLengthController.text)
        ..pantsLength = _parseDouble(pantsLengthController.text)
        ..notes = notesController.text.isEmpty ? null : notesController.text;

      // --- VALIDATION: Humanly Possible Ranges ---
      final validationErrors = <String>[];
      for (final field in UnifiedMeasurements.fields) {
        final val = _getMeasurementValueByKey(measurement, field.key);
        if (val != null && (val < field.min || val > field.max)) {
          validationErrors.add(
            '${field.labelFr} (${val.toStringAsFixed(1)} cm) hors limite [${field.min}-${field.max}]',
          );
        }
      }

      if (validationErrors.isNotEmpty) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError('Limites dépassées : ${validationErrors.first}');
        state = state.copyWith(isSaving: false);
        return;
      }

      // Add custom measurements
      for (var entry in state.customMeasurements.entries) {
        measurement.addCustomMeasurement(entry.key, entry.value);
      }

      // Check if empty
      if (measurement.isEmpty) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showWarning('Veuillez renseigner au moins une mesure.');
        state = state.copyWith(isSaving: false);
        return;
      }

      // Add measurement to client
      final client = state.client!;
      client.addMeasurement(measurement);

      // Update client in database
      final repository = await ref.read(clientRepositoryProvider.future);
      await repository.updateClient(client);

      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess('Succès', 'Mesures enregistrées');
      AppNavigator.back(true);
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de sauvegarder les mesures: $e');
    } finally {
      state = state.copyWith(isSaving: false);
    }
  }

  double? _parseDouble(String text) {
    if (text.trim().isEmpty) return null;
    return AppNumbers.tryParse(text.trim());
  }

  double? _getMeasurementValueByKey(MeasurementRecord record, String key) {
    switch (key) {
      case 'tourCou':
        return record.neckCircumference;
      case 'tourEpaule':
        return record.shoulderWidth;
      case 'tourPoitrine':
        return record.bustCircumference;
      case 'tourTaille':
        return record.waistCircumference;
      case 'tourHanches':
        return record.hipCircumference;
      case 'longueurTotale':
        return record.totalHeight;
      case 'epauleGenou':
        return record.backLength;
      case 'tailleSol':
        return record.inseamLength;
      default:
        return null;
    }
  }
}
