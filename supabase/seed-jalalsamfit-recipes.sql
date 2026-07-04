-- ============================================================
-- Jalalsamfit Cookbook — 31 Recipe Seed
-- Run in Supabase SQL Editor after deploying the schema
-- Replace 'USER_ID_HERE' with your auth.users id (or run
-- a query to find it first: SELECT id FROM auth.users;)
-- ============================================================

-- To use: replace 'USER_ID_HERE' with your actual user ID
-- e.g., SELECT id FROM auth.users LIMIT 1;
-- Then copy the UUID into the insert below.

do $$
declare
  v_user_id uuid := 'USER_ID_HERE';  -- ← CHANGE THIS to your actual user ID
begin

insert into recipes (user_id, name, cuisine, tags, cooked_count) values
  (v_user_id, 'Honey Garlic Butter Chicken Mac n Cheese',       'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Pasta'], 0),
  (v_user_id, 'Crispy Salt N Pepper Chicken & Chips',           'British',        array['Jalalsamfit', 'Meal Prep', 'Chicken'], 0),
  (v_user_id, 'Creamy Chipotle Steak & Potatoes',               'Tex-Mex',        array['Jalalsamfit', 'Meal Prep', 'Steak', 'Potatoes'], 0),
  (v_user_id, 'Lemon Pepper Chicken Rice Bowls',                'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice Bowls'], 0),
  (v_user_id, 'Cheesy Beef Taco Potato Bowls',                  'Tex-Mex',        array['Jalalsamfit', 'Meal Prep', 'Beef', 'Potatoes'], 0),
  (v_user_id, 'Grilled Chicken Alfredo Pasta',                  'Italian-American',array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Pasta'], 0),
  (v_user_id, 'Garlic Butter Steak Bites & Cajun Mac n Cheese', 'Fusion',         array['Jalalsamfit', 'Meal Prep', 'Steak', 'Pasta', 'Cajun'], 0),
  (v_user_id, 'Honey Chipotle Chicken',                         'Tex-Mex',        array['Jalalsamfit', 'Meal Prep', 'Chicken'], 0),
  (v_user_id, 'Honey Chilli Lime Chicken',                      'Asian-Fusion',   array['Jalalsamfit', 'Meal Prep', 'Chicken'], 0),
  (v_user_id, 'Garlic Butter Chicken & Creamy Potatoes',        'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Potatoes'], 0),
  (v_user_id, 'Philly Cheese Steak Mac N Cheese',               'American',       array['Jalalsamfit', 'Meal Prep', 'Steak', 'Pasta'], 0),
  (v_user_id, 'Creamy Honey Garlic Steak Noodles',              'Asian-Fusion',   array['Jalalsamfit', 'Meal Prep', 'Steak', 'Noodles'], 0),
  (v_user_id, 'Creamy Garlic Cheesy Chicken & Potatoes',        'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Potatoes'], 0),
  (v_user_id, 'Creamy Cajun Chicken & Rice',                    'Cajun',          array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice'], 0),
  (v_user_id, 'Garlic Butter Steak Bites',                      'American',       array['Jalalsamfit', 'Meal Prep', 'Steak'], 0),
  (v_user_id, 'Crispy Garlic Chicken Fried Rice',               'Asian',          array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice'], 0),
  (v_user_id, 'Honey BBQ Chicken & Garlic Parmesan Potatoes',   'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Potatoes'], 0),
  (v_user_id, 'Garlic Alfredo Steak & Mashed Potatoes',         'Italian-American',array['Jalalsamfit', 'Meal Prep', 'Steak', 'Potatoes'], 0),
  (v_user_id, 'Chicken Shawarma Rice Bowls',                    'Middle Eastern', array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice Bowls'], 0),
  (v_user_id, 'Chicken Fajita Mac N Cheese',                    'Tex-Mex',        array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Pasta'], 0),
  (v_user_id, 'Orange Chicken Rice Bowls',                      'Asian',          array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice Bowls'], 0),
  (v_user_id, 'Creamy Cajun Steak & Parmesan Potatoes',         'Cajun',          array['Jalalsamfit', 'Meal Prep', 'Steak', 'Potatoes'], 0),
  (v_user_id, 'Caramelized Onion Creamy Chicken',               'American',       array['Jalalsamfit', 'Meal Prep', 'Chicken'], 0),
  (v_user_id, 'Sweet & Sour Chicken Fried Rice',                'Asian',          array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice'], 0),
  (v_user_id, 'Chipotle Beef Potato Bowls',                     'Tex-Mex',        array['Jalalsamfit', 'Meal Prep', 'Beef', 'Potatoes'], 0),
  (v_user_id, 'Harissa Chicken Rice Bowls',                     'Middle Eastern', array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice Bowls'], 0),
  (v_user_id, 'Honey Butter Chicken Alfredo Pasta',             'Italian-American',array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Pasta'], 0),
  (v_user_id, 'Philly Cheesesteak Rice Bowls',                  'American',       array['Jalalsamfit', 'Meal Prep', 'Steak', 'Rice Bowls'], 0),
  (v_user_id, 'Crispy Nashville Hot Chicken Mac n Cheese',      'Southern',       array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Pasta'], 0),
  (v_user_id, 'Cajun Honey Butter Chicken & Creamy Potatoes',   'Cajun',          array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Potatoes'], 0),
  (v_user_id, 'Street Corn Chicken Bowls',                      'Mexican',        array['Jalalsamfit', 'Meal Prep', 'Chicken', 'Rice Bowls'], 0);

end $$;
