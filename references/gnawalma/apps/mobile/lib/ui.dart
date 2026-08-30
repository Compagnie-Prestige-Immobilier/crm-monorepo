import 'dart:ui' show ImageByteFormat;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart' hide FThemeBuildContext;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'config.dart';
import 'models.dart';
import 'session.dart';
import 'theme.dart';

export 'package:forui/forui.dart' show FIcons;
export 'theme.dart';

Widget _tap(Widget child, {VoidCallback? onTap, VoidCallback? onLongPress, String? label}) => onTap == null && onLongPress == null
    ? child
    : FTappable(onPress: onTap, onLongPress: onLongPress, semanticsLabel: label, behavior: HitTestBehavior.opaque, child: child);

class AppScaffold extends ConsumerWidget {
  const AppScaffold({super.key, required this.body, this.title, this.actions = const [], this.bottom, this.navBar, this.onRefresh, this.onBack, this.scroll = true});
  final Widget body;
  final String? title;
  final List<Widget> actions;
  final Widget? bottom, navBar;
  final Future<void> Function()? onRefresh;
  final VoidCallback? onBack;
  final bool scroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canPop = onBack != null || Navigator.of(context).canPop();
    final hasHeader = canPop || actions.isNotEmpty;
    Widget content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (ref.watch(offlineProvider).value ?? false)
        const Padding(
          padding: EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, 0),
          child: FAlert(icon: Icon(FIcons.wifiOff), title: Text('Hors ligne'), subtitle: Text('Les données affichées peuvent être anciennes.')),
        ),
      if (title != null) AppTitle(title!),
      Expanded(child: body),
    ]);
    if (onRefresh != null) content = RefreshIndicator(onRefresh: onRefresh!, color: context.colors.onSurface, child: content);
    return Material(type: MaterialType.transparency, child: FScaffold(
      childPad: false,
      header: !hasHeader ? null : FHeader.nested(
        prefixes: [if (canPop) AppIconButton(icon: FIcons.arrowLeft, label: 'Retour', onTap: onBack ?? () => Navigator.of(context).pop())],
        suffixes: actions,
      ),
      footer: navBar ?? (bottom == null ? null : _ActionBar(child: bottom!)),
      child: SafeArea(top: !hasHeader, bottom: navBar == null && bottom == null, child: content),
    ));
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: context.colors.surface,
    child: Padding(padding: EdgeInsets.fromLTRB(Insets.page, Insets.md, Insets.page, Insets.md + MediaQuery.paddingOf(context).bottom), child: Row(children: [Expanded(child: child)])),
  );
}

class AppTitle extends StatelessWidget {
  const AppTitle(this.text, {super.key, this.large = false, this.centered = false});
  final String text;
  final bool large, centered;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, Insets.xl),
    child: SizedBox(width: double.infinity, child: Text(
      text,
      style: centered ? context.text.headlineMedium!.copyWith(fontSize: 26, fontWeight: FontWeight.w700, height: 1.25) : large ? context.text.displayLarge : context.text.displayMedium,
      textAlign: centered ? TextAlign.center : TextAlign.start, maxLines: centered ? 2 : null, overflow: centered ? TextOverflow.ellipsis : null,
    )),
  );
}

class AppSection extends StatelessWidget {
  const AppSection(this.text, {super.key, this.action, this.onAction});
  final String text;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, Insets.sm),
    child: Row(children: [
      Expanded(child: Text(text, style: context.text.titleLarge)),
      if (action != null) AppButton(action!, onPressed: onAction, variant: AppButtonVariant.ghost, size: 44),
    ]),
  );
}

class AppIconButton extends StatelessWidget {
  const AppIconButton({super.key, required this.icon, required this.label, this.onTap, this.color});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  @override
  Widget build(BuildContext context) => Semantics(
    label: label, button: true, excludeSemantics: true, onTap: onTap,
    child: FButton.icon(variant: FButtonVariant.ghost, onPress: onTap, child: Icon(icon, color: color ?? context.colors.onSurface)),
  );
}

/// Ligne nue : posée dans un AppCard, ou dans un AppCard.rows qui trace les filets lui-même.
class AppRow extends StatelessWidget with FTileMixin {
  const AppRow({super.key, required this.title, this.subtitle, this.leading, this.trailing, this.onTap, this.onLongPress, this.danger = false});
  final String title;
  final String? subtitle;
  final Widget? leading, trailing;
  final VoidCallback? onTap, onLongPress;
  final bool danger;

