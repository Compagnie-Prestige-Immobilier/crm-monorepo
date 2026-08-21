import 'package:cpi_go/ui/async_value_x.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget rendu(AsyncValue<int> etat) => etat.whenEchecDAbord(
  loading: () => const Text('chargement', textDirection: TextDirection.ltr),
  error: (Object e, StackTrace _) =>
      Text('echec $e', textDirection: TextDirection.ltr),
  data: (int v) => Text('valeur $v', textDirection: TextDirection.ltr),
);

String texteDe(Widget w) => (w as Text).data!;

void main() {
  test('une lecture en cours affiche le chargement', () {
    expect(texteDe(rendu(const AsyncValue<int>.loading())), 'chargement');
  });

  test('une valeur s’affiche', () {
    expect(texteDe(rendu(const AsyncValue<int>.data(7))), 'valeur 7');
  });

  test('un echec s’affiche', () {
    expect(
      texteDe(rendu(const AsyncValue<int>.error('coupure', StackTrace.empty))),
      'echec coupure',
    );
  });

  test('un echec EN COURS DE NOUVELLE TENTATIVE reste visible', () async {
    // Riverpod reessaie indefiniment : pendant la nouvelle tentative l'etat
    // redevient « en chargement » en gardant son erreur. `when` montrerait un
    // indicateur qui tourne pour toujours, et le teleconseiller n'apprendrait
    // jamais ce qui s'est passe.
    final ProviderContainer container = ProviderContainer.test();
    final FutureProvider<int> qui = FutureProvider<int>((Ref ref) async {
      throw StateError('coupure');
    });

    await container.read(qui.future).then<void>((_) {}, onError: (Object _) {});
    container.invalidate(qui);
    final AsyncValue<int> reessai = container.read(qui);

    expect(
      reessai.isLoading,
      isTrue,
      reason: 'la nouvelle tentative est en cours',
    );
    expect(
      reessai.hasError,
      isTrue,
      reason: 'et l’echec precedent est conserve',
    );
    expect(texteDe(rendu(reessai)), contains('echec'));
  });

  test('une valeur deja lue survit a un rafraichissement', () async {
    final ProviderContainer container = ProviderContainer.test();
    final FutureProvider<int> qui = FutureProvider<int>((Ref ref) async => 3);

    await container.read(qui.future);
    container.invalidate(qui);
    final AsyncValue<int> rafraichi = container.read(qui);

    expect(rafraichi.isLoading, isTrue);
    expect(texteDe(rendu(rafraichi)), 'valeur 3');
  });
}
