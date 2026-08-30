import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as s from './schemas';

/**
 * Emits `openapi.json` from the zod schemas the server actually validates with.
 *
 * Run with `npm run openapi:generate`; `npm run openapi:check` fails when the
 * committed file no longer matches, which is what stops the spec drifting away
 * from the implementation again.
 */

type Method = 'get' | 'post' | 'patch' | 'delete';

interface RouteDef {
  method: Method;
  path: string;
  operationId: string;
  summary: string;
  tag: string;
  auth?: boolean;
  roles?: string;
  params?: string[];
  query?: ZodTypeAny;
  body?: ZodTypeAny;
  /** Corps multipart : le seul endpoint qui reçoit des octets, pas du JSON. */
  bodyMultipart?: { file: string; fields: Record<string, ZodTypeAny> };
  response?: ZodTypeAny;
  responseIsArray?: boolean;
  /** Réponse binaire : l'image elle-même, pas une enveloppe JSON. */
  responseBinary?: string;
  status?: number;
}

const routes: RouteDef[] = [
  // Health
  { method: 'get', path: '/health', operationId: 'health', summary: 'Liveness probe', tag: 'health', response: s.healthResponse },
  { method: 'get', path: '/readiness', operationId: 'readiness', summary: 'Readiness probe, including the database', tag: 'health', response: s.readinessResponse },

  // Auth
  { method: 'post', path: '/auth/register', operationId: 'register', summary: 'Create an account', tag: 'auth', body: s.registrationRequest, response: s.registrationResponse, status: 201 },
  { method: 'get', path: '/auth/me', operationId: 'me', summary: 'Current account and its ateliers', tag: 'auth', auth: true, response: s.meResponse },
  { method: 'post', path: '/auth/login', operationId: 'login', summary: 'Exchange credentials for a session', tag: 'auth', body: s.loginRequest, response: s.sessionResponse, status: 200 },
  { method: 'post', path: '/auth/refresh', operationId: 'refresh', summary: 'Rotate a refresh token', tag: 'auth', body: s.refreshRequest, response: s.sessionResponse, status: 200 },
  { method: 'post', path: '/auth/logout', operationId: 'logout', summary: 'Revoke the current session', tag: 'auth', auth: true, status: 204 },

  // Marketplace
  { method: 'get', path: '/marketplace/ateliers', operationId: 'searchAteliers', summary: 'Search verified ateliers by distance and text', tag: 'marketplace', query: s.marketplaceSearchQuery, response: s.publicAtelier, responseIsArray: true },
  { method: 'get', path: '/marketplace/promotions', operationId: 'listPromotions', summary: 'Mises en avant de l\'accueil client', tag: 'marketplace', response: s.promotion, responseIsArray: true },
  { method: 'get', path: '/marketplace/ranking', operationId: 'ranking', summary: 'Classement des ateliers, general ou par zone', tag: 'marketplace', query: s.rankingQuery, response: s.rankedAtelier, responseIsArray: true },
  { method: 'get', path: '/marketplace/ateliers/{id}', operationId: 'atelierProfile', summary: 'Public profile of one atelier', tag: 'marketplace', params: ['id'], query: s.atelierProfileQuery, response: s.publicAtelier },
  { method: 'get', path: '/marketplace/contacts', operationId: 'listContacts', summary: 'Contact history for the signed-in client', tag: 'marketplace', auth: true, roles: 'client', query: s.pageQuery, response: s.contactEvent, responseIsArray: true },
  { method: 'post', path: '/marketplace/ateliers/{id}/contacts', operationId: 'createContact', summary: 'Record that the client contacted an atelier', tag: 'marketplace', auth: true, roles: 'client', params: ['id'], body: s.createContactRequest, response: s.createContactResponse, status: 201 },
  { method: 'post', path: '/marketplace/contacts/{id}/confirm', operationId: 'confirmContact', summary: 'Confirm the outcome of a contact', tag: 'marketplace', auth: true, params: ['id'], body: s.confirmContactRequest, response: s.confirmContactResponse, status: 201 },
  { method: 'post', path: '/marketplace/reviews', operationId: 'createReview', summary: 'Leave a review for a completed contact', tag: 'marketplace', auth: true, body: s.createReviewRequest, response: s.createReviewResponse, status: 201 },

  // Operations
  { method: 'get', path: '/operations/ateliers', operationId: 'listAteliers', summary: 'Ateliers the account belongs to', tag: 'operations', auth: true, response: s.atelierResponse, responseIsArray: true },
  { method: 'post', path: '/operations/ateliers', operationId: 'createAtelier', summary: 'Create an atelier', tag: 'operations', auth: true, roles: 'atelier_owner', body: s.createAtelierRequest, response: s.createAtelierResponse, status: 201 },
  { method: 'patch', path: '/operations/ateliers/{atelierId}', operationId: 'updateAtelier', summary: 'Correct an atelier profile, including its position', tag: 'operations', auth: true, params: ['atelierId'], body: s.updateAtelierRequest, response: s.createAtelierResponse },
  { method: 'post', path: '/operations/ateliers/{atelierId}/verification', operationId: 'submitVerification', summary: 'Submit an atelier to the platform verification queue', tag: 'operations', auth: true, params: ['atelierId'], body: s.submitVerificationRequest, response: s.submitVerificationResponse, status: 201 },
  { method: 'get', path: '/operations/ateliers/{atelierId}/contacts', operationId: 'listAtelierContacts', summary: 'Client requests received by an atelier', tag: 'operations', auth: true, params: ['atelierId'], query: s.pageQuery, response: s.atelierContactPage },
  { method: 'get', path: '/operations/ateliers/{atelierId}/dashboard', operationId: 'dashboard', summary: 'Daily operating summary', tag: 'operations', auth: true, params: ['atelierId'], response: s.dashboardResponse },
  { method: 'get', path: '/operations/ateliers/{atelierId}/clients', operationId: 'listClients', summary: 'Clients of an atelier', tag: 'operations', auth: true, params: ['atelierId'], query: s.pageQuery, response: s.clientPage },
  { method: 'post', path: '/operations/ateliers/{atelierId}/clients', operationId: 'upsertClient', summary: 'Create or update a client', tag: 'operations', auth: true, params: ['atelierId'], body: s.upsertClientRequest, response: s.clientResponse, status: 201 },
  { method: 'get', path: '/operations/orders/shared', operationId: 'listSharedOrders', summary: 'Orders across every atelier, without their clients', tag: 'operations', auth: true, roles: 'atelier_owner, atelier_manager', query: s.orderListQuery, response: s.sharedOrderPage },
  { method: 'get', path: '/operations/ateliers/{atelierId}/orders', operationId: 'listOrders', summary: 'Orders of an atelier', tag: 'operations', auth: true, params: ['atelierId'], query: s.orderListQuery, response: s.orderPage },
  { method: 'post', path: '/operations/ateliers/{atelierId}/orders', operationId: 'createOrder', summary: 'Create an order', tag: 'operations', auth: true, params: ['atelierId'], body: s.createOrderRequest, response: s.createOrderResponse, status: 201 },
  { method: 'patch', path: '/operations/ateliers/{atelierId}/orders/{orderId}/status', operationId: 'updateOrderStatus', summary: 'Move an order along its state machine', tag: 'operations', auth: true, params: ['atelierId', 'orderId'], body: s.updateOrderStatusRequest, response: s.updateOrderStatusResponse },
  { method: 'post', path: '/operations/ateliers/{atelierId}/orders/{orderId}/payments', operationId: 'recordPayment', summary: 'Record a payment against an order', tag: 'operations', auth: true, params: ['atelierId', 'orderId'], body: s.recordPaymentRequest, response: s.paymentResponse, status: 201 },
  { method: 'get', path: '/operations/ateliers/{atelierId}/inventory', operationId: 'listInventory', summary: 'Fabrics and supplies', tag: 'operations', auth: true, params: ['atelierId'], query: s.pageQuery, response: s.inventoryPage },
  { method: 'post', path: '/operations/ateliers/{atelierId}/inventory', operationId: 'upsertInventory', summary: 'Create or update an inventory item', tag: 'operations', auth: true, params: ['atelierId'], body: s.upsertInventoryRequest, response: s.inventoryResponse, status: 201 },

  // Media
  { method: 'post', path: '/operations/ateliers/{atelierId}/media', operationId: 'uploadAtelierMedia', summary: 'Upload a logo, cover or portfolio image', tag: 'media', auth: true, params: ['atelierId'], bodyMultipart: { file: 'file', fields: { kind: s.mediaKind } }, response: s.mediaResponse, status: 201 },
  { method: 'get', path: '/media/{mediaId}', operationId: 'serveMedia', summary: 'Serve an uploaded image', tag: 'media', params: ['mediaId'], responseBinary: 'image/*' },

  // Sync
  { method: 'get', path: '/sync/ateliers/{atelierId}/pull', operationId: 'syncPull', summary: 'Changes since a cursor', tag: 'sync', auth: true, params: ['atelierId'], query: s.syncPullQuery, response: s.syncPullResponse },
  { method: 'post', path: '/sync/ateliers/{atelierId}/push', operationId: 'syncPush', summary: 'Apply offline mutations', tag: 'sync', auth: true, params: ['atelierId'], body: s.syncPushRequest, response: s.syncPushResponse, status: 201 },

  // Admin
  { method: 'get', path: '/admin/atelier-verifications', operationId: 'pendingVerifications', summary: 'Ateliers awaiting verification', tag: 'admin', auth: true, roles: 'platform_admin', response: s.pendingAtelier, responseIsArray: true },
  { method: 'post', path: '/admin/atelier-verifications/{id}/decision', operationId: 'decideVerification', summary: 'Approve or reject an atelier', tag: 'admin', auth: true, roles: 'platform_admin', params: ['id'], body: s.verificationDecisionRequest, status: 201 },
  { method: 'get', path: '/admin/promotions', operationId: 'listAdminPromotions', summary: 'Mises en avant, actives ou non', tag: 'admin', auth: true, roles: 'platform_admin', response: s.adminPromotion, responseIsArray: true },
  { method: 'post', path: '/admin/promotions', operationId: 'createPromotion', summary: 'Publier une mise en avant', tag: 'admin', auth: true, roles: 'platform_admin', body: s.createPromotionRequest, status: 201 },
  { method: 'post', path: '/admin/promotions/{id}/archive', operationId: 'archivePromotion', summary: 'Retirer une mise en avant de l\'accueil', tag: 'admin', auth: true, roles: 'platform_admin', params: ['id'], status: 201 },
  { method: 'get', path: '/admin/reviews', operationId: 'pendingReviews', summary: 'Reviews awaiting moderation', tag: 'admin', auth: true, roles: 'platform_admin', query: s.pageQuery, response: s.pendingReview, responseIsArray: true },
  { method: 'post', path: '/admin/reviews/{id}/moderation', operationId: 'moderateReview', summary: 'Publish, hide or reject a review', tag: 'admin', auth: true, roles: 'platform_admin', params: ['id'], body: s.reviewModerationRequest, status: 201 },
];

