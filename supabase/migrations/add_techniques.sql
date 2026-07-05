-- Technique catalogue, recipe classification, and skill profile
create table if not exists techniques (
  key text primary key,
  label text not null,
  category text not null,
  description text not null,
  prerequisites text[] default '{}'
);

alter table techniques enable row level security;
drop policy if exists "techniques are public read" on techniques;
create policy "techniques are public read" on techniques for select using (true);

insert into techniques (key, label, category, description, prerequisites) values
('sear','Searing','Heat & Cooking Methods','Cooking food at high heat to develop a browned, flavourful crust before finishing by another method.','{}'),
('simmer','Simmering','Heat & Cooking Methods','Cooking liquid just below boiling so small bubbles break gently at the surface.','{}'),
('boil','Boiling','Heat & Cooking Methods','Cooking food in a full rolling boil, used for pasta, eggs, and vegetables.','{}'),
('saute','Sautéing','Heat & Cooking Methods','Cooking food quickly in a small amount of fat over high heat while keeping it moving.','{}'),
('roast','Roasting','Heat & Cooking Methods','Cooking food uncovered in an oven using dry heat.','{}'),
('steam','Steaming','Heat & Cooking Methods','Cooking food suspended over boiling water using steam.','{}'),
('fry','Frying','Heat & Cooking Methods','Cooking food submerged or partially submerged in hot oil.','{}'),
('braise','Braising','Heat & Cooking Methods','Slow-cooking food in a covered pot with a small amount of liquid after an initial sear.','{"sear","simmer"}'),
('stew','Stewing','Heat & Cooking Methods','Slow-cooking food fully submerged in liquid over low heat.','{"simmer"}'),
('grill','Grilling','Heat & Cooking Methods','Cooking food on a grate over direct dry heat.','{}'),
('poach','Poaching','Heat & Cooking Methods','Cooking food gently in liquid kept below a simmer.','{"simmer"}'),
('blanch','Blanching','Heat & Cooking Methods','Briefly boiling food then plunging it into ice water to stop cooking.','{"boil"}'),
('deglaze','Deglazing','Heat & Cooking Methods','Adding liquid to a hot pan to lift browned bits and create a sauce base.','{"sear","saute"}'),
('reduce','Reducing','Heat & Cooking Methods','Simmering a liquid to evaporate water and concentrate flavour.','{"simmer"}'),
('dice','Dicing','Knife Skills','Cutting food into uniform cubes.','{}'),
('julienne','Julienne','Knife Skills','Cutting food into thin matchstick strips.','{"dice"}'),
('chiffonade','Chiffonade','Knife Skills','Stacking leafy greens or herbs, rolling them, and slicing into thin ribbons.','{"dice"}'),
('mince','Mincing','Knife Skills','Chopping food into very small, uniform pieces.','{"dice"}'),
('fold','Folding','Baking & Pastry','Gently combining a light airy mixture into a heavier one using a spatula to preserve volume.','{}'),
('cream','Creaming','Baking & Pastry','Beating butter and sugar together until light and fluffy to incorporate air.','{}'),
('proof','Proofing','Baking & Pastry','Allowing yeast dough to rise so it develops flavour and structure.','{}'),
('knead','Kneading','Baking & Pastry','Working dough by pressing and folding to develop gluten structure.','{}'),
('laminate','Laminating','Baking & Pastry','Folding butter into dough repeatedly to create flaky, layered pastry.','{"fold","knead"}'),
('emulsify','Emulsifying','Sauce & Emulsification','Combining two liquids that normally separate into a stable mixture.','{}'),
('roux','Making a Roux','Sauce & Emulsification','Cooking flour and fat together as the base for sauces.','{"saute"}'),
('temper','Tempering','Sauce & Emulsification','Gradually raising the temperature of a sensitive ingredient to prevent curdling or seizing.','{}'),
('beurre_blanc','Beurre Blanc','Sauce & Emulsification','A classic butter sauce made by whisking cold butter into a wine-vinegar reduction.','{"reduce","emulsify"}'),
('cure','Curing','Preservation','Preserving food using salt, sugar, or both to draw out moisture.','{}'),
('pickle','Pickling','Preservation','Preserving food in an acidic brine or through lacto-fermentation.','{}'),
('ferment','Fermenting','Preservation','Using microorganisms to convert sugars into acids, gases, or alcohol.','{"pickle"}')
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description,
  prerequisites = excluded.prerequisites;

alter table recipes add column if not exists techniques text[] default '{}';
alter table profiles add column if not exists skill_profile jsonb default '{}'::jsonb;
