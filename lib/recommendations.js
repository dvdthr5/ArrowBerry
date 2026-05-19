import { supabase } from './supabase';

/**
 * gives the user recipe recommendations based on what they have on their pantry
 */
export async function getRecipeRecommendations(userId, options = {}) {
  const { limit = 20, minMatch = 0.0, cuisine = null } = options;

  const { data, error } = await supabase.rpc('recommend_recipes', {
    p_user_id: userId,
    p_limit: limit,
    p_min_match: minMatch,
    p_cuisine: cuisine,
  });

  if (error) {
    console.error('RPC error:', error);
    throw error;
  }

  return data ?? [];
}

//getting random recipes if the user has no ingredients 
export async function getRandomRecipes(limit = 20) {
  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true });

  if (!count) return [];

  const offset = Math.max(0, Math.floor(Math.random() * Math.max(1, count - limit)));

  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, description, instructions, image_url, prep_time_minutes, cook_time_minutes, cuisine')
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Random recipes error:', error);
    throw error;
  }
  return (data ?? []).map(recipe => ({
    recipe_id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    instructions: recipe.instructions,
    image_url: recipe.image_url,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    cuisine: recipe.cuisine,
    total_ingredients: 0,
    matched_ingredients: 0,
    missing_ingredients: 0,
    match_percentage: 0,
    matched_list: [],
    missing_list: [],
    has_all_core: true,
  }));
}