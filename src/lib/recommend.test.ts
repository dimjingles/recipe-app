import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import type { Profile } from '@/types/database'
import { buildTasteProfile, recommendFromFriends, type FriendRecipeCandidate, type TasteRecipe } from './recommend'

let seq = 0
function mine(over: Partial<TasteRecipe>): TasteRecipe {
  return {
    id: `m${++seq}`, name: `Mine ${seq}`, cuisine: null, categories: [], tags: [],
    feedback: null, rank: null, recipe_type: 'main', cooked_count: 0, ...over,
  }
}
function friend(over: Partial<FriendRecipeCandidate>): FriendRecipeCandidate {
  return {
    id: `f${++seq}`, user_id: 'alice', name: `Friend ${seq}`, cuisine: null, categories: [], tags: [],
    feedback: null, cooked_count: 0, original_recipe_id: null,
    created_at: '2026-09-01T00:00:00Z', ingredient_names: [], ...over,
  }
}

describe('buildTasteProfile', () => {
  it('leans toward liked features and away from disliked ones', () => {
    const taste = buildTasteProfile([
      mine({ cuisine: 'Italian', categories: ['pasta'], feedback: 'like' }),
      mine({ cuisine: 'Mexican', feedback: 'dislike' }),
    ])
    assert.ok((taste.get('cuisine:italian') ?? 0) > 0)
    assert.ok((taste.get('category:pasta') ?? 0) > 0)
    assert.ok((taste.get('cuisine:mexican') ?? 0) < 0)
  })

  it('is empty with no ratings or cooks', () => {
    assert.equal(buildTasteProfile([mine({ cuisine: 'Thai' })]).size, 0)
  })
})

describe('recommendFromFriends', () => {
  const liked = [mine({ name: 'Cacio e Pepe', cuisine: 'Italian', categories: ['pasta'], feedback: 'like' })]

  it('puts recipes similar to liked ones first', () => {
    const thai = friend({ name: 'Pad Thai', cuisine: 'Thai', created_at: '2026-09-20T00:00:00Z' })
    const lasagna = friend({ name: 'Lasagna', cuisine: 'Italian', categories: ['pasta'] })
    const out = recommendFromFriends(liked, [thai, lasagna], null)
    assert.deepEqual(out.map(r => r.name), ['Lasagna', 'Pad Thai'])
  })

  it('drops what the user already has, adaptations of theirs, and friend-disliked recipes', () => {
    const own = liked[0]
    const out = recommendFromFriends(liked, [
      friend({ name: ' cacio E pepe ' }),
      friend({ name: 'Spicy Cacio', original_recipe_id: own.id }),
      friend({ name: 'Burnt Toast', feedback: 'dislike' }),
      friend({ name: 'Risotto', cuisine: 'Italian' }),
    ], null)
    assert.deepEqual(out.map(r => r.name), ['Risotto'])
  })

  it('leaves out recipes that clash with allergies', () => {
    const profile = { allergies: ['nuts'], diet: null } as unknown as Profile
    const out = recommendFromFriends(liked, [
      friend({ name: 'Pesto Pasta', cuisine: 'Italian', ingredient_names: ['pine nuts', 'basil'] }),
      friend({ name: 'Aglio e Olio', cuisine: 'Italian' }),
    ], profile)
    assert.deepEqual(out.map(r => r.name), ['Aglio e Olio'])
  })

  it('leaves out recipes that lean toward disliked features', () => {
    const taste = [mine({ cuisine: 'Mexican', feedback: 'dislike' })]
    const out = recommendFromFriends(taste, [friend({ name: 'Tacos', cuisine: 'Mexican' }), friend({ name: 'Ramen' })], null)
    assert.deepEqual(out.map(r => r.name), ['Ramen'])
  })

  it('caps each friend at two while others have picks, then tops up', () => {
    const pool = [
      friend({ user_id: 'alice', name: 'A1', cuisine: 'Italian' }),
      friend({ user_id: 'alice', name: 'A2', cuisine: 'Italian' }),
      friend({ user_id: 'alice', name: 'A3', cuisine: 'Italian' }),
      friend({ user_id: 'bob', name: 'B1', cuisine: 'Thai' }),
    ]
    assert.deepEqual(recommendFromFriends(liked, pool, null, 3).map(r => r.name), ['A1', 'A2', 'B1'])
    assert.deepEqual(recommendFromFriends(liked, pool, null, 4).map(r => r.name), ['A1', 'A2', 'B1', 'A3'])
  })

  it('falls back to friend-liked, then newest, with no taste signal', () => {
    const out = recommendFromFriends([], [
      friend({ name: 'Old', created_at: '2026-01-01T00:00:00Z' }),
      friend({ name: 'New', created_at: '2026-09-01T00:00:00Z' }),
      friend({ name: 'Loved', feedback: 'like', created_at: '2025-01-01T00:00:00Z' }),
    ], null)
    assert.deepEqual(out.map(r => r.name), ['Loved', 'New', 'Old'])
  })
})
