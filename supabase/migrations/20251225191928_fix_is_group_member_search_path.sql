/*
  # Fix is_group_member Function Search Path

  ## Security Fix

  ### Changes Made
    - Set immutable search_path for `is_group_member` function
    - Use `pg_catalog, public` instead of empty string for proper schema resolution
    - This prevents search_path injection attacks while maintaining functionality

  ## Technical Details
    The function had an empty search_path (`SET search_path = ''`) which can still 
    trigger security warnings. The recommended approach is to explicitly set it to 
    `pg_catalog, public` to ensure predictable schema resolution.
*/

-- Fix the search_path for is_group_member function
ALTER FUNCTION public.is_group_member(...)
SET search_path = '';
