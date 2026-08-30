enum SyncEntityType {
  client('client'),
  inventoryItem('inventory_item');

  const SyncEntityType(this.apiValue);
  final String apiValue;

  static SyncEntityType fromApi(String value) {
    return SyncEntityType.values.firstWhere(
      (item) => item.apiValue == value,
      orElse: () => throw FormatException('Unsupported sync entity: $value'),
    );
  }
}

enum SyncMutation {
  upsert('upsert'),
  delete('delete');

  const SyncMutation(this.apiValue);
  final String apiValue;
}

enum SyncQueueState { pending, sending, conflict }

class SyncOperation {
  const SyncOperation({
    required this.operationId,
    required this.atelierId,
    required this.entityType,
    required this.entityId,
    required this.localId,
    required this.baseVersion,
    required this.mutation,
    required this.payload,
    required this.createdAt,
    required this.queueState,
    this.lastError,
  });

  final String operationId;
  final String atelierId;
  final SyncEntityType entityType;
  final String entityId;
  final String localId;
  final int baseVersion;
  final SyncMutation mutation;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final SyncQueueState queueState;
  final String? lastError;

  SyncOperation copyWith({
    SyncQueueState? queueState,
    String? lastError,
    bool clearError = false,
  }) {
    return SyncOperation(
      operationId: operationId,
      atelierId: atelierId,
      entityType: entityType,
      entityId: entityId,
      localId: localId,
      baseVersion: baseVersion,
      mutation: mutation,
      payload: payload,
      createdAt: createdAt,
      queueState: queueState ?? this.queueState,
      lastError: clearError ? null : lastError ?? this.lastError,
    );
  }

  Map<String, dynamic> toApiJson() => {
    'operationId': operationId,
    'entityType': entityType.apiValue,
    'entityId': entityId,
    'baseVersion': baseVersion,
    'operation': mutation.apiValue,
    'payload': payload,
  };

  Map<String, dynamic> toStorageJson() => {
    ...toApiJson(),
    'atelierId': atelierId,
    'localId': localId,
    'createdAt': createdAt.toUtc().toIso8601String(),
    'queueState': queueState.name,
    if (lastError != null) 'lastError': lastError,
  };

  factory SyncOperation.fromStorageJson(Map<String, dynamic> json) {
    return SyncOperation(
      operationId: json['operationId'] as String,
      atelierId: json['atelierId'] as String,
      entityType: SyncEntityType.fromApi(json['entityType'] as String),
      entityId: json['entityId'] as String,
      localId: json['localId'] as String,
      baseVersion: (json['baseVersion'] as num?)?.toInt() ?? 0,
      mutation: SyncMutation.values.firstWhere(
        (item) => item.apiValue == json['operation'],
        orElse: () => SyncMutation.upsert,
      ),
      payload: Map<String, dynamic>.from(json['payload'] as Map? ?? const {}),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
      queueState: SyncQueueState.values.firstWhere(
        (item) => item.name == json['queueState'],
        orElse: () => SyncQueueState.pending,
      ),
      lastError: json['lastError'] as String?,
    );
  }
}

class RemoteEntityLink {
  const RemoteEntityLink({
    required this.atelierId,
    required this.entityType,
    required this.localId,
    required this.remoteId,
    required this.version,
  });

  final String atelierId;
  final SyncEntityType entityType;
  final String localId;
  final String remoteId;
  final int version;

  RemoteEntityLink copyWith({int? version}) => RemoteEntityLink(
    atelierId: atelierId,
    entityType: entityType,
    localId: localId,
    remoteId: remoteId,
    version: version ?? this.version,
  );

  Map<String, dynamic> toJson() => {
    'atelierId': atelierId,
    'entityType': entityType.apiValue,
    'localId': localId,
    'remoteId': remoteId,
    'version': version,
  };

