/**
 * Curated cookbook collection definitions.
 * Each collection filters recipes by keyword matches on ingredient_lines and recipe_label.
 */

export type CollectionSlug =
  | "chicken"
  | "beef"
  | "fish"
  | "pork"
  | "turkey"
  | "seafood"
  | "eggs"
  | "lamb"
  | "high-protein"
  | "low-carb"
  | "vegetarian"
  | "vegan"
  | "salads"
  | "soups"
  | "pasta"
  | "rice"
  | "desserts"
  | "breakfast"
  | "mediterranean"
  | "asian"
  | "italian"
  | "mexican"
  | "indian"
  | "pizza"
  | "tacos"
  | "grilled";

export type CollectionConfig = {
  slug: CollectionSlug;
  displayName: string;
  /** Keywords to match (OR) - recipe matches if any keyword found in ingredient_lines or recipe_label */
  includeKeywords: string[];
  /** For low-carb: exclude recipes matching any of these (OR) */
  excludeKeywords?: string[];
};

export const COLLECTIONS: CollectionConfig[] = [
  { slug: "chicken", displayName: "Chicken", includeKeywords: ["chicken"] },
  { slug: "beef", displayName: "Beef", includeKeywords: ["beef"] },
  {
    slug: "fish",
    displayName: "Fish",
    includeKeywords: ["fish", "salmon", "tuna", "cod"],
  },
  {
    slug: "pork",
    displayName: "Pork",
    includeKeywords: ["pork", "bacon", "ham", "prosciutto"],
  },
  { slug: "turkey", displayName: "Turkey", includeKeywords: ["turkey"] },
  {
    slug: "seafood",
    displayName: "Seafood",
    includeKeywords: ["shrimp", "crab", "lobster", "scallop", "mussel", "clam"],
  },
  { slug: "eggs", displayName: "Eggs", includeKeywords: ["egg"] },
  { slug: "lamb", displayName: "Lamb", includeKeywords: ["lamb"] },
  {
    slug: "high-protein",
    displayName: "High Protein",
    includeKeywords: [
      "chicken",
      "beef",
      "fish",
      "egg",
      "tofu",
      "turkey",
      "pork",
      "shrimp",
      "salmon",
    ],
  },
  {
    slug: "low-carb",
    displayName: "Low Carb",
    includeKeywords: [
      "chicken",
      "beef",
      "fish",
      "egg",
      "tofu",
      "leafy",
      "spinach",
      "lettuce",
      "broccoli",
    ],
    excludeKeywords: ["pasta", "rice", "bread", "potato", "flour"],
  },
  {
    slug: "vegetarian",
    displayName: "Vegetarian",
    includeKeywords: ["vegetarian", "veggie"],
  },
  { slug: "vegan", displayName: "Vegan", includeKeywords: ["vegan"] },
  { slug: "salads", displayName: "Salads", includeKeywords: ["salad"] },
  { slug: "soups", displayName: "Soups", includeKeywords: ["soup"] },
  {
    slug: "pasta",
    displayName: "Pasta",
    includeKeywords: ["pasta", "spaghetti", "penne", "noodle"],
  },
  { slug: "rice", displayName: "Rice", includeKeywords: ["rice", "risotto"] },
  {
    slug: "desserts",
    displayName: "Desserts",
    includeKeywords: [
      "dessert",
      "cake",
      "cookie",
      "brownie",
      "pie",
      "chocolate",
    ],
  },
  {
    slug: "breakfast",
    displayName: "Breakfast",
    includeKeywords: ["breakfast", "pancake", "waffle", "oatmeal"],
  },
  {
    slug: "mediterranean",
    displayName: "Mediterranean",
    includeKeywords: ["olive oil", "feta", "hummus", "tahini", "chickpea"],
  },
  {
    slug: "asian",
    displayName: "Asian",
    includeKeywords: [
      "soy sauce",
      "ginger",
      "sesame",
      "rice vinegar",
      "teriyaki",
    ],
  },
  {
    slug: "italian",
    displayName: "Italian",
    includeKeywords: ["pasta", "parmesan", "basil", "mozzarella", "balsamic", "marinara"],
  },
  {
    slug: "mexican",
    displayName: "Mexican",
    includeKeywords: [
      "tortilla",
      "salsa",
      "cilantro",
      "cumin",
      "chipotle",
      "avocado",
      "guacamole",
    ],
  },
  {
    slug: "indian",
    displayName: "Indian",
    includeKeywords: ["curry", "turmeric", "garam masala", "coconut milk", "lentils"],
  },
  { slug: "pizza", displayName: "Pizza", includeKeywords: ["pizza"] },
  { slug: "tacos", displayName: "Tacos", includeKeywords: ["taco"] },
  {
    slug: "grilled",
    displayName: "Grilled",
    includeKeywords: ["grilled", "grill", "barbecue", "bbq"],
  },
];

export function getCollectionBySlug(slug: string): CollectionConfig | null {
  return COLLECTIONS.find((c) => c.slug === slug) ?? null;
}

export function getAllCollectionSlugs(): CollectionSlug[] {
  return COLLECTIONS.map((c) => c.slug);
}
