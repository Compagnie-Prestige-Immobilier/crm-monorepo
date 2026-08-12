import 'package:dio/dio.dart';

import '../utils/ids.dart';

/// Premier intercepteur de la chaîne : il pose `X-Request-Id`.
///
/// **Premier, et pas dernier.** L'identifiant doit exister avant que quoi que
/// ce soit d'autre puisse échouer : si l'authentification part en erreur ou si
/// le rejeu se déclenche, on veut retrouver dans les journaux serveur la
/// requête exacte dont il est question. Un identifiant posé en fin de chaîne
/// manquerait précisément aux requêtes qu'on cherche à déboguer.
///
/// UUID v7 : l'identifiant est trié par le temps, donc grep-able par plage dans
/// les journaux, ce qu'un v4 ne permet pas.
class RequestIdInterceptor extends Interceptor {
  const RequestIdInterceptor();

  static const String header = 'X-Request-Id';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Un rejeu (401 puis relance) conserve l'identifiant d'origine : c'est la
    // même tentative logique côté utilisateur, et deux identifiants la
    // couperaient en deux dans les journaux.
    options.headers.putIfAbsent(header, Ids.newRequestId);
    handler.next(options);
  }
}