  factory RemoteEntityLink.fromJson(Map<String, dynamic> json) {
    return RemoteEntityLink(
      atelierId: json['atelierId'] as String,
      entityType: SyncEntityType.fromApi(json['entityType'] as String),
      localId: json['localId'] as String,
      remoteId: json['remoteId'] as String,
      version: (json['version'] as num?)?.toInt() ?? 0,
    );
  }
}

class SyncPushResult {
  const SyncPushResult({
    required this.operationId,
    required this.entityType,
    required this.entityId,
    required this.status,
    this.version,
    this.code,
    this.current,
    this.replayed = false,
  });

  final String operationId;
  final SyncEntityType entityType;
  final String entityId;
  final String status;
  final int? version;
  final String? code;
  final Map<String, dynamic>? current;
  final bool replayed;

  bool get isApplied => status == 'applied';
  bool get isConflict => status == 'conflict';

  factory SyncPushResult.fromJson(Map<String, dynamic> json) {
    return SyncPushResult(
      operationId: json['operationId'] as String,
      entityType: SyncEntityType.fromApi(json['entityType'] as String),
      entityId: json['entityId'] as String,
      status: json['status'] as String? ?? 'conflict',
      version: (json['version'] as num?)?.toInt(),
      code: json['code'] as String?,
      current: json['current'] is Map
          ? Map<String, dynamic>.from(json['current'] as Map)
          : null,
      replayed: json['replayed'] == true,
    );
  }
}

class SyncPullChange {
  const SyncPullChange({
    required this.sequence,
    required this.entityType,
    required this.entityId,
    required this.mutation,
    required this.version,
    required this.payload,
    required this.occurredAt,
  });

  final int sequence;
  final SyncEntityType entityType;
  final String entityId;
  final SyncMutation mutation;
  final int version;
  final Map<String, dynamic> payload;
  final DateTime? occurredAt;

  factory SyncPullChange.fromJson(Map<String, dynamic> json) {
    return SyncPullChange(
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
      entityType: SyncEntityType.fromApi(json['entityType'] as String),
      entityId: json['entityId'] as String,
      mutation: SyncMutation.values.firstWhere(
        (item) => item.apiValue == json['operation'],
        orElse: () => SyncMutation.upsert,
      ),
      version: (json['version'] as num?)?.toInt() ?? 0,
      payload: Map<String, dynamic>.from(json['payload'] as Map? ?? const {}),
      occurredAt: DateTime.tryParse(
        json['occurredAt'] as String? ?? '',
      )?.toLocal(),
    );
  }
}

class SyncPullPage {
  const SyncPullPage({
    required this.cursor,
    required this.changes,
    required this.hasMore,
  });

  final int cursor;
  final List<SyncPullChange> changes;
  final bool hasMore;

  factory SyncPullPage.fromJson(Map<String, dynamic> json) {
    final rawChanges = json['changes'];
    return SyncPullPage(
      cursor: (json['cursor'] as num?)?.toInt() ?? 0,
      changes: rawChanges is List
          ? rawChanges
                .whereType<Map>()
                .map(
                  (item) =>
                      SyncPullChange.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList(growable: false)
          : const [],
      hasMore: json['hasMore'] == true,
    );
  }
}

class SyncSnapshot {
  const SyncSnapshot({
    required this.pendingCount,
    required this.conflictCount,
    required this.isSyncing,
    this.lastSyncedAt,
    this.lastError,
  });

  final int pendingCount;
  final int conflictCount;
  final bool isSyncing;
  final DateTime? lastSyncedAt;
  final String? lastError;

  bool get isHealthy => conflictCount == 0 && lastError == null;

  SyncSnapshot copyWith({
    int? pendingCount,
    int? conflictCount,
    bool? isSyncing,
    DateTime? lastSyncedAt,
    String? lastError,
    bool clearError = false,
  }) {
    return SyncSnapshot(
      pendingCount: pendingCount ?? this.pendingCount,
      conflictCount: conflictCount ?? this.conflictCount,
      isSyncing: isSyncing ?? this.isSyncing,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      lastError: clearError ? null : lastError ?? this.lastError,
    );
  }
}
