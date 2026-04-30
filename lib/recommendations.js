import { supabase } from './supabase';

/**
 * gives the user recipe recommendations based on what they have on their pantry
 */
export async function getRecipeRecommendations(userId, options = {}) {
  const { limit = 20, minMatch = 0.0 } = options;

  const { data, error } = await supabase.rpc('recommend_recipes', {
    p_user_id: userId,
    p_limit: limit,
    p_min_match: minMatch,
  });

  if (error) {
    console.error('RPC error:', error);
    throw error;
  }

  return data ?? [];
}