  @override
  Widget build(BuildContext context) => FTile(
    variant: danger ? FItemVariant.destructive : FItemVariant.primary,
    title: Text(title), subtitle: subtitle == null ? null : Text(subtitle!),
    prefix: leading, details: trailing,
    suffix: trailing == null && onTap != null ? const Icon(FIcons.chevronRight) : null,
    onPress: onTap, onLongPress: onLongPress,
  );
}

class AppDivider extends StatelessWidget {
  const AppDivider({super.key, this.inset = true});
  final bool inset;
  @override
  Widget build(BuildContext context) => Padding(padding: EdgeInsets.symmetric(horizontal: inset ? Insets.page : 0), child: const FDivider());
}

/// Surface blanche à rayon 24. `rows` compose des AppRow dans un FTileGroup qui trace les filets.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required Widget this.child, this.padding, this.onTap}) : rows = null;
  const AppCard.rows(List<FTileMixin> this.rows, {super.key, this.onTap}) : child = null, padding = null;
  final Widget? child;
  final List<FTileMixin>? rows;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => _tap(
    rows != null ? FTileGroup(children: rows!) : FCard.raw(child: ClipRRect(borderRadius: Radii.card, child: Padding(padding: padding ?? EdgeInsets.zero, child: child))),
    onTap: onTap,
  );
}

class AppAvatar extends StatelessWidget {
  const AppAvatar({super.key, required this.name, this.size = 44, this.imageUrl});
  final String name;
  final double size;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w.characters.first.toUpperCase()).join();
    final dark = context.theme.brightness == Brightness.dark;
    final tint = HSLColor.fromAHSL(1, (name.hashCode % 360).toDouble(), .35, dark ? .28 : .88).toColor();
    final style = FAvatarStyleDelta.delta(backgroundColor: tint, textStyle: TextStyleDelta.delta(fontSize: size * .36));
    final fallback = Text(initials.isEmpty ? '?' : initials);
    final avatar = imageUrl == null ? FAvatar.raw(size: size, style: style, child: fallback) : FAvatar(size: size, style: style, image: CachedNetworkImageProvider(imageUrl!, cacheManager: photoCache, maxWidth: (size * MediaQuery.devicePixelRatioOf(context)).round()), fallback: fallback);
    return Semantics(label: name, excludeSemantics: true, child: avatar);
  }
}

/// Tuile noire pour la valeur clé de l'écran. `value` hérite du blanc, AppMoney compris.
class AppKeyTile extends StatelessWidget {
  const AppKeyTile({super.key, required this.label, required this.value, this.onTap});
  final String label;
  final Widget value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final onInk = context.colors.onPrimary;
    final dim = onInk.withValues(alpha: .7);
    return _tap(
      FCard.raw(
        style: FCardStyleDelta.delta(decoration: DecorationDelta.boxDelta(color: context.colors.primary, boxShadow: const [])),
        child: ConstrainedBox(constraints: const BoxConstraints(minHeight: 120), child: Padding(
          padding: const EdgeInsets.all(Insets.page),
          child: Row(children: [
            Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: context.text.bodySmall!.copyWith(color: dim)),
              const SizedBox(height: Insets.md),
              Theme(
                data: context.theme.copyWith(colorScheme: context.colors.copyWith(onSurface: onInk)),
                child: DefaultTextStyle.merge(style: AppText.moneyXl.copyWith(color: onInk), child: value),
              ),
            ])),
            if (onTap != null) Icon(FIcons.chevronRight, color: dim),
          ]),
        )),
      ),
      onTap: onTap,
    );
  }
}

class AppStatCard extends StatelessWidget {
  const AppStatCard({super.key, required this.label, required this.value, this.footer, this.onTap});
  final String label;
  final Widget value;
  final Widget? footer;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => _tap(
    FCard(title: Text(label), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      DefaultTextStyle.merge(style: context.text.headlineMedium, child: value),
      if (footer != null) ...[const SizedBox(height: Insets.md), footer!],
    ])),
    onTap: onTap,
  );
}

enum AppButtonVariant { primary, secondary, ghost, danger }

