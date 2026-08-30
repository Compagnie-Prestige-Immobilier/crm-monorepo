import 'package:get_it/get_it.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../models/pattern_model.dart';
import '../repositories/pattern_repository.dart';

part 'template_service.g.dart';

@Riverpod(keepAlive: true)
Future<TemplateService> templateService(Ref ref) async {
  final patternRepo = await ref.watch(patternRepositoryProvider.future);
  return TemplateService(patternRepo);
}

/// Represents a predefined outfit template for quick project creation
class OutfitTemplate {
  final String id;
  final String name;
  final String category; // 'Homme', 'Femme', 'Enfant'
  final double defaultPrice;
  final List<String> requiredMeasurements;
  final String iconAsset; // Placeholder for icon path

  const OutfitTemplate({
    required this.id,
    required this.name,
    required this.category,
    required this.defaultPrice,
    required this.requiredMeasurements,
    this.iconAsset = 'assets/icons/tshirt.png',
  });
}

class TemplateService {
  // Singleton pattern for easy access
  static TemplateService get to => GetIt.I<TemplateService>();

  PatternRepository? _patternRepo;
  final List<OutfitTemplate> _dynamicTemplates = [];

  TemplateService([PatternRepository? patternRepo]) {
    // Try to find repository if registered
    try {
      _patternRepo = patternRepo ?? GetIt.I<PatternRepository>();
      _loadCustomPatterns();
    } catch (_) {
      // Repository not registered yet, skip loading custom patterns
    }
  }

  void _loadCustomPatterns() {
    if (_patternRepo == null) return;

    _patternRepo!.watchPatterns().listen((patterns) {
      _dynamicTemplates.clear();
      _dynamicTemplates.addAll(patterns.map((p) => _mapPatternToTemplate(p)));
    });
  }

  OutfitTemplate _mapPatternToTemplate(PatternModel pattern) {
    // Map Difficulty/Category to price or other logic if needed?
    // For now we just use defaults or if PatternModel had price
    // Since PatternModel doesn't have price, we use a default based on category
    double price = 10000;

    return OutfitTemplate(
      id: 'custom_${pattern.id}',
      name: pattern.name,
      category: pattern.categoryDisplay, // Use display string or enum mapping
      defaultPrice: price,
      requiredMeasurements:
          [], // PatternModel doesn't have measurements list yet
      iconAsset: 'assets/icons/tshirt.png', // Default
    );
  }

  final List<OutfitTemplate> _templates = [
    // Homme Templates
    OutfitTemplate(
      id: 'h_grand_boubou_3pcs',
      name: 'Grand Boubou 3 Pcs',
      category: 'Homme',
      defaultPrice: 25000,
      requiredMeasurements: [
        'Back Length',
        'Sleeve Length',
        'Neck',
        'Shoulder',
        'Pants Length',
        'Hip',
      ],
    ),
    OutfitTemplate(
      id: 'h_costume_africain',
      name: 'Costume Africain',
      category: 'Homme',
      defaultPrice: 15000,
      requiredMeasurements: [
        'Back Length',
        'Sleeve Length',
        'Neck',
        'Shoulder',
        'Chest',
        'Pants Length',
        'Waist',
      ],
    ),
    OutfitTemplate(
      id: 'h_kaftan',
      name: 'Kaftan / Tunique',
      category: 'Homme',
      defaultPrice: 10000,
      requiredMeasurements: [
        'Back Length',
        'Sleeve Length',
        'Neck',
        'Shoulder',
        'Chest',
      ],
    ),

    // Femme Templates
    OutfitTemplate(
      id: 'f_taille_basse',
      name: 'Taille Basse',
      category: 'Femme',
      defaultPrice: 20000,
      requiredMeasurements: [
        'Bust',
        'Waist',
        'Hip',
        'Skirt Length',
        'Sleeve Length',
        'Shoulder',
      ],
    ),
    OutfitTemplate(
      id: 'f_grand_boubou',
      name: 'Grand Boubou Dame',
      category: 'Femme',
      defaultPrice: 25000,
      requiredMeasurements: ['Total Height', 'Neck'],
    ),
    OutfitTemplate(
      id: 'f_robe_soiree',
      name: 'Robe de Soirée',
      category: 'Femme',
      defaultPrice: 35000,
      requiredMeasurements: [
        'Bust',
        'Waist',
        'Hip',
        'Total Height',
        'Shoulder',
        'Sleeve Length',
        'Back Length',
      ],
    ),

    // Default/Simple
    OutfitTemplate(
      id: 'simple_retouch',
      name: 'Simple Retouche',
      category: 'Autre',
      defaultPrice: 2000,
      requiredMeasurements: [],
      iconAsset: 'assets/icons/needle.png',
    ),
  ];

  List<OutfitTemplate> get allTemplates => [
    ..._templates,
    ..._dynamicTemplates,
  ];

  List<OutfitTemplate> getTemplatesByCategory(String category) {
    return allTemplates.where((t) => t.category == category).toList();
  }

  OutfitTemplate? getTemplateById(String id) {
    try {
      return allTemplates.firstWhere((t) => t.id == id);
    } catch (_) {
      return null;
    }
  }
}
