import 'package:flutter/material.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'business_profile_state.freezed.dart';

@freezed
abstract class BusinessProfileState with _$BusinessProfileState {
  const factory BusinessProfileState({
    @Default(false) bool isLoading,
    String? logoPath,
    Color? brandColor,

    /// True while a chosen image is being copied into app storage.
    @Default(false) bool isPickingLogo,

    /// Set when a pick fails, so the error can be shown at the well rather
    /// than as a toast — a toast never stands in for a correctable error.
    String? logoError,

    /// L'atelier publié, quand il existe. C'est lui la source de vérité du nom,
    /// du téléphone, de l'adresse, de la région et des spécialités : le profil
    /// local ne sert plus qu'aux documents imprimés.
    String? remoteAtelierId,
    String? regionId,
    @Default(<String>[]) List<String> specialties,
  }) = _BusinessProfileState;
}
