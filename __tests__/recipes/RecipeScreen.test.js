import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RecipeScreen from '../../app/screens/RecipesScreen';
import { supabase } from '../../lib/supabase';
//adding the recipe reccs and random if its empty
import { getRandomRecipes, getRecipeRecommendations } from '../../lib/recommendations';

const mockRecipeData = [
  {
    id: 1,
    recipe_id: 1,
    title: 'Chicken Rice Bowl',
    description: 'A simple chicken and rice recipe.',
    instructions: '1. Cook rice. 2. Cook chicken. 3. Combine and serve.',
    image_url: null,
    match_percentage: 1,
    matched_ingredients: 2,
    total_ingredients: 2,
    missing_list: [
      {
        ingredient_name: 'rice',
        is_core: true,
      },
    ],
  },
  {
    id: 2,
    recipe_id: 2,
    title: 'Pasta Salad',
    description: 'A quick pasta salad.',
    instructions: '1. Cook pasta. 2. Mix ingredients.',
    image_url: null,
    match_percentage: 0.5,
    matched_ingredients: 1,
    total_ingredients: 2,
    missing_list: [],
  },
];

const mockLimit = jest.fn();
const mockEq = jest.fn();
const mockRecipesSelect = jest.fn(() => ({
  limit: mockLimit,
}));
const mockIngredientsSelect = jest.fn(() => ({
  eq: mockEq,
}));
const mockInsert = jest.fn();
const mockRpc = jest.fn(); 

//adding pantry items to work with the new fetchrecipes nikhil wrote
const mockPantryCountEq = jest.fn();
const mockPantryCountSelect = jest.fn(() => ({
  eq: mockPantryCountEq,
}));

const mockShoppingEq = jest.fn();
const mockShoppingSelect = jest.fn(() => ({
  eq: mockShoppingEq,
}));
const mockShoppingInsert = jest.fn();
const mockShoppingUpdateEq = jest.fn();
const mockShoppingUpdate = jest.fn(() => ({
  eq: mockShoppingUpdateEq,
}));

// --- NEW: Review & Rating Mocks ---
const mockOrder = jest.fn();
const mockMaybeSingle = jest.fn();
const mockIn = jest.fn();

const mockReviewsSelect = jest.fn(() => {
  const chain = {
    eq: jest.fn(() => chain),
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
  };
  return chain;
});

const mockSummarySelect = jest.fn(() => ({
  in: mockIn,
}));
// ----------------------------------

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
    rpc: jest.fn(), 
    from: jest.fn((table) => {
      if (table === 'recipes') {
        return { select: mockRecipesSelect };
      }
      if (table === 'pantry_items') {
        return { select: mockPantryCountSelect };
      }
      if (table === 'recipe_ingredients') {
        return { select: mockIngredientsSelect };
      }
      if (table === 'saved_recipes') {
        return { insert: mockInsert };
      }
      if (table === 'shopping_list') {
        return {
          select: mockShoppingSelect,
          insert: mockShoppingInsert,
          update: mockShoppingUpdate,
        };
      }
      // NEW: Mocking the review tables
      if (table === 'recipe_reviews') {
        return {
          select: mockReviewsSelect,
          insert: mockInsert,
          update: mockInsert,
        };
      }
      if (table === 'recipe_rating_summary') {
        return { select: mockSummarySelect };
      }

      return {
        select: jest.fn(),
        insert: jest.fn(),
      };
    }),
  },
}));

// added the mock for recommendations helper so fetchRecipes gets data
jest.mock('../../lib/recommendations', () => ({
  getRecipeRecommendations: jest.fn(),
  getRandomRecipes: jest.fn(),
}));

