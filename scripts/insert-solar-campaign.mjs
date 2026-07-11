import mysql from 'mysql2/promise';

// La tabla banners en BD tiene: banner_type y banner_status (no type/status)
const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [result] = await conn.execute(`
    INSERT INTO banners (
      title, subtitle, description,
      imageUrl, imageUrlMobile,
      banner_type, linkUrl, linkType, linkTarget, ctaText,
      startDate, endDate,
      targetRoles, targetCities, targetSubscriptionTiers,
      priority, displayDurationMs, isClosable, showOnce,
      banner_status,
      impressions, clicks, uniqueViews,
      advertiserName, advertiserContact, campaignId,
      createdAt, updatedAt
    ) VALUES
    (
      'Potencia tu vida con energía solar',
      'GHP - Green House Project',
      'Reduce tu factura de energía hasta un 90% con sistemas solares fotovoltaicos para hogar y empresa. Instalación profesional en toda Colombia. Cotiza gratis hoy.',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-splash-Xm6ctqZBJZS2Po2FCFpnQn.png',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-banner-mobile-FScu233dtVQFz8TQEnVVKJ.png',
      'SPLASH', 'https://sales.ghp.center', 'EXTERNAL', '_blank', 'Cotiza Gratis',
      '2026-07-11 00:00:00', '2026-07-31 23:59:59',
      NULL, NULL, NULL,
      100, 6000, 1, 0,
      'ACTIVE',
      0, 0, 0,
      'GHP - Green House Project', 'sales.ghp.center', 'SOLAR-GHP-JULIO-2026',
      NOW(), NOW()
    ),
    (
      'Energía Solar para tu Hogar y Empresa',
      'Reduce tu factura hasta un 90%',
      'Sistemas solares fotovoltaicos con instalación profesional en toda Colombia. Energía limpia, ahorro garantizado y asesoría personalizada. ¡Cotiza gratis!',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-banner-desktop-HajBUfJrDZWNhAFGqaoG4X.png',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-banner-mobile-FScu233dtVQFz8TQEnVVKJ.png',
      'PROMOTIONAL', 'https://sales.ghp.center', 'EXTERNAL', '_blank', 'Cotiza Gratis',
      '2026-07-11 00:00:00', '2026-07-31 23:59:59',
      NULL, NULL, NULL,
      90, 5000, 1, 0,
      'ACTIVE',
      0, 0, 0,
      'GHP - Green House Project', 'sales.ghp.center', 'SOLAR-GHP-JULIO-2026',
      NOW(), NOW()
    ),
    (
      '¿Sabías que puedes cargar tu EV con energía solar?',
      'GHP instala paneles solares en tu hogar o empresa',
      'Combina tu vehículo eléctrico con energía solar y reduce tus costos de carga a casi cero. GHP diseña e instala sistemas solares personalizados para toda Colombia.',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-banner-desktop-HajBUfJrDZWNhAFGqaoG4X.png',
      'https://d2xsxph8kpxj0f.cloudfront.net/310519663169336317/UcUrociZeo4QVAHHN9vAuZ/solar-banner-mobile-FScu233dtVQFz8TQEnVVKJ.png',
      'CHARGING', 'https://sales.ghp.center', 'EXTERNAL', '_blank', 'Más información',
      '2026-07-11 00:00:00', '2026-07-31 23:59:59',
      NULL, NULL, NULL,
      80, 5000, 1, 0,
      'ACTIVE',
      0, 0, 0,
      'GHP - Green House Project', 'sales.ghp.center', 'SOLAR-GHP-JULIO-2026',
      NOW(), NOW()
    )
  `);
  console.log(`✅ Insertados ${result.affectedRows} banners. IDs insertados a partir de: ${result.insertId}`);

  // Verificar los banners insertados
  const [banners] = await conn.execute(
    `SELECT id, title, banner_type, banner_status, startDate, endDate, linkUrl, campaignId 
     FROM banners WHERE campaignId = 'SOLAR-GHP-JULIO-2026' ORDER BY id`
  );
  console.log('\n📋 Banners de la campaña SOLAR-GHP-JULIO-2026:');
  banners.forEach(b => {
    console.log(`  [${b.id}] ${b.banner_type} | ${b.banner_status} | "${b.title.substring(0, 40)}..." → ${b.linkUrl}`);
  });
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await conn.end();
}
