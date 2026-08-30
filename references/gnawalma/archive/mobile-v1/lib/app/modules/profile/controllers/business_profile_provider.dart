import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';
import 'package:palette_generator/palette_generator.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/business_profile_model.dart';
import '../../../data/services/business_profile_service.dart';
import '../../../data/services/image_service.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/services/feedback_service.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../setup_wizard/domain/atelier_regions.dart';
import 'business_profile_state.dart';

part 'business_profile_provider.g.dart';

@riverpod
class BusinessProfile extends _$BusinessProfile {
  late final TextEditingController businessNameController;
  late final TextEditingController addressController;
  late final TextEditingController phoneController;
  late final TextEditingController emailController;
  late final TextEditingController footerNoteController;
  late final TextEditingController taxIdController;
  final formKey = GlobalKey<FormState>();

  /// Snapshot of the last persisted field values, used to detect edits that
  /// would be lost on back navigation.
  List<String> _savedSnapshot = const [];

  List<String> get _currentSnapshot => [
    businessNameController.text,
    addressController.text,
    phoneController.text,
    emailController.text,
    footerNoteController.text,
    taxIdController.text,
    state.regionId ?? '',
    state.specialties.join(','),
  ];

  bool get hasUnsavedChanges {
    if (_savedSnapshot.isEmpty) return false;
    final current = _currentSnapshot;
    for (var i = 0; i < current.length; i++) {
      if (current[i] != _savedSnapshot[i]) return true;
    }
    return false;
  }

  @override
  BusinessProfileState build() {
    businessNameController = TextEditingController();
    addressController = TextEditingController();
    phoneController = TextEditingController();
    emailController = TextEditingController();
    footerNoteController = TextEditingController();
    taxIdController = TextEditingController();

    ref.onDispose(() {
      businessNameController.dispose();
      addressController.dispose();
      phoneController.dispose();
      emailController.dispose();
      footerNoteController.dispose();
      taxIdController.dispose();
    });

    Future.microtask(() => _loadProfile());
    return const BusinessProfileState();
  }