class AppButton extends StatelessWidget {
  const AppButton(this.label, {super.key, this.onPressed, this.variant = AppButtonVariant.primary, this.icon, this.loading = false, this.size = 52});
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    enabled: !loading,
    child: ConstrainedBox(
      constraints: BoxConstraints(minHeight: size),
      child: FButton(
        variant: switch (variant) {
          AppButtonVariant.primary => FButtonVariant.primary,
          AppButtonVariant.secondary => FButtonVariant.outline,
          AppButtonVariant.ghost => FButtonVariant.ghost,
          AppButtonVariant.danger => FButtonVariant.destructive,
        },
        size: size < 44 ? FButtonSizeVariant.xs : FButtonSizeVariant.md,
        // Pendant le chargement le bouton garde son libellé mais n'accepte plus les touches : verrou anti double envoi.
        onPress: loading ? null : onPressed,
        mainAxisSize: MainAxisSize.min,
        prefix: loading ? const FCircularProgress(size: FCircularProgressSizeVariant.sm) : icon == null ? null : Icon(icon, size: 20),
        child: Text(label, style: AppText.label, overflow: TextOverflow.ellipsis),
      ),
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, {required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 44),
    child: FButton(
      variant: selected ? FButtonVariant.primary : FButtonVariant.secondary, size: FButtonSizeVariant.md, style: pillButton,
      selected: selected, mainAxisSize: MainAxisSize.min, onPress: onTap,
      child: Text(label, style: AppText.label),
    ),
  );
}

/// Pastilles segmentées : sélection en aplat d'encre, le reste en fond creusé.
class AppSegmented extends StatelessWidget {
  const AppSegmented({super.key, required this.options, required this.index, required this.onChanged});
  final List<String> options;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: Insets.page, vertical: Insets.sm),
    child: Row(mainAxisAlignment: MainAxisAlignment.center, spacing: Insets.sm, children: [
      for (var i = 0; i < options.length; i++) _Pill(options[i], selected: i == index, onTap: () => onChanged(i)),
    ]),
  );
}

class AppTabs extends StatelessWidget {
  const AppTabs({super.key, required this.tabs, required this.index, required this.onChanged});
  final List<String> tabs;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => AppSegmented(options: tabs, index: index, onChanged: onChanged);
}

class AppChoice<T> extends StatelessWidget {
  const AppChoice({super.key, required this.options, required this.selected, required this.onChanged, required this.label, this.multi = false});
  final List<T> options;
  final Set<T> selected;
  final void Function(T) onChanged;
  final String Function(T) label;
  final bool multi;
  @override
  Widget build(BuildContext context) => Wrap(spacing: Insets.sm, runSpacing: Insets.sm, children: [
    for (final o in options) _Pill(label(o), selected: selected.contains(o), onTap: () => onChanged(o)),
  ]);
}

class AppField extends StatefulWidget {
  const AppField({super.key, required this.label, this.controller, this.hint, this.error, this.keyboardType, this.obscure = false, this.maxLines = 1, this.prefix, this.suffix, this.onChanged, this.autofocus = false, this.textInputAction, this.onSubmitted, this.readOnly = false, this.onTap, this.formatters, this.maxLength});
  final String label;
  final TextEditingController? controller;
  final String? hint, error;
  final TextInputType? keyboardType;
  final bool obscure, autofocus, readOnly;
  final int maxLines;
  final int? maxLength;
  final Widget? prefix, suffix;
  final ValueChanged<String>? onChanged, onSubmitted;
  final TextInputAction? textInputAction;
  final VoidCallback? onTap;
  final List<TextInputFormatter>? formatters;

  static final digitsOnly = [FilteringTextInputFormatter.digitsOnly];
  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  late String? _last = widget.controller?.text;

  // Forui notifie aussi les changements de sélection ; on ne relaie que le texte.
  void _changed(TextEditingValue v) {
    if (v.text == _last) return;
    _last = v.text;
    widget.onChanged?.call(v.text);
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    return FTextField(
      control: FTextFieldControl.managed(controller: w.controller, onChange: _changed),
      label: Text(w.label), hint: w.hint, error: w.error == null ? null : Semantics(liveRegion: true, child: Text(w.error!)),
      keyboardType: w.keyboardType, obscureText: w.obscure, maxLines: w.maxLines, autofocus: w.autofocus,
      textInputAction: w.textInputAction, onSubmit: w.onSubmitted, readOnly: w.readOnly, onTap: w.onTap,
      inputFormatters: w.formatters, maxLength: w.maxLength,
      prefixBuilder: w.prefix == null ? null : (_, _, _) => w.prefix!,
      suffixBuilder: w.suffix == null ? null : (_, _, _) => w.suffix!,
    );
  }
}

// Numéros sénégalais : 9 chiffres, mobiles en 70/75/76/77/78, fixes en 33.
final _snPhone = RegExp(r'^(7[05678]|3[03])\d{7}$');
final _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

String phoneDigits(String s) {
  var d = s.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00221')) d = d.substring(5);
  if (d.startsWith('221') && d.length > 3) d = d.substring(3);
  return d.length > 9 ? d.substring(0, 9) : d;
}

