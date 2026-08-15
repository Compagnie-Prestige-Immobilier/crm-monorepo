import { Module, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

import { AppUpdatesController } from './app-updates.controller.js';
import { AppUpdatesService } from './app-updates.service.js';

/**
 * Branche le décorateur `reply.sendFile` sur l'instance Fastify sous-jacente.
 *
 * POURQUOI UNE BIBLIOTHÈQUE PLUTÔT QU'UN ANALYSEUR DE `Range` MAISON.
 *
 * Le téléchargement d'un APK de plusieurs centaines de mégaoctets sur un
 * réseau mobile sénégalais est coupé puis REPRIS, systématiquement. Le
 * DownloadManager Android reprend avec un `Range` que la RFC 7233 autorise
 * sous trois formes, dont `bytes=-500` qui désigne les 500 DERNIERS octets.
 * Un analyseur écrit à la main lit ce cas comme un début à zéro et renvoie le
 * DÉBUT du fichier en prétendant, dans `Content-Range`, qu'il s'agit de la
 * fin : l'APK réassemblé est corrompu, la vérification sha256 le rejette, et
 * la tentative suivante reproduit exactement la même corruption. La mise à
 * jour ne peut alors JAMAIS aboutir.
 *
 * `@fastify/static` délègue à `@fastify/send`, qui implémente la RFC : suffixe
 * de plage, plage insatisfaisable (416 portant un `Content-Range` réduit à la
 * taille totale), `ETag`, `If-Range` et `Last-Modified`. `If-Range` est ce qui
 * manquait le plus : une release remplacée pendant un téléchargement voit ses
 * octets recollés à ceux de la précédente, sans le moindre signal.
 *
 * `serve: false` : le module n'ouvre AUCUNE route statique. Le répertoire des
 * APK reste servi par le contrôleur, donc par ses garde-fous ; on n'emprunte
 * que le décorateur.
 */
export const registerApkFileSending = async (instance: FastifyInstance): Promise<void> => {
  // Le décorateur appartient à l'instance : une seconde inscription lèverait
  // FST_ERR_DEC_ALREADY_PRESENT. Cas réel dans les suites de tests qui montent
  // plusieurs applications, et au rechargement à chaud en développement.
  if (instance.hasReplyDecorator('sendFile')) return;
  await instance.register(fastifyStatic, { serve: false });
};

@Module({
  controllers: [AppUpdatesController],
  providers: [AppUpdatesService],
})
export class AppUpdatesModule implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  /**
   * L'inscription a lieu ici et non dans `bootstrap.ts` : le besoin est
   * strictement local à ce module, et une greffe dans l'amorçage global
   * obligerait à y revenir à chaque déplacement du module.
   *
   * `onModuleInit` s'exécute pendant `app.init()`, donc avant que Fastify ne
   * démarre : le greffon est encore accepté dans la file d'amorçage. Plus tard
   * (au premier appel par exemple), Fastify le refuserait.
   */
  async onModuleInit(): Promise<void> {
    // Le conteneur peut être monté sans application HTTP (génération du
    // document OpenAPI, module de test compilé sans adaptateur).
    const adapter: unknown = this.adapterHost.httpAdapter;
    if (!adapter) return;
    await registerApkFileSending(this.adapterHost.httpAdapter.getInstance<FastifyInstance>());
  }
}