const definitions: Record<string, unknown> = {};

function schemaRef(name: string, schema: ZodTypeAny): { $ref: string } {
  if (!definitions[name]) {
    definitions[name] = toJson(schema);
  }
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * zod's inferred types recurse deeply enough that the compiler gives up on
 * `zodToJsonSchema` when it is called with a concrete schema. The conversion is
 * a runtime concern only, so the argument is widened here rather than each call
 * site carrying a cast.
 */
function toJson(schema: ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema as never, {
    target: 'openApi3',
    $refStrategy: 'none',
  });
}

function inlineSchema(schema: ZodTypeAny): Record<string, unknown> {
  return toJson(schema);
}

// Named components, so a generated client produces one model per concept
// rather than an anonymous shape per endpoint.
const named: Array<[string, ZodTypeAny]> = [
  ['Session', s.sessionResponse],
  ['Me', s.meResponse],
  ['Atelier', s.atelierResponse],
  ['PublicAtelier', s.publicAtelier],
  ['Client', s.clientResponse],
  ['Order', s.orderResponse],
  ['OrderItem', s.orderItemResponse],
  ['Payment', s.paymentResponse],
  ['InventoryItem', s.inventoryResponse],
  ['Dashboard', s.dashboardResponse],
  ['ContactEvent', s.contactEvent],
  ['SyncPushResponse', s.syncPushResponse],
  ['SyncPullResponse', s.syncPullResponse],
  ['PendingAtelier', s.pendingAtelier],
  ['RankedAtelier', s.rankedAtelier],
  ['PendingReview', s.pendingReview],
  ['AtelierContact', s.atelierContact],
  ['ClientPage', s.clientPage],
  ['OrderPage', s.orderPage],
  ['InventoryPage', s.inventoryPage],
  ['AtelierContactPage', s.atelierContactPage],
  ['SharedOrder', s.sharedOrderResponse],
  ['SharedOrderPage', s.sharedOrderPage],
  ['Promotion', s.promotion],
  ['AdminPromotion', s.adminPromotion],
  ['ProblemDetails', s.problemDetails],
];
const nameBySchema = new Map<ZodTypeAny, string>(
  named.map(([name, schema]) => [schema, name]),
);
for (const [name, schema] of named) schemaRef(name, schema);