/// « 77 123 45 67 » à partir de n'importe quelle saisie.
String formatPhone(String s) {
  final d = phoneDigits(s);
  return [for (var i = 0; i < d.length; i++) if (i == 2 || i == 5 || i == 7) ' ${d[i]}' else d[i]].join();
}

/// Affichage d'un numéro stocké en E.164.
String prettyPhone(String e164) => e164.startsWith('+221') ? '+221 ${formatPhone(e164)}' : e164;

String? phoneE164(String s) => phoneDigits(s).isEmpty ? null : '+221${phoneDigits(s)}';

String firstName(String name) => name.trim().split(RegExp(r'\s+')).first;

/// wa.me n'accepte que les chiffres, indicatif compris.
Future<void> openWhatsApp(String phone, {String? text}) async {
  final query = text == null ? '' : '?text=${Uri.encodeComponent(text)}';
  await launchUrl(Uri.parse('https://wa.me/${phone.replaceAll(RegExp(r'\D'), '')}$query'), mode: LaunchMode.externalApplication);
}

/// Recherche d'un client : les chiffres du numéro d'un côté, le nom sans casse ni accents de l'autre.
bool matchesQuery(String query, {required String name, String? phone}) {
  final q = query.trim();
  if (q.isEmpty) return true;
  final digits = phoneDigits(q);
  if (digits.isNotEmpty && phoneDigits(phone ?? '').contains(digits)) return true;
  return foldAccents(name).contains(foldAccents(q));
}

String? phoneError(String s, {bool required = true}) {
  final d = phoneDigits(s);
  if (d.isEmpty) return required ? 'Le numéro est requis.' : null;
  return _snPhone.hasMatch(d) ? null : 'Numéro invalide. Exemple : 77 123 45 67.';
}

String? emailError(String s) => _emailRe.hasMatch(s.trim()) ? null : 'Adresse e-mail invalide.';

class _PhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue v) {
    var d = phoneDigits(v.text);
    // Effacer une espace du masque doit effacer le chiffre qui la précède.
    if (v.text.length < old.text.length && d == phoneDigits(old.text) && d.isNotEmpty) d = d.substring(0, d.length - 1);
    final text = formatPhone(d);
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

/// Une seule entrée « Support client » ; la feuille regroupe WhatsApp, appel et signalement.
void supportSheet(BuildContext context, {required String version, String? identifier}) {
  final who = identifier == null ? '' : ' Mon numéro : $identifier.';
  Uri wa(String m) => Uri.parse('https://wa.me/${supportPhone.replaceAll('+', '')}?text=${Uri.encodeComponent(m)}');
  void open(Uri u) { popSheet(context); launchUrl(u, mode: LaunchMode.externalApplication); }
  showAppSheet(context, title: 'Support client', child: Column(mainAxisSize: MainAxisSize.min, children: [
    AppRow(leading: const Icon(FIcons.messageCircle), title: 'Nous écrire sur WhatsApp', subtitle: 'Le plus rapide', onTap: () => open(wa('Bonjour, je vous contacte depuis l\'application Gnawalma (version $version).$who'))),
    const AppDivider(),
    AppRow(leading: const Icon(FIcons.phone), title: 'Appeler l\'équipe', subtitle: prettyPhone(supportPhone), onTap: () => open(Uri.parse('tel:$supportPhone'))),
    const AppDivider(),
    AppRow(leading: const Icon(FIcons.triangleAlert), title: 'Signaler un problème', subtitle: 'Décrivez ce qui ne marche pas', onTap: () => open(wa('Bonjour, je signale un problème sur l\'application Gnawalma (version $version).$who Description : '))),
  ]));
}

const socialPrefixes = {'tiktok': 'tiktok.com/@', 'instagram': 'instagram.com/', 'facebook': 'facebook.com/'};
const socialLabels = {'tiktok': 'TikTok', 'instagram': 'Instagram', 'facebook': 'Facebook'};

/// Nom d'utilisateur seul : un lien ou un @ collé est réduit au nom.
String socialHandle(String s) => s.trim()
    .replaceFirst(RegExp(r'^(https?://)?(www\.|m\.)?[a-z]+\.com/(@)?', caseSensitive: false), '')
    .replaceFirst('@', '')
    .replaceAll(RegExp(r'[\s/?#].*$'), '');

String socialUrl(String network, String handle) => 'https://www.${socialPrefixes[network]}${socialHandle(handle)}';

class _HandleFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue v) {
    final text = socialHandle(v.text);
    return text == v.text ? v : TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

class AppSocialField extends StatelessWidget {
  const AppSocialField(this.network, {super.key, this.controller, this.error, this.textInputAction, this.onSubmitted});
  final String network;
  final TextEditingController? controller;
  final String? error;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  @override
  Widget build(BuildContext context) => AppField(
    label: socialLabels[network]!, controller: controller, hint: 'votre.atelier', error: error, keyboardType: TextInputType.url, maxLength: 60,
    textInputAction: textInputAction, onSubmitted: onSubmitted, formatters: [_HandleFormatter()],
    prefix: Padding(padding: const EdgeInsets.only(left: Insets.md), child: Center(widthFactor: 1, child: Text(socialPrefixes[network]!, style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)))),
  );
}

