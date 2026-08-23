import 'dart:io';

import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le garde-fou que le linter ne peut pas poser.
///
/// `use_build_context_synchronously` couvre `BuildContext`, pas le `WidgetRef`
/// de Riverpod. Et `riverpod_lint` est installable NULLE PART ici : `custom_lint`
/// est cloué sur `analyzer ≤ 8`, `drift_dev` en exige `≥ 10`, et le résolveur
/// refuse les deux ensemble — vérifié, ce n'est pas une supposition.
///
/// Ce qu'il attrape : un `ref.*` évalué APRÈS un `await`, dans le même corps de
/// fonction, sans garde `mounted` entre les deux. Deux sites de l'Historique
/// perdaient ainsi l'envoi d'une suppression : l'écriture partait en base, le
/// réveil de la synchronisation jamais.
///
/// La parade est de LIRE AVANT : `final notifier = ref.read(x.notifier);`, puis
/// `await …;`, puis `notifier.nudge();`.
///
/// Sur l'ARBRE et non sur les lignes, parce qu'un balayage textuel se trompe
/// deux fois : il franchit les frontières de fonction, et il signale un
/// `ref.read` posé dans le `builder` d'un `showModalBottomSheet`, qui est
/// pourtant évalué avant que l'attente commence.
class _RefApresAwait extends RecursiveAstVisitor<void> {
  _RefApresAwait(this.chemin, this.contenu);

  final String chemin;
  final String contenu;
  final List<String> fautifs = <String>[];

  @override
  void visitBlockFunctionBody(BlockFunctionBody node) {
    if (node.isAsynchronous) _inspecter(node.block.statements);
    super.visitBlockFunctionBody(node);
  }

  /// Les instructions d'UN corps, à plat : descendre dans les fonctions
  /// imbriquées mélangerait des cycles de vie différents, et c'est
  /// `visitBlockFunctionBody` qui les prendra pour elles-mêmes.
  void _inspecter(List<Statement> instructions) {
    bool apresAwait = false;
    for (final Statement instruction in instructions) {
      final String source = instruction.toSource();
      if (_garde(instruction, source)) {
        apresAwait = false;
        continue;
      }
      if (apresAwait && _usageDeRef(instruction)) {
        _signaler(instruction, source);
      }
      if (_contientAwait(instruction)) apresAwait = true;
    }
  }

  bool _garde(Statement instruction, String source) =>
      instruction is IfStatement &&
      (source.contains('mounted') || source.contains('!context.mounted'));

  /// Vrai seulement si le `ref` est atteint APRÈS l'attente. Un `ref` posé dans
  /// une closure passée en argument — `builder:`, `onPressed:` — est évalué
  /// avant, ou plus tard sous son propre cycle de vie.
  bool _usageDeRef(Statement instruction) {
    final _ChercheRef chercheur = _ChercheRef();
    instruction.visitChildren(chercheur);
    return chercheur.trouve;
  }

  bool _contientAwait(Statement instruction) {
    final _ChercheAwait chercheur = _ChercheAwait();
    instruction.visitChildren(chercheur);
    return chercheur.trouve;
  }

  void _signaler(Statement instruction, String source) {
    final int ligne =
        '\n'.allMatches(contenu.substring(0, instruction.offset)).length + 1;
    final String extrait = source.length > 90
        ? '${source.substring(0, 90)}…'
        : source;
    fautifs.add('$chemin:$ligne  $extrait');
  }
}

class _ChercheRef extends RecursiveAstVisitor<void> {
  bool trouve = false;

  @override
  void visitPrefixedIdentifier(PrefixedIdentifier node) {
    if (node.prefix.name == 'ref') trouve = true;
    super.visitPrefixedIdentifier(node);
  }

  @override
  void visitPropertyAccess(PropertyAccess node) {
    if (node.target?.toSource() == 'ref') trouve = true;
    super.visitPropertyAccess(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    if (node.target?.toSource() == 'ref') trouve = true;
    super.visitMethodInvocation(node);
  }

  /// Une closure a son propre moment d'exécution : ce qu'elle contient ne dit
  /// rien de l'instant où l'instruction courante s'évalue.
  @override
  void visitFunctionExpression(FunctionExpression node) {}
}

class _ChercheAwait extends RecursiveAstVisitor<void> {
  bool trouve = false;

  @override
  void visitAwaitExpression(AwaitExpression node) {
    trouve = true;
    super.visitAwaitExpression(node);
  }

  @override
  void visitFunctionExpression(FunctionExpression node) {}
}

void main() {
  test('aucun ref.* n’est évalué après un await sans garde mounted', () {
    final List<String> fautifs = <String>[];

    for (final FileSystemEntity entree in Directory(
      'lib',
    ).listSync(recursive: true)) {
      if (entree is! File || !entree.path.endsWith('.dart')) continue;
      // Les WIDGETS seulement : dans un `Notifier`, `ref` est un `Ref` qui vit
      // aussi longtemps que le fournisseur, pas un `WidgetRef` qui meurt avec
      // l'écran. Le risque n'est pas le même et la parade non plus.
      if (!entree.path.contains('/presentation/')) continue;

      final String contenu = entree.readAsStringSync();
      final _RefApresAwait visiteur = _RefApresAwait(entree.path, contenu);
      parseString(
        content: contenu,
        throwIfDiagnostics: false,
      ).unit.visitChildren(visiteur);
      fautifs.addAll(visiteur.fautifs);
    }

    expect(
      fautifs,
      isEmpty,
      reason:
          'Un `ref` évalué après un `await` porte sur un widget peut-être '
          'démonté : lisez le notifier AVANT l\'attente, ou gardez avec '
          '`ref.mounted`.\n${fautifs.join('\n')}',
    );
  });
}
