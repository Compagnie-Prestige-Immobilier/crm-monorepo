import 'package:package_info_plus/package_info_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/services/security_service.dart';
import '../../../data/services/business_profile_service.dart';
import 'more_state.dart';

part 'more_provider.g.dart';

@riverpod
class More extends _$More {
  @override
  MoreState build() {
    Future.microtask(() => _loadData());
    return const MoreState();
  }

  Future<void> _loadData() async {
    state = state.copyWith(isLoading: true);
    try {
      final securityService = await ref.read(securityServiceProvider.future);
      final profileService = await ref.read(businessProfileProvider.future);

      final hasPin = securityService.hasPin;
      final profile = await profileService.getProfile();

      // Load app version
      String? appVersion;
      try {
        final packageInfo = await PackageInfo.fromPlatform();
        appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      } catch (e) {
        // Fallback to default if package_info fails
        appVersion = '1.0.0';
      }

      state = state.copyWith(
        isLoading: false,
        hasPin: hasPin,
        businessName: profile?.businessName,
        appVersion: appVersion,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> refresh() async {
    await _loadData();
  }
}
