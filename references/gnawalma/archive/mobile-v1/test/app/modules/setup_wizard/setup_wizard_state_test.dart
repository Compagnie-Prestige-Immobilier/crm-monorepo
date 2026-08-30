import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/modules/setup_wizard/controllers/setup_wizard_provider.dart';

void main() {
  group('SetupWizardState', () {
    test('counts phone digits, not the formatting around them', () {
      // The step used to gate on the raw string length, so a formatted but
      // incomplete number let "Continuer" enable while the field under it still
      // showed an error.
      expect(SetupWizardState(phone: '77 000 0').isPhoneValid, isFalse);
      expect(SetupWizardState(phone: '77 000 00 00').isPhoneValid, isTrue);
      expect(SetupWizardState(phone: '+221 77 000 00 00').isPhoneValid, isTrue);
    });

    test('requires three characters of workshop name', () {
      expect(
        SetupWizardState(workshopName: '  A  ').isWorkshopNameValid,
        isFalse,
      );
      expect(SetupWizardState(workshopName: 'Awa').isWorkshopNameValid, isTrue);
    });

    test('the first step needs both fields', () {
      expect(
        SetupWizardState(
          workshopName: 'Maison Awa',
          phone: '77 000 00 00',
        ).isFirstPageValid,
        isTrue,
      );
      expect(
        SetupWizardState(workshopName: 'Maison Awa').isFirstPageValid,
        isFalse,
      );
    });

    test('the publication step needs a region, and nothing else', () {
      // The region is the only precondition to being findable: without it the
      // atelier is created with a null location, which the marketplace's
      // distance search filters out of every result. The address and the
      // trade-register number are useful but can arrive later, and requiring
      // them stranded owners on a button that never enabled.
      expect(SetupWizardState().isPublicationPageValid, isFalse);
      expect(
        SetupWizardState(regionId: 'dakar').isPublicationPageValid,
        isTrue,
      );
      expect(
        SetupWizardState(idDocumentRef: 'CNI-1').isPublicationPageValid,
        isFalse,
      );
    });

    test('a half-typed document number blocks the step, an empty one does not', () {
      // The API requires four characters, so a two-character reference would
      // only fail at submission time.
      expect(SetupWizardState(regionId: 'dakar').isDocumentValid, isTrue);
      expect(
        SetupWizardState(regionId: 'dakar', idDocumentRef: 'CN')
            .isPublicationPageValid,
        isFalse,
      );
      expect(
        SetupWizardState(regionId: 'dakar', idDocumentRef: 'CNI-1975')
            .isPublicationPageValid,
        isTrue,
      );
    });

    test('only a typed document is submitted for verification', () {
      expect(SetupWizardState(regionId: 'dakar').hasDocument, isFalse);
      expect(
        SetupWizardState(regionId: 'dakar', idDocumentRef: 'CNI-1975')
            .hasDocument,
        isTrue,
      );
    });

    test('an unknown region id resolves to no region', () {
      expect(SetupWizardState(regionId: 'nowhere').region, isNull);
      expect(SetupWizardState(regionId: 'thies').region?.label, 'Thiès');
    });

    test('the address falls back to the region when no detail is typed', () {
      expect(SetupWizardState(regionId: 'dakar').resolvedAddress, 'Dakar');
      expect(
        SetupWizardState(
          regionId: 'dakar',
          addressDetail: '  Rue 10, Médina  ',
        ).resolvedAddress,
        'Rue 10, Médina, Dakar',
      );
    });

    test('each wizard step gates on its own requirement', () {
      final empty = SetupWizardState();
      expect(empty.canContinueFrom(0), isFalse);
      expect(empty.canContinueFrom(1), isFalse);

      final named = SetupWizardState(
        workshopName: 'Maison Awa',
        phone: '770000000',
      );
      expect(named.canContinueFrom(0), isTrue);
      expect(named.canContinueFrom(1), isFalse);

      final located = named.copyWith(regionId: 'dakar');
      expect(located.canContinueFrom(1), isTrue);

      // The logo is optional, so the last step always publishes.
      expect(located.canContinueFrom(SetupWizard.lastPageIndex), isTrue);
    });

    test('the wizard has three steps', () {
      // The header prints "Étape n sur 3" from this. The specialties step was
      // removed: it asked for fabric materials under a title the owner read as
      // "who do you sew for", and pre-selected four of them.
      expect(SetupWizard.lastPageIndex, 2);
    });

    test('editing the phone drops the "from account" attribution', () {
      final prefilled = SetupWizardState(
        phone: '770000000',
        phoneFromAccount: true,
      );
      expect(prefilled.phoneFromAccount, isTrue);
      expect(
        prefilled
            .copyWith(phone: '781111111', phoneFromAccount: false)
            .phoneFromAccount,
        isFalse,
      );
    });
  });
}
