import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { rankGroup, poolInsertIndex, computeScores, type RankedInput } from './scoring'

describe('rankGroup', () => {
  it('maps the three core types to their own pools', () => {
    assert.equal(rankGroup('main'), 'main')
    assert.equal(rankGroup('dessert'), 'dessert')
    assert.equal(rankGroup('drink'), 'drink')
  })

  it('folds meal-of-day types into mains', () => {
    assert.equal(rankGroup('breakfast'), 'main')
    assert.equal(rankGroup('lunch'), 'main')
    assert.equal(rankGroup('dinner'), 'main')
  })

  it('sends appetizers, untyped and unrecognized recipes to the shared pool', () => {
    assert.equal(rankGroup('appetizer'), 'other')
    assert.equal(rankGroup(null), 'other')
    assert.equal(rankGroup(undefined), 'other')
    assert.equal(rankGroup(''), 'other')
    assert.equal(rankGroup('amuse-bouche'), 'other')
  })

  it('is case- and whitespace-insensitive', () => {
    assert.equal(rankGroup('  Dessert '), 'dessert')
    assert.equal(rankGroup('DRINK'), 'drink')
  })
})

describe('poolInsertIndex', () => {
  const tier = ['main', 'dessert', 'main', 'drink', 'dessert'] as const

  it('parks a recipe with no peers at the end of the tier', () => {
    assert.equal(poolInsertIndex(['main', 'main'], 'dessert', 1), 2)
    assert.equal(poolInsertIndex([], 'drink', 1), 0)
  })

  it('slots in just ahead of the peer it beat', () => {
    // desserts sit at flat indices 1 and 4. Best dessert → index 1.
    assert.equal(poolInsertIndex([...tier], 'dessert', 1), 1)
    // second-best dessert → ahead of the dessert at index 4.
    assert.equal(poolInsertIndex([...tier], 'dessert', 2), 4)
  })

  it('lands just after the last peer when it is worst in its pool', () => {
    assert.equal(poolInsertIndex([...tier], 'dessert', 3), 5)
    // Positions beyond the pool size clamp to the same spot.
    assert.equal(poolInsertIndex([...tier], 'dessert', 99), 5)
    assert.equal(poolInsertIndex([...tier], 'main', 3), 3)
  })

  it('never disturbs the relative order of other pools', () => {
    const bucket = [...tier]
    const at = poolInsertIndex(bucket, 'dessert', 2)
    const after = [...bucket.slice(0, at), 'dessert-new', ...bucket.slice(at)]
    assert.deepEqual(
      after.filter(g => g !== 'dessert' && g !== 'dessert-new'),
      ['main', 'main', 'drink']
    )
  })
})

describe('computeScores', () => {
  const r = (id: string, rank: number, feedback: RankedInput['feedback'], recipeType: string | null): RankedInput =>
    ({ id, rank, feedback, recipeType })

  it('gives the best of every pool the top of its band', () => {
    const scores = computeScores([
      r('main-a', 1, 'like', 'main'),
      r('main-b', 2, 'like', 'main'),
      r('dessert-a', 3, 'like', 'dessert'),
    ])
    // Lone dessert scores 10.0 even though two mains outrank it globally.
    assert.equal(scores['dessert-a'], 10.0)
    assert.equal(scores['main-a'], 10.0)
    assert.equal(scores['main-b'], 7.0)
  })

  it('spreads a pool across its tier band by rank order', () => {
    const scores = computeScores([
      r('a', 1, 'like', 'main'),
      r('b', 5, 'like', 'main'),
      r('c', 9, 'like', 'main'),
    ])
    assert.equal(scores['a'], 10.0)
    assert.equal(scores['b'], 8.5)
    assert.equal(scores['c'], 7.0)
  })

  it('keeps tiers from crossing — a disliked main never outscores an okay main', () => {
    const scores = computeScores([
      r('okay-worst', 9, 'okay', 'main'),
      r('okay-best', 1, 'okay', 'main'),
      r('dislike-best', 2, 'dislike', 'main'),
    ])
    assert.ok(scores['okay-worst'] > scores['dislike-best'])
    assert.equal(scores['dislike-best'], 3.9)
  })

  it('separates the same type across tiers, and the same tier across types', () => {
    const scores = computeScores([
      r('liked-main', 1, 'like', 'main'),
      r('liked-drink', 2, 'like', 'drink'),
      r('okay-main', 3, 'okay', 'main'),
    ])
    assert.equal(scores['liked-main'], 10.0)
    assert.equal(scores['liked-drink'], 10.0)
    assert.equal(scores['okay-main'], 6.9)
  })

  it('pools appetizers with untyped recipes', () => {
    const scores = computeScores([
      r('app', 1, 'like', 'appetizer'),
      r('untyped', 2, 'like', null),
    ])
    // Same pool, so they share the band rather than both scoring 10.0.
    assert.equal(scores['app'], 10.0)
    assert.equal(scores['untyped'], 7.0)
  })

  it('omits unranked recipes', () => {
    const scores = computeScores([
      { id: 'no-rank', rank: null, feedback: 'like', recipeType: 'main' },
      r('ranked', 1, 'like', 'main'),
    ])
    assert.equal(scores['no-rank'], undefined)
    assert.equal(scores['ranked'], 10.0)
  })
})
