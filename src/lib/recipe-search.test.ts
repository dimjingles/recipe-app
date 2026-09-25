import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { isExactNameMatch, matchRecipe, searchRecipes } from './recipe-search'

const carbonara = { name: 'Spaghetti Carbonara', cuisine: 'Italian', tags: ['Quick'], categories: ['pasta'], ingredients: [{ name: 'Guanciale' }] }
const tikka = { name: 'Chicken Tikka Masala', cuisine: 'Indian', tags: [], categories: ['meat'], ingredients: [{ name: 'Chicken thighs' }] }
const pie = { name: 'Chicken Pot Pie', cuisine: 'American', tags: null, categories: [], ingredients: [] }

describe('matchRecipe', () => {
  it('ranks name prefix, word start, substring, metadata, ingredient', () => {
    assert.equal(matchRecipe(carbonara, 'spag'), 0)
    assert.equal(matchRecipe(carbonara, 'carb'), 1)
    assert.equal(matchRecipe(carbonara, 'bonara'), 2)
    assert.equal(matchRecipe(carbonara, 'italian'), 3)
    assert.equal(matchRecipe(carbonara, 'pasta'), 3)
    assert.equal(matchRecipe(carbonara, 'quick'), 3)
    assert.equal(matchRecipe(carbonara, 'guanciale'), 4)
  })

  it('returns null when nothing matches', () => {
    assert.equal(matchRecipe(carbonara, 'sushi'), null)
  })

  it('ignores case and extra spacing', () => {
    assert.equal(matchRecipe(carbonara, '  SPAGHETTI   carb '), 0)
  })

  it('matches everything on an empty query', () => {
    assert.equal(matchRecipe(pie, '   '), 0)
  })
})

describe('searchRecipes', () => {
  it('orders by match quality, keeping input order on ties', () => {
    const results = searchRecipes([tikka, carbonara, pie], 'chicken')
    assert.deepEqual(results.map(r => r.name), ['Chicken Tikka Masala', 'Chicken Pot Pie'])
  })

  it('puts name matches ahead of ingredient matches', () => {
    const soup = { name: 'Soup', ingredients: [{ name: 'chicken stock' }] }
    const results = searchRecipes([soup, pie], 'chicken')
    assert.deepEqual(results.map(r => r.name), ['Chicken Pot Pie', 'Soup'])
  })
})

describe('isExactNameMatch', () => {
  it('compares whole names, ignoring case and spacing', () => {
    assert.equal(isExactNameMatch(carbonara, ' spaghetti  carbonara '), true)
    assert.equal(isExactNameMatch(carbonara, 'spaghetti'), false)
    assert.equal(isExactNameMatch(carbonara, ''), false)
  })
})
