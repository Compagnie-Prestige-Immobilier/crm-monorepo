import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:gnawalma/app/data/services/business_profile_service.dart';
import 'package:gnawalma/app/data/models/business_profile_model.dart';
import 'package:gnawalma/app/routes/app_routes.dart';
import '../../../data/services/image_service.dart';
import '../../../data/services/active_space_provider.dart';
import '../../../data/services/app_space.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/session_controller.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../auth/domain/auth_input_validation.dart';
import '../../operations/controllers/operations_providers.dart';
import '../domain/atelier_regions.dart';

part 'setup_wizard_provider.g.dart';

/// How far the wizard got with publishing the atelier.
///
/// Creating an atelier and publishing it are two different acts against two
/// different tables, and only the second makes the atelier findable. The wizard
/// used to perform the first and imply the second, so an owner finished setup
/// believing they were listed.
enum AtelierPublicationOutcome {
  /// Created and submitted; an administrator now has it in their queue.
  submitted,

  /// Created, but the submission call failed. The atelier exists and works
  /// locally; it is simply not in front of a reviewer yet.
  createdOnly,
}

class SetupWizardState {
  final int pageIndex;
  final String workshopName;
  final String phone;

  /// True when [phone] was inherited from the signed-in account rather than
  /// typed here. The step says so instead of presenting an empty field the user
  /// has already filled once at sign-up.
  final bool phoneFromAccount;

  /// Where the atelier works, as an id from [AtelierRegions].
  ///
  /// The only required field of this step: the marketplace excludes any atelier
  /// without coordinates, so an atelier configured without a region can never
  /// be found by a client.
  final String? regionId;

  /// Neighbourhood, street or landmark, appended to the region. Optional — the
  /// region alone is enough to be listed and to be reached by phone.
  final String addressDetail;

  /// Liens vers les réseaux du couturier (§2.2).
  ///
  /// Facultatifs : un artisan qui n'a pas de compte ne doit pas être bloqué.
  /// Mais c'est là que vivent ses réalisations, donc la fiche publique les met
  /// en avant dès qu'ils existent.
  final String tiktokUrl;
  final String instagramUrl;
  final String facebookUrl;

  /// The identity or trade-register document the platform will check.
  ///
  /// Optional here. `atelier_verifications.id_document_ref` is `NOT NULL`, so
  /// leaving it empty simply skips the submission: the atelier exists and works,
  /// and the dashboard offers to send the file later.
  final String idDocumentRef;

  final String? selectedLogoPath;
  final bool isLoading;
  final String? errorMessage;

  /// True while a chosen image is being copied into app storage.
  final bool isPickingLogo;

  /// Set when a pick fails, shown at the well rather than as a toast.
  final String? logoError;

  SetupWizardState({
    this.pageIndex = 0,
    this.workshopName = '',
    this.phone = '',
    this.phoneFromAccount = false,
    this.regionId,
    this.addressDetail = '',
    this.idDocumentRef = '',
    this.tiktokUrl = '',
    this.instagramUrl = '',
    this.facebookUrl = '',
    this.selectedLogoPath,
    this.isLoading = false,
    this.errorMessage,
    this.isPickingLogo = false,
    this.logoError,
  });

  SetupWizardState copyWith({
    int? pageIndex,
    String? workshopName,
    String? phone,
    bool? phoneFromAccount,
    String? regionId,
    String? addressDetail,
    String? idDocumentRef,
    String? tiktokUrl,
    String? instagramUrl,
    String? facebookUrl,
    String? selectedLogoPath,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    bool? isPickingLogo,
    String? logoError,
    bool clearLogoError = false,
    bool clearLogoPath = false,
  }) {
    return SetupWizardState(
      pageIndex: pageIndex ?? this.pageIndex,
      workshopName: workshopName ?? this.workshopName,
      phone: phone ?? this.phone,
      phoneFromAccount: phoneFromAccount ?? this.phoneFromAccount,
      regionId: regionId ?? this.regionId,
      addressDetail: addressDetail ?? this.addressDetail,
      idDocumentRef: idDocumentRef ?? this.idDocumentRef,
      tiktokUrl: tiktokUrl ?? this.tiktokUrl,
      instagramUrl: instagramUrl ?? this.instagramUrl,
      facebookUrl: facebookUrl ?? this.facebookUrl,
      selectedLogoPath: clearLogoPath
          ? null
          : selectedLogoPath ?? this.selectedLogoPath,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      isPickingLogo: isPickingLogo ?? this.isPickingLogo,
      logoError: clearLogoError ? null : logoError ?? this.logoError,
    );
  }

