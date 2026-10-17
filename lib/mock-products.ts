export type MockProduct = {
  id: string;
  name: string;
  vendor: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  description: string;
};

export const MOCK_PRODUCTS: MockProduct[] = [
  { id: "1", name: "FreshCatch Farms", vendor: "FreshCatch Farms", price: 5900, unit: "kg", category: "Fish", image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=800", description: "Fresh catch sourced daily from local waters." },
  { id: "2", name: "Mama T's Agro", vendor: "Mama T's Agro", price: 4800, unit: "kg", category: "Farm Produce", image: "https://images.unsplash.com/photo-1543528173-d4dccdbf2e8c?w=800", description: "Quality farm produce from Mama T's Agro." },
  { id: "3", name: "Ocean Fresh", vendor: "Ocean Fresh", price: 5200, unit: "kg", category: "Seafood", image: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=800", description: "Fresh seafood delivered from the coast." },
  { id: "4", name: "Fresh Plantain Bunch", vendor: "Green Farms", price: 2500, unit: "kg", category: "Plantain", image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800", description: "Fresh ripe plantain bunch." },
  { id: "5", name: "Yam Barn", vendor: "Yam Barn", price: 1800, unit: "kg", category: "Yam", image: "https://images.unsplash.com/photo-1596097156937-968d8e95c8e6?w=800", description: "Fresh yam tubers straight from the barn." },
];

export function findMockProduct(id: string | undefined): MockProduct | null {
  return MOCK_PRODUCTS.find((product) => product.id === id) ?? null;
}
