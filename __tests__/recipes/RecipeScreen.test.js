import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RecipeScreen from '../../app/screens/RecipesScreen';
import { supabase } from '../../lib/supabase';

// Mock Data
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
    missing_list: [],
  }
];

const mockRatingSummary = [
  { recipe_id: 1, average_rating: 4.5, total_reviews: 12 }
];

const mockExistingReviews = [
  { id: 101, recipe_id: 1, user_id: 'other-user', rating: 5, review_text: 'Loved it!' }
];

// Robust Chain Mocks for Supabase
const mockInsertSavedRecipe = jest.fn().mockResolvedValue({ error: null });
const mockInsertReview = jest.fn().mockResolvedValue({ error: null });
const mockUpdateReview = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

const mockReviewsQueryBuilder = {
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: mockExistingReviews, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) // Simulates no prior review from current user
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('RecipeScreen - Ratings & Reviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress expected intentional errors in console

    // Auth Mock
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    // RPC Mock (recommend_recipes)
    supabase.rpc.mockResolvedValue({
      data: mockRecipeData,
      error: null,
    });

    // Table Routing Mock
    supabase.from.mockImplementation((table) => {
      if (table === 'recipe_ingredients') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { quantity: '1', unit: 'cup', ingredient_name: 'rice' },
                { quantity: '1', unit: 'lb', ingredient_name: 'chicken' },
              ],
              error: null,
            })
          })
        };
      }
      if (table === 'recipe_rating_summary') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockRatingSummary, error: null })
          })
        };
      }
      if (table === 'recipe_reviews') {
        return {
          select: jest.fn().mockReturnValue(mockReviewsQueryBuilder),
          insert: mockInsertReview,
          update: mockUpdateReview,
        };
      }
      if (table === 'saved_recipes') {
        return { insert: mockInsertSavedRecipe };
      }
      return { select: jest.fn(), insert: jest.fn() };
    });
  });

  test('fetches and displays recipes with aggregated star ratings', async () => {
    const { findByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    // Assert Title
    expect(await findByText('Chicken Rice Bowl')).toBeTruthy();
    
    // Assert RPC and Summary were fetched
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('recommend_recipes', expect.any(Object));
      expect(supabase.from).toHaveBeenCalledWith('recipe_rating_summary');
    });

    // Assert the mocked total reviews "(12)" appears on the card
    expect(await findByText('(12)')).toBeTruthy();
  });

  test('opens recipe details modal and saves recipe', async () => {
    const { findByText, getByText, getAllByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    const recipeCard = await findByText('Chicken Rice Bowl');
    fireEvent.press(recipeCard);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('recipe_ingredients');
    });

    // Verify Modal Details
    expect(getAllByText(/simple chicken and rice recipe/i).length).toBeGreaterThan(0);
    
    // Click Save Button
    const saveBtn = getByText(/❤️ Save to Profile/i);
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(mockInsertSavedRecipe).toHaveBeenCalled();
    });

    const payload = mockInsertSavedRecipe.mock.calls[0][0][0];
    expect(payload.user_id).toBe('test-user-id');
    expect(payload.recipe_title).toBe('Chicken Rice Bowl');
  });

  test('opens community reviews modal and displays existing reviews', async () => {
    const { findByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    const reviewsBtn = await findByText('Reviews');
    fireEvent.press(reviewsBtn);

    await waitFor(() => {
       expect(mockReviewsQueryBuilder.order).toHaveBeenCalled();
    });

    // Verify Review Modal content
    expect(getByText('Community Reviews')).toBeTruthy();
    expect(getByText('"Loved it!"')).toBeTruthy(); 
  });

  test('shows error when submitting a review without tapping a star', async () => {
     const { findByText, getByText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    const reviewsBtn = await findByText('Reviews');
    fireEvent.press(reviewsBtn);
    
    await waitFor(() => {
       expect(getByText('Submit Review')).toBeTruthy();
    });

    // Click submit without selecting a star rating
    const submitBtn = getByText('Submit Review');
    fireEvent.press(submitBtn);

    // Validation error text should appear inline
    expect(await findByText('⚠️ Please tap a star to select a rating.')).toBeTruthy();
    
    // Ensure database insertion never fired
    expect(mockInsertReview).not.toHaveBeenCalled();
  });

  test('submits a new interactive star rating and review successfully', async () => {
     const { findByText, getByText, getAllByText, getByPlaceholderText } = render(
      <NavigationContainer>
        <RecipeScreen />
      </NavigationContainer>
    );

    const reviewsBtn = await findByText('Reviews');
    fireEvent.press(reviewsBtn);
    
    await waitFor(() => {
       expect(getByText('Submit Review')).toBeTruthy();
    });

    // Tap the 5th star. We grab the last '★' element in the view (which is the 5th interactive star)
    const starButtons = getAllByText('★');
    fireEvent.press(starButtons[starButtons.length - 1]);

    // Fill out the review text field
    const input = getByPlaceholderText(/What did you think of this recipe/i);
    fireEvent.changeText(input, 'Awesome dish!');

    // Submit
    const submitBtn = getByText('Submit Review');
    fireEvent.press(submitBtn);

    await waitFor(() => {
        expect(mockInsertReview).toHaveBeenCalled();
    });

    // Assert the exact payload sent to Supabase matches expectations
    const payload = mockInsertReview.mock.calls[0][0][0];
    expect(payload.user_id).toBe('test-user-id');
    expect(payload.recipe_id).toBe(1);
    expect(payload.rating).toBe(5);
    expect(payload.review_text).toBe('Awesome dish!');

    // Verify Success Alert
    expect(Alert.alert).toHaveBeenCalledWith("Review Submitted!", "Your rating has been posted successfully.");
  });
});