  bool get isWorkshopNameValid => workshopName.trim().length >= 3;

  /// The same rule the sign-in screen and the server both apply.
  ///
  /// This used to be "at least nine digits", which is not what
  /// `normalizePhone` accepts: a ten-digit entry passed the step, enabled
  /// "Continuer", and was refused by the API with a 400 the wizard could only
  /// report as a generic failure.
  bool get isPhoneValid => AuthInputValidation.isPhoneValid(phone);

  AtelierRegion? get region => AtelierRegions.byId(regionId);

  /// Empty means "not now". Typed, it must satisfy the API's four-character
  /// minimum, so a half-filled reference cannot reach a submission that fails.
  bool get isDocumentValid =>
      idDocumentRef.trim().isEmpty || idDocumentRef.trim().length >= 4;

  bool get hasDocument => idDocumentRef.trim().length >= 4;

  bool get isPublicationPageValid => region != null && isDocumentValid;

  bool get isFirstPageValid => isWorkshopNameValid && isPhoneValid;

  /// Whether the wizard may leave [pageIndex].
  ///
  /// Lives here rather than in the view so the rule is one statement that can
  /// be tested without a device.
  bool canContinueFrom(int pageIndex) => switch (pageIndex) {
    0 => isFirstPageValid,
    1 => isPublicationPageValid,
    // The logo is optional, so the last step is always publishable.
    _ => true,
  };

  /// What goes into `ateliers.address_text`.
  String get resolvedAddress {
    final selected = region;
    if (selected == null) return addressDetail.trim();
    final detail = addressDetail.trim();
    return detail.isEmpty ? selected.label : '$detail, ${selected.label}';
  }
}

@riverpod
class SetupWizard extends _$SetupWizard {
  @override
  SetupWizardState build() {
    // The account was created with a phone number or an email. When it was a
    // phone, asking for it again here is the same question twice, so it is
    // carried over and only has to be corrected if the atelier publishes a
    // different line.
    final accountPhone =
        ref.watch(sessionControllerProvider).value?.phone?.trim() ?? '';
    return SetupWizardState(
      phone: accountPhone,
      phoneFromAccount: accountPhone.isNotEmpty,
    );
  }

  void setWorkshopName(String val) => state = state.copyWith(workshopName: val);

  void setPhone(String val) => state = state.copyWith(
    phone: val,
    // Once edited it is no longer the account's number, so the note that
    // explains where it came from stops applying.
    phoneFromAccount: false,
  );

  void setRegion(String regionId) => state = state.copyWith(regionId: regionId);

  void setAddressDetail(String val) =>
      state = state.copyWith(addressDetail: val);

  void setIdDocumentRef(String val) =>
      state = state.copyWith(idDocumentRef: val);

  void setTiktokUrl(String val) => state = state.copyWith(tiktokUrl: val);
  void setInstagramUrl(String val) => state = state.copyWith(instagramUrl: val);
  void setFacebookUrl(String val) => state = state.copyWith(facebookUrl: val);

