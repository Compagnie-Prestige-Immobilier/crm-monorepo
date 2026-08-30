import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/modules/operations/domain/atelier_publication.dart';

void main() {
  // The rules an atelier owner is judged by, pinned without a device.
  //
  // An atelier is listed only when it is `verified` **and** carries a position,
  // so "verified" is not the same as "findable"; and publication is automatic
  // (decision D-010), so a row still sitting at `pending_review` was created
  // under the old behaviour and must be able to republish itself.
  group('AtelierPublicationState', () {
    test('verified with a position reads as published, nothing to do', () {
      final state = AtelierPublicationState.from(
        status: 'verified',
        hasPosition: true,
      );
      expect(state.title, 'Publié');
      expect(state.tone, AtelierPublicationTone.published);
      expect(state.canSubmit, isFalse);
      expect(state.needsPosition, isFalse);
      expect(state.canSubmitNow, isFalse);
    });

    test('verified without a position names the contradiction', () {
      // Approved, and returned by no search. Silence here would leave the owner
      // believing they are listed.
      final state = AtelierPublicationState.from(
        status: 'verified',
        hasPosition: false,
      );
      expect(state.title, 'Publié mais introuvable');
      expect(state.tone, AtelierPublicationTone.attention);
      expect(state.needsPosition, isTrue);
    });

    test('a draft can be submitted once it has a position', () {
      final without = AtelierPublicationState.from(
        status: 'draft',
        hasPosition: false,
      );
      expect(without.canSubmit, isTrue);
      expect(without.needsPosition, isTrue);
      // Submitting without a position is refused by the server, so the button
      // stays disabled rather than inviting a failure.
      expect(without.canSubmitNow, isFalse);

      final with_ = AtelierPublicationState.from(
        status: 'draft',
        hasPosition: true,
      );
      expect(with_.canSubmitNow, isTrue);
    });

    test('a row stranded at pending_review can republish itself', () {
      final state = AtelierPublicationState.from(
        status: 'pending_review',
        hasPosition: true,
      );
      expect(state.canSubmitNow, isTrue);
      expect(state.tone, AtelierPublicationTone.waiting);
    });

    test('a rejected dossier can be corrected and resent', () {
      final state = AtelierPublicationState.from(
        status: 'rejected',
        hasPosition: true,
      );
      expect(state.canSubmitNow, isTrue);
      expect(state.tone, AtelierPublicationTone.blocked);
    });

    test('a suspension is not undone by resubmitting', () {
      // The server refuses it, so the app must not offer it.
      final state = AtelierPublicationState.from(
        status: 'suspended',
        hasPosition: true,
      );
      expect(state.canSubmit, isFalse);
      expect(state.canSubmitNow, isFalse);
      expect(state.tone, AtelierPublicationTone.blocked);
    });

    test('an unknown status is treated as unpublished, not as published', () {
      final state = AtelierPublicationState.from(
        status: 'something_new',
        hasPosition: true,
      );
      expect(state.title, 'Non publié');
      expect(state.canSubmitNow, isTrue);
    });
  });
}
