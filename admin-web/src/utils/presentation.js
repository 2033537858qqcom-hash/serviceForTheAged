export const orderStatusText = {
  WAIT_DISPATCH: '等待安排', WAIT_ACCEPT: '等待接单', WAIT_VISIT: '待上门',
  IN_SERVICE: '服务中', WAIT_CONFIRM: '待确认', COMPLETED: '已完成',
  WAIT_MANUAL: '需要协调', CANCELLED: '已取消'
}

export function shortDate(value) {
  if (!value) return '时间待确认'
  return String(value).replace('T', ' ').slice(5, 16).replace('-', '/')
}

export function latestCandidateScores(scores = []) {
  const round = Math.max(0, ...scores.map(score => Number(score.dispatchRound) || 0))
  const candidates = new Map()
  for (const score of scores) {
    if (Number(score.dispatchRound) !== round) continue
    const key = String(score.staffId)
    const previous = candidates.get(key)
    const stamp = `${String(score.createdAt || '').replace('T', ' ')}|${String(score.id || '').padStart(24, '0')}`
    const previousStamp = previous ? `${String(previous.createdAt || '').replace('T', ' ')}|${String(previous.id || '').padStart(24, '0')}` : ''
    if (!previous || stamp > previousStamp) candidates.set(key, score)
  }
  return [...candidates.values()].sort((a, b) =>
    Number(b.isQualified) - Number(a.isQualified)
    || Number(b.totalScore) - Number(a.totalScore)
    || Number(a.travelMinutes || 0) - Number(b.travelMinutes || 0)
    || String(a.staffId).localeCompare(String(b.staffId), 'en', { numeric: true })
  )
}