  /// Picks a logo from [source] and stores it.
  ///
  /// Was a near-verbatim copy of the same method in `BusinessProfileNotifier`,
  /// minus the brand-colour extraction — two implementations of one operation
  /// that had already drifted apart.
  Future<void> pickLogo(ImageSource source) async {
    state = state.copyWith(isPickingLogo: true, clearLogoError: true);
    try {
      final XFile? image = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image == null) return;
      final savedPath = await ImageService().saveImage(image.path);
      state = state.copyWith(selectedLogoPath: savedPath);
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

  void removeLogo() => state = state.copyWith(clearLogoPath: true);

  /// The last page index: identity, publication, logo.
  static const lastPageIndex = 2;

  void next() {
    if (state.pageIndex < lastPageIndex) {
      state = state.copyWith(pageIndex: state.pageIndex + 1);
    } else {
      finish();
    }
  }

  void previous() {
    if (state.pageIndex > 0) {
      state = state.copyWith(pageIndex: state.pageIndex - 1);
    }
  }

  /// Creates the atelier, then submits it for verification.
  ///
  /// Returns how far publication actually got, so the screen can say it rather
  /// than imply it.
  Future<AtelierPublicationOutcome?> finish() async {
    if (state.isLoading) return null;
    state = state.copyWith(isLoading: true, clearError: true);
    var outcome = AtelierPublicationOutcome.submitted;
    try {
      // PostgreSQL is canonical. The atelier must exist remotely before the
      // local profile is committed, otherwise the app can appear configured
      // while the account has nothing to synchronize with.
      final region = state.region;
      final atelierId = await ref
          .read(operationsRepositoryProvider)
          .createAtelier(
            name: state.workshopName,
            phone: state.phone,
            address: state.resolvedAddress,
            region: region?.label,
            // Without these the row is created with a null `location`, and
            // `GET /marketplace/ateliers` filters positionless ateliers out of
            // every search — so the atelier would be unfindable even after an
            // administrator approved it.
            latitude: region?.latitude,
            longitude: region?.longitude,
            tiktokUrl: state.tiktokUrl,
            instagramUrl: state.instagramUrl,
            facebookUrl: state.facebookUrl,
          );

      // Le logo choisi à l'étape 4 ne quittait pas l'appareil : la fiche
      // publique restait sans image. L'échec n'interrompt pas la création —
      // l'atelier existe, l'image peut être renvoyée depuis le profil.
      final logoPath = state.selectedLogoPath;
      if (logoPath != null) {
        try {
          await ref
              .read(operationsRepositoryProvider)
              .uploadAtelierMedia(
                atelierId: atelierId,
                filePath: logoPath,
                kind: 'logo',
              );
        } catch (_) {}
      }

      // Creating is not publishing. Only a pending `atelier_verifications` row
      // puts the atelier in front of an administrator, and only their approval
      // moves it to 'verified' — the one status the marketplace lists.
      if (state.hasDocument) {
        try {
          await ref
              .read(operationsRepositoryProvider)
              .submitVerification(
                atelierId: atelierId,
                idDocumentRef: state.idDocumentRef,
                checklist: {
                  'region': region?.label ?? '',
                  'adresse': state.resolvedAddress,
                },
              );
        } catch (_) {
          // The atelier itself exists and the space below is usable. Failing
          // the whole wizard here would discard a created row and force a
          // duplicate on the retry; the outcome is reported instead.
          outcome = AtelierPublicationOutcome.createdOnly;
        }
      } else {
        outcome = AtelierPublicationOutcome.createdOnly;
      }

      final currentSession = await ref.read(sessionControllerProvider.future);
      if (currentSession != null) {
        final enriched = await ref
            .read(authRepositoryProvider)
            .enrichSession(currentSession);
        await ref.read(sessionControllerProvider.notifier).setSession(enriched);
      }

      final profileService = await ref.read(businessProfileProvider.future);
      // The address travels with the rest: the profile screen pre-fills from
      // this row, and it used to open with an empty address field right after
      // the wizard had asked for one.
      final profile = BusinessProfileModel(
        businessName: state.workshopName,
        address: state.resolvedAddress,
        phone: state.phone,
        logoPath: state.selectedLogoPath,
        footerNote: 'Merci de votre confiance.',
      );
      await profileService.saveProfile(profile);

      await ref.read(activeSpaceProvider.notifier).select(AppSpace.atelier);

      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
      AppNavigator.offAll(AppRoutes.shell);
      return outcome;
    } catch (error) {
      // `error.toString()` put "DioException [connection error]…" in front of the
      // user. The API's own message is already written for them; anything else
      // gets a sentence they can act on.
      state = state.copyWith(
        errorMessage: error is ApiException
            ? error.message
            : 'Impossible de créer l’atelier pour le moment. Vérifiez votre connexion et réessayez.',
      );
      return null;
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }
}
