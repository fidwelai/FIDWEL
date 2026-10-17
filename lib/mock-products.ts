export type MockProduct = {
  id: string;
  name: string;
  vendor: string;
  price: number;
  category: string;
  image: string;
  description: string;
};

export const MOCK_PRODUCTS: MockProduct[] = [
  { id: "1", name: "Fresh Plantain Bunch", vendor: "Mama Gold Farm", price: 2500, category: "Plantain", image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", description: "Fresh plantain bunch" },
  { id: "2", name: "Catfish (Live)", vendor: "Fish Hub", price: 3500, category: "Fish", image: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400", description: "Live catfish" },
  { id: "3", name: "White Yam Tubers", vendor: "Yam Barn", price: 1800, category: "Yam", image: "https://images.unsplash.com/photo-1596097156937-968d8e95c8e6?w=400", description: "White yam" },
  { id: "4", name: "Fresh Cassava", vendor: "Root Farms", price: 1200, category: "Cassava", image: "https://images.unsplash.com/photo-1543528173-d4dccdbf2e8c?w=400", description: "Fresh cassava" },
  { id: "5", name: "Ugwu Leaves", vendor: "Green Farms", price: 500, category: "Vegetables", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400", description: "Ugwu leaves" },
  { id: "6", name: "Palm Oil 5L", vendor: "Oil Mill", price: 8000, category: "More", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", description: "Palm oil" },
];

export function findMockProduct(id: string | undefined): MockProduct | null {
  return MOCK_PRODUCTS.find((product) => product.id === id) ?? null;
}
