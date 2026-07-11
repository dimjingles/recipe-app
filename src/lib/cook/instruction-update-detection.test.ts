import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { buildInstructionUpdateCandidate, shouldOfferInstructionUpdate } from './instruction-update-detection'

describe('instruction update detection', () => {
  it('offers to save durable cooking changes from the chef conversation', () => {
    assert.equal(shouldOfferInstructionUpdate('I used almond milk instead of whole milk and it worked better.'), true)
  })

  it('does not offer to save one-off questions', () => {
    assert.equal(shouldOfferInstructionUpdate('How do I know when the onions are done?'), false)
  })

  it('builds a candidate with the current step and user change', () => {
    assert.deepEqual(
      buildInstructionUpdateCandidate({
        stepNumber: 2,
        stepText: 'Whisk in the milk until smooth.',
        userMessage: 'Use almond milk instead of whole milk.',
      }),
      {
        stepNumber: 2,
        stepText: 'Whisk in the milk until smooth.',
        userMessage: 'Use almond milk instead of whole milk.',
        summary: 'Step 2 update: Use almond milk instead of whole milk.',
      },
    )
  })
})
