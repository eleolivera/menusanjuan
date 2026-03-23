export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  cuisineType: string;
  logoUrl: string | null;
  coverUrl: string;
  rating: number;
  itemCount: number;
  priceRange: string;
  isOpen: boolean;
};

export const CUISINE_TYPES = [
  { label: "Todos", value: "all", emoji: "🍽️" },
  { label: "Comida Rápida", value: "Comida Rápida", emoji: "🍔" },
  { label: "Parrilla", value: "Parrilla", emoji: "🥩" },
  { label: "Pizzería", value: "Pizzería", emoji: "🍕" },
  { label: "Cafetería", value: "Cafetería", emoji: "☕" },
  { label: "Pastas", value: "Pastas", emoji: "🍝" },
  { label: "Sushi", value: "Sushi", emoji: "🍣" },
  { label: "Heladería", value: "Heladería", emoji: "🍦" },
  { label: "Empanadas", value: "Empanadas", emoji: "🥟" },
];

// Demo data — will be replaced by Prisma queries once DB is connected
export const DEMO_RESTAURANTS: Restaurant[] = [
  {
    id: "1",
    name: "Puerto Pachatas",
    slug: "puerto-pachatas",
    description:
      "Los mejores lomitos y pachatas de San Juan. Carne a la parrilla, piadinas y más.",
    phone: "+5492645745818",
    address: "Av. Libertador 1200, Capital",
    cuisineType: "Comida Rápida",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop",
    rating: 4.8,
    itemCount: 24,
    priceRange: "$$$",
    isOpen: true,
  },
  {
    id: "2",
    name: "La Estancia",
    slug: "la-estancia",
    description:
      "Parrilla tradicional argentina. Asado, vacío, entraña y los mejores cortes al carbón.",
    phone: "+5492644123456",
    address: "Calle Mendoza 450, Rivadavia",
    cuisineType: "Parrilla",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop",
    rating: 4.6,
    itemCount: 18,
    priceRange: "$$$$",
    isOpen: true,
  },
  {
    id: "3",
    name: "Napoli Pizza",
    slug: "napoli-pizza",
    description:
      "Pizza artesanal al horno de leña. Masa madre, ingredientes frescos y sabor italiano.",
    phone: "+5492644789012",
    address: "Av. San Martín 890, Capital",
    cuisineType: "Pizzería",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=400&fit=crop",
    rating: 4.7,
    itemCount: 32,
    priceRange: "$$$",
    isOpen: true,
  },
  {
    id: "4",
    name: "Café del Centro",
    slug: "cafe-del-centro",
    description:
      "Café de especialidad, medialunas artesanales, desayunos y meriendas en el corazón de San Juan.",
    phone: "+5492644567890",
    address: "Peatonal Tucumán 123, Capital",
    cuisineType: "Cafetería",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=400&fit=crop",
    rating: 4.5,
    itemCount: 28,
    priceRange: "$$",
    isOpen: false,
  },
  {
    id: "5",
    name: "Sushi San Juan",
    slug: "sushi-san-juan",
    description:
      "Rolls, nigiris y combinados. Fusión japonesa-argentina con los sabores más frescos.",
    phone: "+5492644345678",
    address: "Calle Aberastain 600, Capital",
    cuisineType: "Sushi",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=400&fit=crop",
    rating: 4.4,
    itemCount: 40,
    priceRange: "$$$$",
    isOpen: true,
  },
  {
    id: "6",
    name: "Don Raúl Empanadas",
    slug: "don-raul-empanadas",
    description:
      "Empanadas sanjuaninas de horno de barro. Carne, pollo, jamón y queso, y más variedades.",
    phone: "+5492644234567",
    address: "Av. Rawson 1500, Rawson",
    cuisineType: "Empanadas",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=400&fit=crop",
    rating: 4.9,
    itemCount: 15,
    priceRange: "$$",
    isOpen: true,
  },
  {
    id: "7",
    name: "Mamma Pasta",
    slug: "mamma-pasta",
    description:
      "Pastas caseras: ravioles, ñoquis, tallarines y lasagna con salsas artesanales.",
    phone: "+5492644876543",
    address: "Calle España 320, Chimbas",
    cuisineType: "Pastas",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=400&fit=crop",
    rating: 4.3,
    itemCount: 22,
    priceRange: "$$$",
    isOpen: true,
  },
  {
    id: "8",
    name: "Helados del Sol",
    slug: "helados-del-sol",
    description:
      "Helado artesanal con ingredientes naturales. Más de 30 sabores únicos de San Juan.",
    phone: "+5492644654321",
    address: "Av. Ignacio de la Roza 800, Capital",
    cuisineType: "Heladería",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=800&h=400&fit=crop",
    rating: 4.7,
    itemCount: 35,
    priceRange: "$$",
    isOpen: true,
  },
  {
    id: "9",
    name: "El Fogón Criollo",
    slug: "el-fogon-criollo",
    description:
      "Comida criolla de San Juan. Locro, carbonada, humita y los platos más tradicionales.",
    phone: "+5492644111222",
    address: "Ruta 40 km 5, Pocito",
    cuisineType: "Parrilla",
    logoUrl: null,
    coverUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop",
    rating: 4.6,
    itemCount: 20,
    priceRange: "$$$",
    isOpen: true,
  },
];
