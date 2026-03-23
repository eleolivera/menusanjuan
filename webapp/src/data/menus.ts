export type MenuItemData = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  badge?: string;
  rating?: number;
  available: boolean;
};

export type MenuCategoryData = {
  id: string;
  name: string;
  emoji: string;
  items: MenuItemData[];
};

// Demo menu for Puerto Pachatas — will be replaced by DB queries
export const DEMO_MENUS: Record<string, MenuCategoryData[]> = {
  "puerto-pachatas": [
    {
      id: "cat-1",
      name: "Lomitos Tradicionales",
      emoji: "🥖",
      items: [
        {
          id: "item-1",
          name: "Lomito Completo",
          description: "Lomo, jamón, queso, huevo, lechuga, tomate y papas fritas.",
          price: 5500,
          imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
          badge: "Popular",
          rating: 4.9,
          available: true,
        },
        {
          id: "item-2",
          name: "Lomito Simple",
          description: "Lomo a la plancha con lechuga, tomate y mayonesa.",
          price: 4200,
          imageUrl: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
          available: true,
        },
        {
          id: "item-3",
          name: "Lomito Especial de la Casa",
          description: "Lomo, panceta crocante, cheddar, cebolla caramelizada y salsa BBQ.",
          price: 6800,
          imageUrl: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=400&h=300&fit=crop",
          badge: "Especial",
          rating: 4.8,
          available: true,
        },
      ],
    },
    {
      id: "cat-2",
      name: "Pachatas Especiales",
      emoji: "🥪",
      items: [
        {
          id: "item-4",
          name: "Pachata Clásica",
          description: "Carne de lomo a la parrilla con jamón, queso y verduras frescas.",
          price: 4500,
          imageUrl: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&h=300&fit=crop",
          badge: "Popular",
          rating: 4.8,
          available: true,
        },
        {
          id: "item-5",
          name: "Pachata Criolla",
          description: "Carne, chimichurri, provoleta derretida y cebolla grillada.",
          price: 5200,
          imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop",
          available: true,
        },
      ],
    },
    {
      id: "cat-3",
      name: "Hamburguesas",
      emoji: "🍔",
      items: [
        {
          id: "item-6",
          name: "Hamburguesa Clásica",
          description: "Medallón 200g, cheddar, lechuga, tomate, cebolla y pepino.",
          price: 4800,
          imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
          available: true,
        },
        {
          id: "item-7",
          name: "Doble Smash Burger",
          description: "Doble medallón smash, doble cheddar, cebolla crispy y salsa especial.",
          price: 6200,
          imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=300&fit=crop",
          badge: "Nuevo",
          available: true,
        },
      ],
    },
    {
      id: "cat-4",
      name: "Acompañamientos",
      emoji: "🍟",
      items: [
        {
          id: "item-8",
          name: "Papas Fritas",
          description: "Porción grande de papas fritas crocantes.",
          price: 2200,
          imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
          available: true,
        },
        {
          id: "item-9",
          name: "Aros de Cebolla",
          description: "Aros de cebolla rebozados y fritos. Crujientes.",
          price: 2500,
          imageUrl: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop",
          available: true,
        },
      ],
    },
    {
      id: "cat-5",
      name: "Bebidas",
      emoji: "🥤",
      items: [
        {
          id: "item-10",
          name: "Coca-Cola 500ml",
          description: "Coca-Cola línea completa.",
          price: 1200,
          imageUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=300&fit=crop",
          available: true,
        },
        {
          id: "item-11",
          name: "Agua Mineral 500ml",
          description: "Agua mineral con o sin gas.",
          price: 800,
          imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=300&fit=crop",
          available: true,
        },
        {
          id: "item-12",
          name: "Cerveza Artesanal 500ml",
          description: "Cerveza artesanal sanjuanina. Consultá variedades disponibles.",
          price: 2800,
          imageUrl: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop",
          available: true,
        },
      ],
    },
  ],
};

// Generate menus for other demo restaurants (simpler)
function generateSimpleMenu(slug: string): MenuCategoryData[] {
  return DEMO_MENUS["puerto-pachatas"] || [];
}

export function getMenuForRestaurant(slug: string): MenuCategoryData[] {
  return DEMO_MENUS[slug] || generateSimpleMenu(slug);
}
