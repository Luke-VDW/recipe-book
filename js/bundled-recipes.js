/* ══════════════════════════════════════
   bundled-recipes.js — Ready-to-import recipes
   Added via Settings → "Add bundled recipes"; they then reach Google Drive
   through the normal sync. Skipped if already present or previously deleted.
   ══════════════════════════════════════ */

const BUNDLED_RECIPES = [
  {
    id: 'rb_apple_crumble',
    name: 'Apple Crumble',
    category: 'Dessert',
    servings: 8,
    prepMins: 15,
    cookMins: 40,
    ingredients: '1 kg granny smith apples; 1 tbsp flour; 100 g white sugar; 2 tbsp lemon juice; 0.5 tsp cinnamon; 90 g rolled oats; 125 g flour; 200 g brown sugar; 0.5 tsp baking powder; 1 tsp cinnamon; 125 g butter; 1 pinch salt',
    method: '1. Preheat oven to 180°C (fan or standard).\n' +
      '2. Peel and cut the apples into 1.5 cm cubes.\n' +
      '3. Toss the apples with 1 tbsp flour, the white sugar, 1/2 tsp cinnamon and the lemon juice, then spread into a 1.5 litre baking dish.\n' +
      '4. Mix the oats, 125 g flour, brown sugar, baking powder, 1 tsp cinnamon, salt and melted butter until it clumps like wet sand.\n' +
      '5. Spread the topping over the apples, crumbling it with your fingers.\n' +
      '6. Bake 30–40 minutes until golden brown.\n' +
      '7. Cover loosely with foil and rest 10 minutes before serving.\n' +
      '8. Serve warm.',
    tags: 'Dessert, Baking, Comfort',
    source: 'https://www.recipetineats.com/apple-crumble/',
    savedDate: '2026-07-16',
    kcalTotal: 3024,
    optionalIngredients: [
      { qty: 100, unit: 'g', name: 'vanilla ice cream', kcal: 207 },
    ],
  },
  {
    id: 'rb_cinnamon_swirls',
    name: 'Cinnamon Puff Pastry Swirls',
    category: 'Dessert',
    servings: 16,
    prepMins: 10,
    cookMins: 18,
    ingredients: '375 g puff pastry; 50 g butter; 2 tbsp cinnamon; 4 tbsp brown sugar; 1 egg',
    method: '1. Take the pastry out of the fridge about 20 minutes ahead. Preheat oven to 200°C (180°C fan).\n' +
      '2. Line baking sheets with parchment paper.\n' +
      '3. Unroll the pastry sheet.\n' +
      '4. Melt the butter and brush it evenly over the pastry.\n' +
      '5. Mix the cinnamon and brown sugar, then sprinkle over the pastry.\n' +
      '6. Roll the pastry up from the long side and set it seam-side down.\n' +
      '7. Slice carefully with a sharp knife and space the pieces out on the trays — they spread while baking.\n' +
      '8. Beat the egg and brush it over the slices.\n' +
      '9. Bake 15–18 minutes until golden.\n' +
      '10. Serve warm.',
    tags: 'Baking, Quick, Snack',
    source: 'https://www.sewwhite.com/cinnamon-puff-pastry-swirls/',
    savedDate: '2026-07-16',
    kcalTotal: 2752,
    optionalIngredients: [
      { qty: 1, unit: 'tbsp', name: 'icing sugar', kcal: 31 },
    ],
  },
  {
    id: 'rb_banana_bread',
    name: "JB's Banana Bread",
    category: 'Breakfast',
    servings: 10,
    prepMins: 20,
    cookMins: 70,
    ingredients: '280 g flour; 5 g baking soda; 2.5 g salt; 6.25 g cinnamon; 1.25 g allspice; 400 g banana; 220 g brown sugar; 2 item eggs; 1 item egg yolk; 80 ml sour cream; 80 g butter; 80 ml vegetable oil; 12.5 ml vanilla extract',
    method: '1. Preheat oven to 180°C (160°C fan) with the rack in the middle.\n' +
      '2. Scrunch baking paper and fit it into a 21.5 × 11.5 × 7 cm loaf pan, leaving an overhang at the sides.\n' +
      '3. Whisk the flour, baking soda, salt, cinnamon and allspice together in a bowl.\n' +
      '4. Mash the bananas with a potato masher until mostly smooth — you want about 440 ml.\n' +
      '5. Add the brown sugar, whole eggs, yolk, sour cream, melted butter, oil and vanilla to the banana and whisk until combined.\n' +
      '6. Pour the dry mixture into the wet and fold with a spatula until the flour is just incorporated — lumps are fine.\n' +
      '7. Pour the batter into the pan and smooth the surface.\n' +
      '8. Bake 70 minutes, turning the pan halfway, until a skewer inserted in the centre comes out clean.\n' +
      '9. Cool in the pan 10 minutes, then transfer to a wire rack.\n' +
      '10. Cool at least 1 hour before slicing.',
    tags: 'Baking, Breakfast, Snack',
    source: 'https://www.recipetineats.com/banana-bread-recipe/',
    savedDate: '2026-07-16',
    kcalTotal: 3280,
    optionalIngredients: [
      { qty: 150, unit: 'g', name: 'chocolate chips', kcal: 800 },
      { qty: 100, unit: 'g', name: 'walnuts', kcal: 654 },
    ],
  },
];