class AppPhoneField extends StatelessWidget {
  const AppPhoneField({super.key, this.label = 'Téléphone', this.controller, this.error, this.autofocus = false, this.textInputAction, this.onSubmitted, this.onChanged});
  final String label;
  final TextEditingController? controller;
  final String? error;
  final bool autofocus;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted, onChanged;
  @override
  Widget build(BuildContext context) => AppField(
    label: label, controller: controller, hint: '77 123 45 67', error: error, keyboardType: TextInputType.phone, autofocus: autofocus,
    textInputAction: textInputAction, onSubmitted: onSubmitted, onChanged: onChanged, formatters: [_PhoneFormatter()],
    prefix: Padding(padding: const EdgeInsets.only(left: Insets.md), child: Center(widthFactor: 1, child: Text('+221', style: context.text.bodyMedium!.copyWith(color: context.tones.inkSecondary)))),
  );
}

final _fr = NumberFormat.decimalPattern('fr');

String formatCfa(int amount, {bool short = false}) => '${_fr.format(amount).replaceAll(RegExp(r'[\s ]'), ' ')} ${short ? 'F' : 'FCFA'}';

/// Durée d'un son en m:ss, jamais négative.
String formatClock(Duration d) {
  final s = d.inSeconds.clamp(0, 359999);
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

class AppMoney extends StatelessWidget {
  const AppMoney(this.amount, {super.key, this.style, this.short = false, this.color});
  final int amount;
  final TextStyle? style;
  final bool short;
  final Color? color;
  @override
  Widget build(BuildContext context) => Semantics(
    label: '${_fr.format(amount)} francs CFA', excludeSemantics: true,
    child: Text(formatCfa(amount, short: short), style: (style ?? AppText.moneyMd).copyWith(color: color ?? context.colors.onSurface)),
  );
}

enum AppTone { neutral, success, warning, danger }

class AppTag extends StatelessWidget {
  const AppTag(this.text, {super.key, this.tone = AppTone.neutral});
  final String text;
  final AppTone tone;
  @override
  Widget build(BuildContext context) {
    final t = context.tones;
    final (fg, bg) = switch (tone) {
      AppTone.neutral => (t.inkSecondary, t.sunken),
      AppTone.success => (t.success, t.success.withValues(alpha: .12)),
      AppTone.warning => (t.warning, t.warning.withValues(alpha: .12)),
      AppTone.danger => (t.danger, t.danger.withValues(alpha: .12)),
    };
    return FBadge(
      style: FBadgeStyle(
        decoration: BoxDecoration(color: bg, borderRadius: Radii.full),
        contentStyle: FBadgeContentStyle(
          labelTextStyle: context.text.bodySmall!.copyWith(color: fg, fontWeight: FontWeight.w600, letterSpacing: 0.4),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: Insets.xs),
        ),
      ),
      child: Text(text),
    );
  }
}

enum AppStateKind { empty, offline, error, permission }

class AppState extends StatelessWidget {
  const AppState({super.key, required this.kind, required this.title, this.message, this.actionLabel, this.onAction});
  final AppStateKind kind;
  final String title;
  final String? message, actionLabel;
  final VoidCallback? onAction;

  /// Jamais le message brut d'une exception : seul un ApiException sait parler au client.
  factory AppState.fromError(Object e, {VoidCallback? onRetry}) {
    final api = e is ApiException ? e : null;
    final offline = api?.offline ?? false;
    return AppState(
      kind: offline ? AppStateKind.offline : AppStateKind.error,
      title: offline ? 'Pas de connexion' : 'Impossible de charger',
      message: api?.message ?? 'Une erreur est survenue. Réessayez.',
      actionLabel: onRetry == null ? null : 'Réessayer', onAction: onRetry,
    );
  }