  Future<void> _loadProfile() async {
    state = state.copyWith(isLoading: true);
    try {
      final service = GetIt.I<BusinessProfileService>();
      final profile = await service.getProfile();
      if (profile != null) {
        businessNameController.text = profile.businessName ?? '';
        addressController.text = profile.address ?? '';
        phoneController.text = profile.phone ?? '';
        emailController.text = profile.email ?? '';
        footerNoteController.text = profile.footerNote ?? '';
        taxIdController.text = profile.taxId ?? '';
        state = state.copyWith(
          logoPath: profile.logoPath,
          brandColor: profile.brandColorValue != null
              ? Color(profile.brandColorValue!)
              : null,
        );

        if (profile.logoPath != null && profile.brandColorValue == null) {
          await _extractBrandColor(profile.logoPath!);
        }
      }

      // L'atelier publié écrase le profil local là où les deux se recouvrent :
      // c'est lui que les clients voient, et l'écran servait jusqu'ici une copie
      // locale que rien ne renvoyait au serveur.
      await _loadRemoteAtelier();
    } finally {
      _savedSnapshot = _currentSnapshot;
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> _loadRemoteAtelier() async {
    try {
      final atelier = await ref.read(primaryRemoteAtelierProvider.future);
      if (atelier == null) return;
      businessNameController.text = atelier.name;
      if (atelier.phone.trim().isNotEmpty) {
        phoneController.text = atelier.phone;
      }
      if ((atelier.address ?? '').trim().isNotEmpty) {
        addressController.text = atelier.address!;
      }
      state = state.copyWith(
        remoteAtelierId: atelier.id,
        regionId: AtelierRegions.byLabel(atelier.region)?.id,
        specialties: atelier.specialties,
      );
    } catch (_) {
      // Hors ligne, l'écran reste utilisable sur la copie locale ; seule la
      // publication attendra la prochaine connexion.
    }
  }

  void setRegion(String regionId) {
    state = state.copyWith(regionId: regionId);
  }

  void toggleSpecialty(String specialty) {
    final next = List<String>.from(state.specialties);
    if (!next.remove(specialty)) next.add(specialty);
    state = state.copyWith(specialties: next);
  }

  Future<void> _extractBrandColor(String path) async {
    try {
      final imageProvider = FileImage(File(path));
      final paletteGenerator = await PaletteGenerator.fromImageProvider(
        imageProvider,
        maximumColorCount: 10,
      );

      final color =
          paletteGenerator.dominantColor?.color ??
          paletteGenerator.vibrantColor?.color ??
          paletteGenerator.mutedColor?.color;

      if (color != null) {
        state = state.copyWith(brandColor: color);
      }
    } catch (e) {
      // Ignore extraction errors
    }
  }

  /// Picks a logo from [source] and stores it.
  ///
  /// Was gallery-only and silent: no progress while the file was copied, and a
  /// failure — a denied camera permission, an unreadable file — left the well
  /// unchanged with nothing said, so the tap looked ignored.
  Future<void> pickLogo(ImageSource source) async {
    state = state.copyWith(isPickingLogo: true, logoError: null);
    try {
      final XFile? image = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image == null) return;

      final savedPath = await ImageService().saveImage(image.path);
      state = state.copyWith(logoPath: savedPath);
      await _extractBrandColor(savedPath);
      await _publishLogo(savedPath);
    } catch (_) {
      state = state.copyWith(
        logoError: source == ImageSource.camera
            ? 'Impossible d’ouvrir l’appareil photo. Vérifiez l’autorisation.'
            : 'Impossible de lire cette image. Choisissez-en une autre.',
      );
    } finally {
      state = state.copyWith(isPickingLogo: false);
    }
  }

  /// Clears the logo and the colour derived from it.
  void removeLogo() {
    state = BusinessProfileState(
      isLoading: state.isLoading,
      logoPath: null,
      brandColor: null,
    );
  }

  Future<bool> saveProfile() async {
    if (!formKey.currentState!.validate()) return false;

    state = state.copyWith(isLoading: true);
    try {
      final service = GetIt.I<BusinessProfileService>();
      final profile = BusinessProfileModel(
        businessName: businessNameController.text,
        address: addressController.text,
        phone: phoneController.text,
        email: emailController.text,
        footerNote: footerNoteController.text,
        taxId: taxIdController.text,
        logoPath: state.logoPath,
        brandColorValue: state.brandColor?.toARGB32(),
      );

      await service.saveProfile(profile);
      final published = await _publishToMarketplace();
      _savedSnapshot = _currentSnapshot;
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(
            'Succès',
            published
                ? 'Profil mis à jour, y compris sur votre fiche publique'
                : 'Profil enregistré sur cet appareil',
          );
      return true;
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de sauvegarder le profil');
      return false;
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Envoie le logo à la fiche publique.
  ///
  /// Le choix d'un logo n'était jusqu'ici qu'un fichier local servant aux reçus
  /// imprimés ; la fiche que voient les clients restait sans image.
  Future<void> _publishLogo(String path) async {
    final atelierId = state.remoteAtelierId;
    if (atelierId == null) return;
    try {
      await ref
          .read(operationsRepositoryProvider)
          .uploadAtelierMedia(
            atelierId: atelierId,
            filePath: path,
            kind: 'logo',
          );
      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
    } catch (_) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError(
            'Logo enregistré sur l’appareil, mais pas encore sur votre fiche publique.',
          );
    }
  }

  /// Renvoie les champs publics vers `PATCH /operations/ateliers/:id`.
  ///
  /// L'écran n'écrivait qu'en local : un atelier qui corrigeait son nom, son
  /// téléphone ou son adresse ici gardait indéfiniment les anciennes valeurs
  /// dans la recherche cliente.
  Future<bool> _publishToMarketplace() async {
    final atelierId = state.remoteAtelierId;
    if (atelierId == null) return false;
    final region = AtelierRegions.byId(state.regionId);
    try {
      await ref
          .read(operationsRepositoryProvider)
          .updateAtelier(
            atelierId,
            name: businessNameController.text.trim(),
            phone: phoneController.text.trim().isEmpty
                ? null
                : phoneController.text.trim(),
            address: addressController.text.trim(),
            region: region?.label,
            latitude: region?.latitude,
            longitude: region?.longitude,
            specialties: state.specialties,
          );
      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
      return true;
    } on ApiException catch (error) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Fiche publique non mise à jour : ${error.message}');
      return false;
    } catch (_) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError(
            'Fiche publique non mise à jour. Vérifiez votre connexion.',
          );
      return false;
    }
  }
}
