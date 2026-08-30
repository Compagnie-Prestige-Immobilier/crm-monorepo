import 'package:flutter/material.dart';

/// Motion tokens.
///
/// The app previously animated everything with `easeOutCubic` at 220ms, which
/// is Flutter's house style and reads as nothing at all. Motion here is
/// deliberately asymmetric: things enter with a slight overshoot and leave
/// faster than they arrive, which is how physical objects behave and how every
/// app in the reference set moves.
class AppMotion {
  AppMotion._();

  // ===== Durations =====
  // Kept inside the 150–300ms band for anything the user triggers directly.
  // Only full-screen transitions are allowed past that.

  /// Tap feedback, colour and opacity shifts.
  static const Duration instant = Duration(milliseconds: 120);

  /// Default for state changes the user caused: selection, toggle, expand.
  static const Duration quick = Duration(milliseconds: 200);

  /// Content arriving: sheets, cards, list items.
  static const Duration standard = Duration(milliseconds: 280);

  /// Full-screen and shared-element transitions.
  static const Duration slow = Duration(milliseconds: 420);

  /// Exits run at ~70% of the matching entrance. Waiting for something to leave
  /// is dead time; waiting for something to arrive is anticipation.
  static const Duration exit = Duration(milliseconds: 160);

  /// One sweep of a loading placeholder.
  ///
  /// The only duration in this file that belongs to a *repeating* animation.
  /// Deliberately slow: a fast shimmer reads as a fault rather than as waiting,
  /// and it is the one thing on screen while the reader has nothing to do.
  /// Repeating motion is otherwise forbidden on a daily work tool
  /// (`knowledge-base/DESIGN.md`), so nothing else should use this.
  static const Duration shimmer = Duration(milliseconds: 1050);

  // ===== Curves =====

  /// Entrances. Decelerates hard and settles just past its target.
  static const Curve enter = Curves.easeOutCubic;

  /// The signature curve. A restrained overshoot used on the things the user
  /// acts on directly — nav selection, primary buttons, chip selection. Applied
  /// sparingly; on every element it reads as bounce, on three it reads as
  /// craft.
  static const Curve spring = Curves.easeOutBack;

  /// Exits. Accelerates away, no overshoot.
  static const Curve leave = Curves.easeInCubic;

  /// Two-sided moves that both start and end on screen.
  static const Curve move = Curves.easeInOutCubicEmphasized;

  // ===== Staggering =====

  /// Delay between consecutive items in an entering list.
  ///
  /// Held deliberately short: at 60ms+ a ten-row list takes over half a second
  /// to finish arriving, which feels like the app is slow rather than alive.
  static const Duration stagger = Duration(milliseconds: 38);

  /// Stagger caps out after this many items — beyond it the delay is constant,
  /// so row 40 of a long list does not arrive a second and a half late.
  static const int staggerCap = 8;

  static Duration staggerFor(int index) =>
      stagger * (index.clamp(0, staggerCap));

  /// Whether motion should be suppressed for this context.
  ///
  /// Every animated widget in the app routes through this rather than reading
  /// the MediaQuery flag directly, so honouring the OS setting can never be
  /// forgotten in one place.
  static bool reduced(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context);

  /// Duration that collapses to zero when the user has asked for reduced
  /// motion. State still changes; it just changes instantly.
  static Duration duration(BuildContext context, Duration value) =>
      reduced(context) ? Duration.zero : value;

  /// Curves with overshoot can cause motion sickness, so they degrade to linear
  /// rather than being kept at a shorter duration.
  static Curve curve(BuildContext context, Curve value) =>
      reduced(context) ? Curves.linear : value;
}
