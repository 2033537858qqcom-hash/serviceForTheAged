import test from 'node:test'
import assert from 'node:assert/strict'
import { hasAdminSession } from './admin-session.js'
test('admin route accepts only an explicit admin session and clears malformed or non-admin sessions', () => {
  for (const [token, user, allowed] of [
    ['token', '{"role":"ADMIN"}', true], ['token', '{"role":"RESIDENT"}', false],
    ['token', '{}', false], ['token', 'invalid-json', false], ['', '{"role":"ADMIN"}', false]
  ]) {
    const values = new Map([['admin_token', token], ['admin_user', user]])
    const storage = { getItem: key => values.get(key), removeItem: key => values.delete(key) }
    assert.equal(hasAdminSession(storage), allowed)
    assert.equal(values.has('admin_token'), allowed)
  }
})
