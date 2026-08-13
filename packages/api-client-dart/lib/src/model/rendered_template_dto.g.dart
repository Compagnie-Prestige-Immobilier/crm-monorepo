// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rendered_template_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RenderedTemplateDtoCWProxy {
  RenderedTemplateDto title(String title);

  RenderedTemplateDto body(String body);

  RenderedTemplateDto missing(List<String> missing);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RenderedTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RenderedTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RenderedTemplateDto call({String title, String body, List<String> missing});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRenderedTemplateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRenderedTemplateDto.copyWith.fieldName(...)`
class _$RenderedTemplateDtoCWProxyImpl implements _$RenderedTemplateDtoCWProxy {
  const _$RenderedTemplateDtoCWProxyImpl(this._value);

  final RenderedTemplateDto _value;

  @override
  RenderedTemplateDto title(String title) => this(title: title);

  @override
  RenderedTemplateDto body(String body) => this(body: body);

  @override
  RenderedTemplateDto missing(List<String> missing) => this(missing: missing);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RenderedTemplateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RenderedTemplateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RenderedTemplateDto call({
    Object? title = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? missing = const $CopyWithPlaceholder(),
  }) {
    return RenderedTemplateDto(
      title: title == const $CopyWithPlaceholder()
          ? _value.title
          // ignore: cast_nullable_to_non_nullable
          : title as String,
      body: body == const $CopyWithPlaceholder()
          ? _value.body
          // ignore: cast_nullable_to_non_nullable
          : body as String,
      missing: missing == const $CopyWithPlaceholder()
          ? _value.missing
          // ignore: cast_nullable_to_non_nullable
          : missing as List<String>,
    );
  }
}

extension $RenderedTemplateDtoCopyWith on RenderedTemplateDto {
  /// Returns a callable class that can be used as follows: `instanceOfRenderedTemplateDto.copyWith(...)` or like so:`instanceOfRenderedTemplateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RenderedTemplateDtoCWProxy get copyWith =>
      _$RenderedTemplateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RenderedTemplateDto _$RenderedTemplateDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RenderedTemplateDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['title', 'body', 'missing']);
      final val = RenderedTemplateDto(
        title: $checkedConvert('title', (v) => v as String),
        body: $checkedConvert('body', (v) => v as String),
        missing: $checkedConvert(
          'missing',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RenderedTemplateDtoToJson(
  RenderedTemplateDto instance,
) => <String, dynamic>{
  'title': instance.title,
  'body': instance.body,
  'missing': instance.missing,
};
