import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { isInviteToken, resolveInviteRedirect } from './invite'

const TOKEN = '3f2b8c1e-9a4d-4e7b-8c6f-1d2e3f4a5b6c'
const alice = { id: 'alice-id', username: 'alice' }

describe('isInviteToken', () => {
  it('accepts a uuid in either case', () => {
    assert.equal(isInviteToken(TOKEN), true)
    assert.equal(isInviteToken(TOKEN.toUpperCase()), true)
  })

  it('rejects anything that is not a bare uuid', () => {
    assert.equal(isInviteToken(''), false)
    assert.equal(isInviteToken(undefined), false)
    assert.equal(isInviteToken(null), false)
    assert.equal(isInviteToken(42), false)
    assert.equal(isInviteToken(TOKEN.replace(/-/g, '')), false)
    assert.equal(isInviteToken(`{${TOKEN}}`), false)
    assert.equal(isInviteToken(` ${TOKEN}`), false)
    assert.equal(isInviteToken(TOKEN.slice(0, -1)), false)
    assert.equal(isInviteToken(TOKEN.replace('3f', 'zz')), false)
    assert.equal(isInviteToken('alice'), false)
  })
})

describe('resolveInviteRedirect', () => {
  it('remembers the invite for signed-out visitors and sends them to sign up', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: alice, userId: null, onboarded: false }),
      { path: '/onboarding', setCookie: true },
    )
  })

  it('remembers the invite for accounts that have not finished onboarding', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: alice, userId: 'bob-id', onboarded: false }),
      { path: '/onboarding', setCookie: true },
    )
  })

  it('sends existing users to the inviter profile without auto-friending', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: alice, userId: 'bob-id', onboarded: true }),
      { path: '/u/alice', setCookie: false },
    )
  })

  it('sends the inviter opening their own link to /friends', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: alice, userId: 'alice-id', onboarded: true }),
      { path: '/friends', setCookie: false },
    )
  })

  it('ignores unknown or reset tokens', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: null, userId: null, onboarded: false }),
      { path: '/onboarding', setCookie: false },
    )
    assert.deepEqual(
      resolveInviteRedirect({ inviter: null, userId: 'bob-id', onboarded: true }),
      { path: '/', setCookie: false },
    )
  })

  it('ignores inviters without a handle', () => {
    assert.deepEqual(
      resolveInviteRedirect({ inviter: { id: 'x', username: null }, userId: null, onboarded: false }),
      { path: '/onboarding', setCookie: false },
    )
  })
})
