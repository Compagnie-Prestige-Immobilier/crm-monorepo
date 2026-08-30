const supportPhone = '+221770000000';

const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.lic.gnawalma';

/// Page publique d'un atelier, servie par l'API ; ouvre l'app si elle est installée.
String atelierLink(int id) => 'https://gnawalma-api.onrender.com/a/$id';

const termsText = 'Gnawalma met en relation des clients et des ateliers de couture. '
    'En l\'utilisant, vous vous engagez à fournir des informations exactes et à respecter les autres utilisateurs. '
    'Les commandes, mesures et paiements échangés via l\'application relèvent de l\'accord direct entre le client et l\'atelier ; Gnawalma n\'intervient pas dans cette relation commerciale.';

const privacyText = 'Nous conservons votre nom, votre contact, et les informations nécessaires au fonctionnement de l\'application : '
    'favoris, activité et avis. Ces données ne sont pas revendues à des tiers. '
    'Vous pouvez à tout moment corriger vos informations ou supprimer définitivement votre compte depuis les réglages.';