  @override
  Widget build(BuildContext context) {
    final icon = switch (kind) { AppStateKind.empty => FIcons.inbox, AppStateKind.offline => FIcons.wifiOff, AppStateKind.error => FIcons.circleAlert, AppStateKind.permission => FIcons.lock };
    return Center(child: Padding(padding: const EdgeInsets.all(Insets.xxl), child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 44, color: context.tones.inkTertiary),
        const SizedBox(height: Insets.xl),
        Text(title, style: context.text.headlineMedium, textAlign: TextAlign.center),
        if (message != null) ...[const SizedBox(height: Insets.sm), Text(message!, style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary), textAlign: TextAlign.center)],
        if (actionLabel != null) ...[const SizedBox(height: Insets.xxl), AppButton(actionLabel!, onPressed: onAction, variant: AppButtonVariant.secondary)],
    ])));
  }
}

class AppSkeleton extends StatelessWidget {
  const AppSkeleton({super.key, this.rows = 6, this.height = 64});
  final int rows;
  final double height;
  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsets.symmetric(horizontal: Insets.page, vertical: Insets.sm),
    itemCount: rows, separatorBuilder: (_, _) => const SizedBox(height: Insets.md),
    itemBuilder: (_, _) => FCard.raw(
      style: FCardStyleDelta.delta(decoration: DecorationDelta.boxDelta(color: context.tones.sunken, borderRadius: Radii.control, boxShadow: const [])),
      child: SizedBox(height: height, width: double.infinity),
    ),
  );
}

/// Ligne discrète sous un squelette : le serveur se réveille, l'écran n'est pas figé.
class AppWaking extends ConsumerWidget {
  const AppWaking({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => (ref.watch(wakingProvider).value ?? false)
      ? Padding(
          padding: const EdgeInsets.fromLTRB(Insets.page, 0, Insets.page, Insets.lg),
          child: Text('Connexion en cours, quelques secondes…', textAlign: TextAlign.center, style: context.text.bodySmall!.copyWith(color: context.tones.inkSecondary)),
        )
      : const SizedBox.shrink();
}

/// Un chemin renvoyé par /media, servi par le disque public de l'API.
String mediaUrl(String path) => '${apiBaseUrl.replaceFirst('/api/v1', '')}/m/$path';

class AppPhoto extends StatelessWidget {
  const AppPhoto(this.url, {super.key, this.fallbackText, this.aspectRatio = 16 / 10, this.radius = Radii.container, this.fit = BoxFit.cover, this.placeholderUrl});
  final String? url;
  // Vignette déjà en cache : évite le vide gris pendant que la pleine image arrive.
  final String? placeholderUrl;
  final String? fallbackText;
  final double aspectRatio;
  final BorderRadius radius;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final seed = (fallbackText ?? '').hashCode;
    final fallback = ColoredBox(
      color: HSLColor.fromAHSL(1, (seed % 360).toDouble(), .35, context.theme.brightness == Brightness.dark ? .25 : .85).toColor(),
      child: Center(child: Text((fallbackText ?? '?').characters.first.toUpperCase(), style: context.text.displayLarge!.copyWith(color: context.colors.onSurface.withValues(alpha: .7)))),
    );
    // Décodée à la largeur affichée : une vignette de 132 dp ne décode pas un JPEG de 1600 px.
    return ClipRRect(borderRadius: radius, child: AspectRatio(aspectRatio: aspectRatio, child: LayoutBuilder(builder: (context, c) {
      final width = (c.maxWidth.isFinite ? c.maxWidth : MediaQuery.sizeOf(context).width) * MediaQuery.devicePixelRatioOf(context);
      Widget net(String u, Widget placeholder) => CachedNetworkImage(imageUrl: u, fit: fit, cacheManager: photoCache, memCacheWidth: width.round(), placeholder: (_, _) => placeholder, errorWidget: (_, _, _) => fallback);
      final holder = placeholderUrl == null ? ColoredBox(color: context.tones.sunken) : net(placeholderUrl!, ColoredBox(color: context.tones.sunken));
      return url == null ? fallback : net(url!, holder);
    })));
  }
}

/// Ce qui sera capturé : la capture ignore l'échelle de police du téléphone, l'image partagée reste lisible.
class CaptureBox extends StatelessWidget {
  const CaptureBox({super.key, required this.boundary, required this.child});
  final GlobalKey boundary;
  final Widget child;
  @override
  Widget build(BuildContext context) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
    child: RepaintBoundary(key: boundary, child: child),
  );
}

