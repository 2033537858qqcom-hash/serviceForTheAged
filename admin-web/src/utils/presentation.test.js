import test from 'node:test'
import assert from 'node:assert/strict'
import { latestCandidateScores, shortDate } from './presentation.js'

test('only the latest dispatch round is presented and qualified candidates come first', () => {
  const rows = [
    { id: '1', staffId: 'a', dispatchRound: 1, isQualified: 1, totalScore: 0.99 },
    { id: '2', staffId: 'b', dispatchRound: 2, isQualified: 0, totalScore: 0.95 },
    { id: '3', staffId: 'c', dispatchRound: 2, isQualified: 1, totalScore: 0.7 },
    { id: '4', staffId: 'd', dispatchRound: 2, isQualified: 1, totalScore: 0.85 }
  ]
  assert.deepEqual(
    latestCandidateScores(rows).map(row => row.staffId),
    ['d', 'c', 'b']
  )
  assert.equal(rows[0].staffId, 'a')
})

test('recalculated history uses the newest score for each staff member', () => {
  const rows = [
    { id: '90', staffId: 'a', dispatchRound: 2, createdAt: '2026-10-20T10:00:00', totalScore: 0.9 },
    { id: '91', staffId: 'a', dispatchRound: 2, createdAt: '2026-10-20 11:00:00', totalScore: 0.5 },
    { id: '92', staffId: 'b', dispatchRound: 2, createdAt: '2026-10-20 11:00:00', totalScore: 0.7 }
  ]
  assert.equal(latestCandidateScores(rows).find(row => row.staffId === 'a').id, '91')
})

test('string IDs larger than the JavaScript integer range remain distinct', () => {
  const rows = [
    { id: '9223372036854775805', staffId: '9007199254740992', dispatchRound: 1 },
    { id: '9223372036854775806', staffId: '9007199254740993', dispatchRound: 1 },
    { id: '9223372036854775807', staffId: '9007199254740992', dispatchRound: 1 }
  ]
  assert.equal(latestCandidateScores(rows).length, 2)
  assert.equal(latestCandidateScores(rows).find(row => row.staffId === '9007199254740992').id, '9223372036854775807')
})

test('empty scores and missing dates have explicit fallbacks', () => {
  assert.deepEqual(latestCandidateScores([]), [])
  assert.equal(shortDate(null), '时间待确认')
  assert.equal(shortDate('2026-10-20T09:30:00'), '10/20 09:30')
})

test('equal scores use travel time and staff ID to keep recommendations stable', () => {
  const rows = [
    { id: '1', staffId: '12', dispatchRound: 1, isQualified: 1, totalScore: 0.8, travelMinutes: 5 },
    { id: '2', staffId: '2', dispatchRound: 1, isQualified: 1, totalScore: 0.8, travelMinutes: 5 },
    { id: '3', staffId: '1', dispatchRound: 1, isQualified: 1, totalScore: 0.8, travelMinutes: 10 }
  ]
  assert.deepEqual(
    latestCandidateScores(rows).map(row => row.staffId),
    ['2', '12', '1']
  )
})
