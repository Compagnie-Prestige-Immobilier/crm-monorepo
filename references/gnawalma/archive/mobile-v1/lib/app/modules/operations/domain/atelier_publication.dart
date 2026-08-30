/// What an atelier owner is told about their visibility, and what they can do
/// about it.
///
/// Extracted from the dashboard card so the rules can be checked without a
/// device. They are not obvious: an atelier is listed only when it is
/// `verified` **and** carries a position, so "verified" alone is not the same
/// as "findable", and the two failure modes need different advice. Leaving that
/// as a `switch` inside a widget meant the only way to know what an owner would
/// read was to reach that state in a running app.
enum AtelierPublicationTone { published, waiting, attention, blocked }

class AtelierPublicationState {
  const AtelierPublicationState({
    required this.title,
    required this.message,
    required this.tone,
    required this.canSubmit,
    required this.needsPosition,
  });

  final String title;
  final String message;
  final AtelierPublicationTone tone;

  /// Whether the owner may file (or re-file) a dossier.
  final bool canSubmit;

  /// Whether a position must be set before anything else is worth doing.
  final bool needsPosition;

  /// Submitting is only useful once the atelier can actually be listed.
  bool get canSubmitNow => canSubmit && !needsPosition;

  /// Resolves the state from what the server reports.
  ///
  /// [status] is `ateliers.status`; [hasPosition] is whether coordinates exist.
  factory AtelierPublicationState.from({
    required String status,
    required bool hasPosition,
  }) {
    // Stated as what *cannot* be submitted rather than as a list of what can.
    //
    // Enumerating the submittable statuses left the fallback branch telling an
    // owner to send their dossier while the button under that sentence stayed
    // disabled — any status this build does not recognise fell through to it.
    // A suspension is not undone by resubmitting (the server refuses it), and a
    // published atelier has nothing to send; everything else, including a row
    // stranded at `pending_review` from before publication became automatic,
    // is resubmittable.
    final canSubmit = status != 'verified' && status != 'suspended';

    if (status == 'verified' && hasPosition) {
      return AtelierPublicationState(
        title: 'Publié',
        message: 'Votre atelier apparaît dans la recherche des clients.',
        tone: AtelierPublicationTone.published,
        canSubmit: false,
        needsPosition: false,
      );
    }
    if (status == 'verified') {
      // Approved and findable by nobody: the search also filters on the
      // position, so this contradiction has to be named rather than left for
      // the owner to discover.
      return const AtelierPublicationState(
        title: 'Publié mais introuvable',
        message:
            'Votre atelier est validé, mais sans zone il n’apparaît dans aucune recherche. Indiquez-la pour être visible.',
        tone: AtelierPublicationTone.attention,
        canSubmit: false,
        needsPosition: true,
      );
    }
    return switch (status) {
      'pending_review' => AtelierPublicationState(
        title: 'En cours de vérification',
        message:
            'La plateforme examine votre dossier. Renvoyez-le si vous n’apparaissez pas dans la recherche.',
        tone: AtelierPublicationTone.waiting,
        canSubmit: canSubmit,
        needsPosition: !hasPosition,
      ),
      'rejected' => AtelierPublicationState(
        title: 'Dossier refusé',
        message:
            'La plateforme n’a pas validé votre dossier. Corrigez vos informations puis renvoyez-le.',
        tone: AtelierPublicationTone.blocked,
        canSubmit: canSubmit,
        needsPosition: !hasPosition,
      ),
      'suspended' => const AtelierPublicationState(
        title: 'Atelier suspendu',
        message:
            'Votre profil a été retiré de la recherche. Contactez la plateforme.',
        tone: AtelierPublicationTone.blocked,
        // A suspension is not undone by resubmitting; the server refuses it.
        canSubmit: false,
        needsPosition: false,
      ),
      _ => AtelierPublicationState(
        title: 'Non publié',
        message:
            'Votre atelier n’est pas encore visible par les clients. Envoyez-le pour vérification.',
        tone: AtelierPublicationTone.attention,
        canSubmit: canSubmit,
        needsPosition: !hasPosition,
      ),
    };
  }
}