Future<Uint8List?> captureWidget(GlobalKey key, {double pixelRatio = 3}) async {
  final boundary = key.currentContext?.findRenderObject();
  if (boundary is! RenderRepaintBoundary) return null;
  final data = await (await boundary.toImage(pixelRatio: pixelRatio)).toByteData(format: ImageByteFormat.png);
  return data?.buffer.asUint8List();
}

/// Partage l'image d'un [CaptureBox] déjà monté.
Future<void> shareCapture(BuildContext context, GlobalKey key, {required String name, String? text}) async {
  Uint8List? bytes;
  try { bytes = await captureWidget(key); } catch (_) {}
  if (bytes == null) {
    if (context.mounted) toast(context, 'Partage impossible. Réessayez.');
    return;
  }
  await SharePlus.instance.share(ShareParams(files: [XFile.fromData(bytes, mimeType: 'image/png', name: '$name.png')], text: text));
}

/// Les photos doivent être décodées avant une capture, sinon l'image part sans elles.
Future<void> precache(List<String?> urls, BuildContext context) async {
  for (final url in urls) {
    if (url == null) continue;
    try { await precacheImage(CachedNetworkImageProvider(url, cacheManager: photoCache), context); } catch (_) {}
    if (!context.mounted) return;
  }
}

// Les feuilles vivent dans le navigateur racine, au-dessus de la barre d'onglets : on les ferme avec popSheet.
void popSheet<T>(BuildContext context, [T? result]) => Navigator.of(context, rootNavigator: true).pop(result);

Future<T?> showAppSheet<T>(BuildContext context, {required Widget child, String? title}) => showFSheet<T>(
  context: context, side: FLayout.btt, mainAxisMaxRatio: null, useRootNavigator: true,
  builder: (ctx) => Material(type: MaterialType.transparency, child: FCard.raw(
    style: const FCardStyleDelta.delta(decoration: DecorationDelta.boxDelta(borderRadius: Radii.sheet, boxShadow: [])),
    child: Padding(
      padding: EdgeInsets.fromLTRB(Insets.page, Insets.sm, Insets.page, Insets.page + MediaQuery.paddingOf(ctx).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Center(child: SizedBox(width: 36, child: FDivider(style: FDividerStyleDelta.delta(width: 4)))),
        const SizedBox(height: Insets.lg),
        if (title != null) ...[Text(title, style: ctx.text.titleLarge), const SizedBox(height: Insets.lg)],
        child,
      ]),
    ),
  )),
);

/// Feuille de saisie : Forui ferme la feuille par un Navigator.pop direct, hors de portée d'un PopScope.
/// On la rouvre donc avec le texte déjà tapé tant que l'abandon n'est pas confirmé.
Future<T?> askSheet<T>(BuildContext context, {required String title, required Widget child, required bool Function() dirty}) async {
  while (true) {
    final r = await showAppSheet<T>(context, title: title, child: child);
    if (r != null || !context.mounted || !dirty()) return r;
    final leave = await confirm(context, title: 'Abandonner la saisie ?', action: 'Abandonner', danger: true);
    if (leave || !context.mounted) return null;
  }
}

/// Quitter un formulaire : une saisie modifiée n'est jamais perdue sans un accord explicite.
Future<void> leaveForm(BuildContext context, {required bool dirty}) async {
  if (dirty && !await confirm(context, title: 'Abandonner les modifications ?', message: 'Les informations saisies seront perdues.', action: 'Abandonner', danger: true)) return;
  if (context.mounted) Navigator.of(context).pop();
}

Future<bool> confirm(BuildContext context, {required String title, String? message, String action = 'Confirmer', bool danger = false}) async {
  final r = await showAppSheet<bool>(context, title: title, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    if (message != null) ...[Text(message, style: context.text.bodyLarge!.copyWith(color: context.tones.inkSecondary)), const SizedBox(height: Insets.xl)],
    AppButton(action, variant: danger ? AppButtonVariant.danger : AppButtonVariant.primary, onPressed: () => popSheet(context, true)),
    const SizedBox(height: Insets.sm),
    AppButton('Annuler', variant: AppButtonVariant.ghost, onPressed: () => popSheet(context, false)),
  ]));
  return r ?? false;
}

