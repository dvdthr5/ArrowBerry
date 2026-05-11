import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import RecipeScreen from '../../app/screens/RecipesScreen';
import { getRecipeRecommendations } from '../../lib/recommendations';
import { supabase } from '../../lib/supabase';

const mockRecipeData = [
  {
    id: 1,
    recipe_id: 1,
    title: 'Chicken Rice Bowl',
    name: 'Chicken Rice Bowl',
    recipe_name: 'Chicken Rice Bowl',
    description: 'A simple chicken and rice recipe.',
    ingredients: 'chicken, rice, broccoli',
    instructions: '1. Cook rice. 2. Cook chicken. 3. Combine and serve.',
    image_url: null,
    match_percentage: 1,
    matched_ingredients: 2,
    total_ingredients: 2,
    missing_list: [],
  },
  {
    id: 2,
    recipe_id: 2,
    title: 'Pasta Salad',
    name: 'Pasta Salad',
    recipe_name: 'Pasta Salad',
    description: 'A quick pasta salad.',
    ingredients: 'pasta, tomato, olive oil',
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

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn((table) => {
      if (table === 'recipes') {
        return {
          select: mockRecipesSelect,
        };
      }

      if (table === 'recipe_ingredients') {
        return {
          select: mockIngredientsSelect,
        };
      }

      if (table === 'saved_recipes') {
        return {
          insert: mockInsert,
        };
      }

      return {
        select: jest.fn(),
        insert: jest.fn(),
      };
    }),
  },
}));

jest.mock('../../lib/recommendations', () => ({
  getRecipeRecommendations: jest.fn(),
}));

describe('RecipeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
        },
      },
      error: null,
    });

    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'test-user-id',
          },
        },
      },
      error: null,
    });

    getRecipeRecommendations.mockResolvedValue(mockRecipeData);

    mockLimit.mockResolvedValue({
      data: mockRecipeData,
      error: null,
    });

    mockEq.mockResolvedValue({
      data: [
        {
          quantity: '1',
          unit: 'cup',
          ingredient_name: 'rice',
        },
        {
          quantity: '1',
          unit: 'lb',
          ingredient_name: 'chicken',
        },
      ],
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads recommended recipes for the signed in user', async () => {
    const { findByText } = render(<RecipeScreen />);

    expect(await findByText('Chicken Rice Bowl')).toBeTruthy();
    expect(await findByText('Pasta Salad')).toBeTruthy();
    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(getRecipeRecommendations).toHaveBeenCalledWith('test-user-id', {
      minMatch: 0.0,
    });
    expect(mockLimit).not.toHaveBeenCalled();
  });

  test('opens a recipe modal and loads recipe ingredients', async () => {
    const { findByText, getByText, getAllByText } = render(<RecipeScreen />);

    fireEvent.press(await findByText('Chicken Rice Bowl'));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('recipe_id', 1);
      expect(mockIngredientsSelect).toHaveBeenCalledWith('quantity, unit, ingredient_name');
    });

    expect(getAllByText(/simple chicken and rice recipe/i).length).toBeGreaterThan(0);
    expect(getAllByText(/rice/i).length).toBeGreaterThan(0);
    expect(getAllByText(/chicken/i).length).toBeGreaterThan(0);
    expect(getAllByText(/cook rice/i).length).toBeGreaterThan(0);
    expect(getByText(/save to profile/i)).toBeTruthy();
  });

  test('saves an opened recipe to the signed in user profile', async () => {
    const { findByText, getByText } = render(<RecipeScreen />);

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

    const { findByText, getByText } = render(<RecipeScreen />);

    fireEvent.press(await findByText('Chicken Rice Bowl'));
    fireEvent.press(getByText(/save to profile/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/save failed/i)
      );
    });
  });
});