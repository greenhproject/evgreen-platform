-- Las plantillas DOCX completas pueden exceder 65.535 bytes al convertirse a HTML.
-- Se amplía de forma no destructiva la capacidad de almacenamiento del expediente.
ALTER TABLE `contract_templates`
  MODIFY COLUMN `html_content` LONGTEXT NOT NULL;

ALTER TABLE `site_contracts`
  MODIFY COLUMN `contract_html` LONGTEXT NOT NULL;
