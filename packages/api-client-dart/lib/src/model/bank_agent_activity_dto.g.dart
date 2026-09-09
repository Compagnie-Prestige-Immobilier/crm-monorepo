// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bank_agent_activity_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BankAgentActivityDtoCWProxy {
  BankAgentActivityDto agentId(String agentId);

  BankAgentActivityDto label(String label);

  BankAgentActivityDto created(num created);

  BankAgentActivityDto transitions(num transitions);

  BankAgentActivityDto cashed(num cashed);

  BankAgentActivityDto amountXof(String amountXof);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgentActivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgentActivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgentActivityDto call({
    String agentId,
    String label,
    num created,
    num transitions,
    num cashed,
    String amountXof,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBankAgentActivityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBankAgentActivityDto.copyWith.fieldName(...)`
class _$BankAgentActivityDtoCWProxyImpl
    implements _$BankAgentActivityDtoCWProxy {
  const _$BankAgentActivityDtoCWProxyImpl(this._value);

  final BankAgentActivityDto _value;

  @override
  BankAgentActivityDto agentId(String agentId) => this(agentId: agentId);

  @override
  BankAgentActivityDto label(String label) => this(label: label);

  @override
  BankAgentActivityDto created(num created) => this(created: created);

  @override
  BankAgentActivityDto transitions(num transitions) =>
      this(transitions: transitions);

  @override
  BankAgentActivityDto cashed(num cashed) => this(cashed: cashed);

  @override
  BankAgentActivityDto amountXof(String amountXof) =>
      this(amountXof: amountXof);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BankAgentActivityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BankAgentActivityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BankAgentActivityDto call({
    Object? agentId = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? created = const $CopyWithPlaceholder(),
    Object? transitions = const $CopyWithPlaceholder(),
    Object? cashed = const $CopyWithPlaceholder(),
    Object? amountXof = const $CopyWithPlaceholder(),
  }) {
    return BankAgentActivityDto(
      agentId: agentId == const $CopyWithPlaceholder()
          ? _value.agentId
          // ignore: cast_nullable_to_non_nullable
          : agentId as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      created: created == const $CopyWithPlaceholder()
          ? _value.created
          // ignore: cast_nullable_to_non_nullable
          : created as num,
      transitions: transitions == const $CopyWithPlaceholder()
          ? _value.transitions
          // ignore: cast_nullable_to_non_nullable
          : transitions as num,
      cashed: cashed == const $CopyWithPlaceholder()
          ? _value.cashed
          // ignore: cast_nullable_to_non_nullable
          : cashed as num,
      amountXof: amountXof == const $CopyWithPlaceholder()
          ? _value.amountXof
          // ignore: cast_nullable_to_non_nullable
          : amountXof as String,
    );
  }
}

extension $BankAgentActivityDtoCopyWith on BankAgentActivityDto {
  /// Returns a callable class that can be used as follows: `instanceOfBankAgentActivityDto.copyWith(...)` or like so:`instanceOfBankAgentActivityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BankAgentActivityDtoCWProxy get copyWith =>
      _$BankAgentActivityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BankAgentActivityDto _$BankAgentActivityDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('BankAgentActivityDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'agentId',
      'label',
      'created',
      'transitions',
      'cashed',
      'amountXof',
    ],
  );
  final val = BankAgentActivityDto(
    agentId: $checkedConvert('agentId', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    created: $checkedConvert('created', (v) => v as num),
    transitions: $checkedConvert('transitions', (v) => v as num),
    cashed: $checkedConvert('cashed', (v) => v as num),
    amountXof: $checkedConvert('amountXof', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$BankAgentActivityDtoToJson(
  BankAgentActivityDto instance,
) => <String, dynamic>{
  'agentId': instance.agentId,
  'label': instance.label,
  'created': instance.created,
  'transitions': instance.transitions,
  'cashed': instance.cashed,
  'amountXof': instance.amountXof,
};