function responseSchema(route: RouteDef): Record<string, unknown> | undefined {
  if (!route.response) return undefined;
  const name = nameBySchema.get(route.response);
  const base = name
    ? { $ref: `#/components/schemas/${name}` }
    : inlineSchema(route.response);
  return route.responseIsArray ? { type: 'array', items: base } : base;
}

function queryParameters(schema: ZodTypeAny): unknown[] {
  const json = inlineSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([name, value]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: value,
  }));
}

const problem = { $ref: '#/components/schemas/ProblemDetails' };
const problemResponse = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problem } },
});

const paths: Record<string, Record<string, unknown>> = {};

for (const route of routes) {
  const operation: Record<string, unknown> = {
    operationId: route.operationId,
    summary: route.summary,
    tags: [route.tag],
  };

  const parameters: unknown[] = [
    ...(route.params ?? []).map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    })),
    ...(route.query ? queryParameters(route.query) : []),
  ];
  if (parameters.length) operation.parameters = parameters;

  if (route.body) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: inlineSchema(route.body) } },
    };
  }

  if (route.bodyMultipart) {
    operation.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: [route.bodyMultipart.file],
            properties: {
              [route.bodyMultipart.file]: { type: 'string', format: 'binary' },
              ...Object.fromEntries(
                Object.entries(route.bodyMultipart.fields).map(([name, schema]) => [
                  name,
                  inlineSchema(schema),
                ]),
              ),
            },
          },
        },
      },
    };
  }

  const responses: Record<string, unknown> = {};
  const status = String(route.status ?? 200);
  const schema = responseSchema(route);
  if (route.responseBinary) {
    responses[status] = {
      description: 'Success',
      content: {
        [route.responseBinary]: { schema: { type: 'string', format: 'binary' } },
      },
    };
  } else {
    responses[status] = schema
      ? {
          description: 'Success',
          content: { 'application/json': { schema } },
        }
      : { description: 'No content' };
  }

  responses['400'] = problemResponse('Validation failed');
  if (route.auth) {
    operation.security = [{ bearerAuth: [] }];
    responses['401'] = problemResponse('Missing or expired credentials');
    if (route.roles) {
      responses['403'] = problemResponse(`Requires role: ${route.roles}`);
    }
  }
  responses['429'] = problemResponse('Rate limited');
  responses['500'] = problemResponse('Unexpected server error');

  operation.responses = responses;

  const bucket = (paths[route.path] ??= {});
  bucket[route.method] = operation;
}

const document = {
  openapi: '3.0.3',
  info: {
    title: 'Gnawalma API',
    version: '1.0.0',
    description:
      'Generated from the zod schemas in src/contracts/schemas.ts. Do not edit by hand — run `npm run openapi:generate`.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'health' },
    { name: 'auth' },
    { name: 'marketplace' },
    { name: 'operations' },
    { name: 'sync' },
    { name: 'media' },
    { name: 'admin' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: definitions,
  },
  paths,
};

const target = resolve(process.cwd(), 'openapi.json');
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `openapi.json written: ${routes.length} operations, ${Object.keys(paths).length} paths.`,
);