/// Choix explicite appareil/galerie, puis la prise de vue. Une source indisponible ne remonte jamais brute.
Future<XFile?> pickPhoto(BuildContext context, {String title = 'Ajouter une photo'}) async {
  final source = await showAppSheet<ImageSource>(context, title: title, child: Column(mainAxisSize: MainAxisSize.min, children: [
    AppRow(leading: const Icon(FIcons.camera), title: 'Prendre une photo', onTap: () => popSheet(context, ImageSource.camera)),
    AppRow(leading: const Icon(FIcons.image), title: 'Choisir dans la galerie', onTap: () => popSheet(context, ImageSource.gallery)),
  ]));
  if (source == null) return null;
  try {
    return await ImagePicker().pickImage(source: source, maxWidth: 1600, imageQuality: 85);
  } on PlatformException {
    if (context.mounted) toast(context, source == ImageSource.camera ? 'Appareil photo indisponible.' : 'Galerie indisponible.');
    return null;
  }
}

/// Sélecteur dessiné : jamais de DropdownButton.
Future<T?> pick<T>(BuildContext context, {required String title, required List<T> options, required String Function(T) label, T? selected}) =>
    showAppSheet<T>(context, title: title, child: FSelectTileGroup<T>(
      maxHeight: MediaQuery.sizeOf(context).height * .6,
      control: FMultiValueControl.managedRadio(initial: selected, onChange: (v) => popSheet(context, v.firstOrNull)),
      children: [for (final o in options) FSelectTile.suffix(title: Text(label(o)), value: o)],
    ));

/// Calendrier dessiné : jamais de showDatePicker.
Future<DateTime?> showDatePickerSheet(BuildContext context, {DateTime? initial}) => showAppSheet<DateTime>(
  context, title: 'Choisir une date',
  child: FCalendar(
    control: FCalendarControl.managedDate(initial: initial),
    today: DateTime.now(), initialMonth: initial,
    onPress: (d) => popSheet(context, DateTime(d.year, d.month, d.day)),
  ),
);

void toast(BuildContext context, String message) => showFToast(
  context: context, alignment: FToastAlignment.topCenter,
  title: Semantics(liveRegion: true, child: Text(message)), duration: const Duration(seconds: 3),
);

class AppNavItem {
  const AppNavItem(this.label, this.icon, this.activeIcon, {this.badge = 0});
  final String label;
  final IconData icon, activeIcon;
  final int badge;
  AppNavItem withBadge(int n) => AppNavItem(label, icon, activeIcon, badge: n);
}

class _NavIcon extends StatelessWidget {
  const _NavIcon(this.item, {required this.active});
  final AppNavItem item;
  final bool active;
  @override
  Widget build(BuildContext context) {
    final icon = Icon(active ? item.activeIcon : item.icon);
    if (item.badge <= 0) return icon;
    return Stack(clipBehavior: Clip.none, children: [
      icon,
      Positioned(top: -5, right: -9, child: Semantics(
        label: '${item.badge} en attente', excludeSemantics: true,
        child: DecoratedBox(
          decoration: BoxDecoration(color: context.colors.primary, borderRadius: Radii.full, border: Border.all(color: context.colors.surface, width: 1.5)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            child: Text(item.badge > 9 ? '9+' : '${item.badge}', style: context.text.bodySmall!.copyWith(color: context.colors.onPrimary, fontSize: 10, fontWeight: FontWeight.w700, height: 1.4)),
          ),
        ),
      )),
    ]);
  }
}

class AppNavBar extends StatelessWidget {
  const AppNavBar({super.key, required this.items, required this.index, required this.onTap});
  final List<AppNavItem> items;
  final int index;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final bg = context.theme.scaffoldBackgroundColor;
    return DecoratedBox(
      decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [bg.withValues(alpha: 0), bg])),
      child: Padding(
        padding: EdgeInsets.fromLTRB(Insets.page, Insets.xl, Insets.page, MediaQuery.viewPaddingOf(context).bottom + Insets.sm),
        child: MediaQuery.removeViewPadding(context: context, removeBottom: true, child: FBottomNavigationBar(index: index, onChange: onTap, children: [
          for (var i = 0; i < items.length; i++)
            FBottomNavigationBarItem(icon: _NavIcon(items[i], active: i == index), label: FittedBox(fit: BoxFit.scaleDown, child: Text(items[i].label, maxLines: 1, softWrap: false))),
        ])),
      ),
    );
  }
}

String relativeDue(DateTime d) {
  final days = daysUntil(d);
  if (days < -1) return 'En retard de ${-days} jours';
  if (days == -1) return 'En retard d\'un jour';
  if (days == 0) return 'Aujourd\'hui';
  if (days == 1) return 'Demain';
  if (days < 7) return 'Dans $days jours';
  return DateFormat('d MMM', 'fr').format(d);
}
