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

import { safeRedirect, saveSession, getToken, getUser, clearSession } from './admin-session.js'
test('redirect after login only accepts in-site paths', () => {
  assert.equal(safeRedirect('/orders?status=WAIT_MANUAL'), '/orders?status=WAIT_MANUAL')
  for (const bad of ['//evil.com', 'https://evil.com', '/login', '/login?redirect=/x', '/\\evil', undefined, 5]) assert.equal(safeRedirect(bad), '')
  assert.equal(safeRedirect(['/elders']), '/elders')
})
test('session helpers save, read and clear in one place', () => {
  const values = new Map()
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  saveSession({ token: 't', userInfo: { role: 'ADMIN', realName: '王' } }, storage)
  assert.equal(getToken(storage), 't')
  assert.equal(getUser(storage).realName, '王')
  clearSession(storage)
  assert.equal(getToken(storage), '')
  assert.equal(getUser(storage), null)
})
