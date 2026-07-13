import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildGoalCommitLabel, toggleGoalSelection } from './goals'

describe('onboarding goal selection', () => {
  it('adds and removes goals while preserving selection order', () => {
    assert.deepEqual(toggleGoalSelection([], 'healthier'), ['healthier'])
    assert.deepEqual(toggleGoalSelection(['healthier'], 'save_time'), ['healthier', 'save_time'])
    assert.deepEqual(toggleGoalSelection(['healthier', 'save_time'], 'healthier'), ['save_time'])
  })

  it('builds a readable commit label for multiple selected goals', () => {
    assert.equal(
      buildGoalCommitLabel(['healthier', 'save_time', 'reduce_waste']),
      'eating healthier, saving time in the kitchen, and reducing food waste',
    )
  })
})