describe('RecipeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: mockRecipeData,
      error: null,
    });

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    });

    mockPantryCountEq.mockResolvedValue({
      count: 5,
      error: null,
    });

    getRecipeRecommendations.mockResolvedValue(mockRecipeData);
    getRandomRecipes.mockResolvedValue([]);

    mockEq.mockResolvedValue({
      data: [
        { quantity: '1', unit: 'cup', ingredient_name: 'rice' },
        { quantity: '1', unit: 'lb', ingredient_name: 'chicken' },
      ],
      error: null,
    });

    mockShoppingEq.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    mockShoppingUpdateEq.mockResolvedValue({
      data: null,
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    // --- NEW: Default values for review mocks ---
    mockIn.mockResolvedValue({
      data: [{ recipe_id: 1, average_rating: 5, total_reviews: 1 }],
      error: null,
    });

    mockOrder.mockResolvedValue({
      data: [{ id: 1, rating: 5, review_text: 'Delicious!' }],
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    // --------------------------------------------
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads recommended recipes for the signed in user', async () => {
    const { findByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    expect(await findByText('Chicken Rice Bowl')).toBeTruthy();
    expect(await findByText('Pasta Salad')).toBeTruthy();
    
    expect(getRecipeRecommendations).toHaveBeenCalledWith(
      'test-user-id',
      expect.objectContaining({
        minMatch: 0.0,
      })
    );
    expect(mockLimit).not.toHaveBeenCalled();
  });

  test('opens a recipe modal and loads recipe ingredients', async () => {
    const { findByText, getByText, getAllByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    fireEvent.press(await findByText('Chicken Rice Bowl'));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('recipe_id', 1);
      expect(mockIngredientsSelect).toHaveBeenCalledWith('quantity, unit, ingredient_name');
    });

    expect(getAllByText(/simple chicken and rice recipe/i).length).toBeGreaterThan(0);
    expect(getAllByText(/rice/i).length).toBeGreaterThan(0);
    expect(getAllByText(/chicken/i).length).toBeGreaterThan(0);
    expect(getAllByText(/1 cup rice/i).length).toBeGreaterThan(0);
    expect(getAllByText(/1 lb chicken/i).length).toBeGreaterThan(0);
    expect(getAllByText(/cook rice/i).length).toBeGreaterThan(0);
    expect(getByText(/save to profile/i)).toBeTruthy();
  });

  // TODO: un-skip once handleAddMissingIngredients is fully implemented with shopping_list integration
  test.skip('adds missing recipe ingredients to the shopping list with quantity and unit', async () => {
    const { findByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    fireEvent.press(await findByText('Chicken Rice Bowl'));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('recipe_id', 1);
    });

    fireEvent.press(getByText(/add missing ingredients/i));

    await waitFor(() => {
      expect(mockShoppingSelect).toHaveBeenCalledWith('*');
      expect(mockShoppingEq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockShoppingInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          user_id: 'test-user-id',
          item_name: 'rice',
          quantity: 1,
          unit: 'cup',
          checked: false,
        }),
      ]);
    });
  });

  test('saves an opened recipe to the signed in user profile', async () => {
    const { findByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    fireEvent.press(await findByText('Chicken Rice Bowl'));
    fireEvent.press(getByText(/save to profile/i));

    await waitFor(() => {
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    expect(mockInsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        recipe_id: 1,
        recipe_title: 'Chicken Rice Bowl',
        user_id: 'test-user-id',
      }),
    ]);
  });

  test('shows an alert when saving a recipe fails', async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: {
        message: 'Save failed',
      },
    });

    const { findByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    fireEvent.press(await findByText('Chicken Rice Bowl'));
    fireEvent.press(getByText(/save to profile/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/save failed/i)
      );
    });
  });

  // --------------------------------------------------------
  // --- NEW REVIEW FEATURE TESTS ---
  // --------------------------------------------------------

  test('displays average star ratings on the recipe card', async () => {
    const { findByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );
    // Verifies the 5-star summary mock injected from recipe_rating_summary view
    expect(await findByText('⭐⭐⭐⭐⭐ (1)')).toBeTruthy();
  });

  test('opens the reviews modal when clicking the Reviews button', async () => {
    const { findAllByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );
    
    // There are multiple "Reviews" buttons (one per card), so we click the first one
    const reviewButtons = await findAllByText('Reviews');
    fireEvent.press(reviewButtons[0]);

    await waitFor(() => {
      expect(getByText('Leave a Review')).toBeTruthy();
      expect(getByText('"Delicious!"')).toBeTruthy(); // Checks if the mocked review is displayed
    });
  });

  test('shows an alert when trying to submit a review without a star rating', async () => {
    const { findAllByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );
    
    const reviewButtons = await findAllByText('Reviews');
    fireEvent.press(reviewButtons[0]);

    await waitFor(() => {
      expect(getByText('Submit Review')).toBeTruthy();
    });

    // Click submit without selecting any stars
    fireEvent.press(getByText('Submit Review'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Missing Rating",
        "Please tap a star to select a rating before submitting."
      );
    });
  });
});