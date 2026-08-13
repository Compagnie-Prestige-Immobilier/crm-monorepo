// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'render_template_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RenderTemplateDtoCWProxy {
  RenderTemplateDto variables(Object variables);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RenderTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RenderTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RenderTemplateDto call({Object variables});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRenderTemplateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRenderTemplateDto.copyWith.fieldName(...)`
class _$RenderTemplateDtoCWProxyImpl implements _$RenderTemplateDtoCWProxy {
  const _$RenderTemplateDtoCWProxyImpl(this._value);

  final RenderTemplateDto _value;

  @override
  RenderTemplateDto variables(Object variables) => this(variables: variables);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RenderTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RenderTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RenderTemplateDto call({Object? variables = const $CopyWithPlaceholder()}) {
    return RenderTemplateDto(
      variables: variables == const $CopyWithPlaceholder()
          ? _value.variables
          // ignore: cast_nullable_to_non_nullable
          : variables as Object,
    );
  }
}

extension $RenderTemplateDtoCopyWith on RenderTemplateDto {
  /// Returns a callable class that can be used as follows: `instanceOfRenderTemplateDto.copyWith(...)` or like so:`instanceOfRenderTemplateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RenderTemplateDtoCWProxy get copyWith =>
      _$RenderTemplateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RenderTemplateDto _$RenderTemplateDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RenderTemplateDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['variables']);
      final val = RenderTemplateDto(
        variables: $checkedConvert('variables', (v) => v as Object),
      );
      return val;
    });

Map<String, dynamic> _$RenderTemplateDtoToJson(RenderTemplateDto instance) =>
    <String, dynamic>{'variables': instance.variables};
