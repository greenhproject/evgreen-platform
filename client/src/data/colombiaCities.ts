/**
 * Departamentos y ciudades principales de Colombia
 * Usado para selects cascading en formularios
 */
export const COLOMBIA_DEPARTMENTS: Record<string, string[]> = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Sabaneta", "Rionegro", "Apartadó", "Turbo", "Caucasia", "La Ceja", "Marinilla", "El Carmen de Viboral", "Copacabana", "Girardota", "Barbosa", "Caldas"],
  "Arauca": ["Arauca", "Saravena", "Tame", "Fortul"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Baranoa", "Puerto Colombia", "Galapa"],
  "Bogotá D.C.": ["Bogotá"],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "Arjona", "Carmen de Bolívar", "San Juan Nepomuceno"],
  "Boyacá": ["Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Paipa", "Villa de Leyva", "Puerto Boyacá"],
  "Caldas": ["Manizales", "Villamaría", "La Dorada", "Chinchiná", "Anserma"],
  "Caquetá": ["Florencia", "San Vicente del Caguán", "Puerto Rico"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva", "Tauramena", "Paz de Ariporo"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada", "Piendamó", "El Bordo"],
  "Cesar": ["Valledupar", "Aguachica", "Codazzi", "Bosconia", "La Jagua de Ibirico"],
  "Chocó": ["Quibdó", "Istmina", "Tadó", "Condoto"],
  "Córdoba": ["Montería", "Cereté", "Lorica", "Sahagún", "Planeta Rica", "Montelíbano"],
  "Cundinamarca": ["Soacha", "Zipaquirá", "Facatativá", "Chía", "Mosquera", "Fusagasugá", "Girardot", "Madrid", "Funza", "Cajicá", "Cota", "La Calera", "Sibaté", "Tocancipá", "Sopó", "Tabio", "Tenjo", "Villeta", "La Mesa"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Manaure", "San Juan del Cesar"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco", "Plato"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López", "San Martín", "Restrepo"],
  "Nariño": ["Pasto", "Tumaco", "Ipiales", "Túquerres", "La Unión"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Pamplona", "Los Patios", "Villa del Rosario"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Orito", "Valle del Guamuez"],
  "Quindío": ["Armenia", "Calarcá", "Montenegro", "La Tebaida", "Circasia", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil", "Socorro"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos", "Tolú", "Sampués"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Honda", "Mariquita", "Chaparral", "Líbano"],
  "Valle del Cauca": ["Cali", "Buenaventura", "Palmira", "Tuluá", "Buga", "Cartago", "Yumbo", "Jamundí", "Candelaria", "Florida"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño"],
};

export const DEPARTMENT_NAMES = Object.keys(COLOMBIA_DEPARTMENTS).sort();
