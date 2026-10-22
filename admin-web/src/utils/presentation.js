// 后台所有状态/分类/技能文案与标签颜色的唯一来源（C2）
const ORDER = {
  WAIT_DISPATCH: ['等待安排', 'warning'],
  WAIT_ACCEPT: ['等待接单', 'warning'],
  WAIT_VISIT: ['待上门', 'primary'],
  IN_SERVICE: ['服务中', 'primary'],
  WAIT_CONFIRM: ['待确认', 'warning'],
  COMPLETED: ['已完成', 'success'],
  WAIT_MANUAL: ['需要协调', 'danger'],
  CANCELLED: ['已取消', 'info']
}
const BINDING = {
  PENDING: ['待审核', 'warning'],
  APPROVED: ['已授权', 'success'],
  REJECTED: ['已驳回', 'danger'],
  REVOKED: ['已撤销', 'info']
}
const COMPLAINT = {
  PENDING: ['待受理', 'warning'],
  PROCESSING: ['处理中', 'primary'],
  RESOLVED: ['已处理', 'success'],
  REJECTED: ['已关闭', 'info']
}
const STAFF_WORK = { AVAILABLE: ['接单中', 'success'], BUSY: ['服务中', 'warning'], RESTING: ['休息中', 'info'] }
const STAFF_AUDIT = { APPROVED: ['已通过', 'success'], PENDING: ['待审核', 'warning'], REJECTED: ['未通过', 'danger'] }
const SERVICE_STATUS = { ON_SHELF: ['上架中', 'success'], OFF_SHELF: ['已下架', 'info'] }
const SHIFT = { ACTIVE: ['有效', 'success'], CANCELLED: ['已取消', 'info'] }
const CATEGORY = {
  MEAL: ['助餐送餐', 'warning'],
  CLEANING: ['居家保洁', 'primary'],
  ERRAND: ['代买代办', 'success'],
  ESCORT: ['陪同办事', 'info']
}

export const STATUS_KINDS = {
  order: ORDER,
  binding: BINDING,
  complaint: COMPLAINT,
  staffWork: STAFF_WORK,
  staffAudit: STAFF_AUDIT,
  service: SERVICE_STATUS,
  shift: SHIFT,
  category: CATEGORY
}

export const SKILLS = {
  COOKING: '助餐烹饪',
  CLEANING: '居家保洁',
  ERRAND: '跑腿代办',
  ESCORT: '助行陪办',
  NURSING: '基础照护护理'
}

export function statusText(kind, value) {
  return STATUS_KINDS[kind]?.[value]?.[0] || value || ''
}

export function statusTag(kind, value) {
  return STATUS_KINDS[kind]?.[value]?.[1] || 'info'
}

// 下拉选项：[{ label, value }]
export function statusOptions(kind) {
  return Object.entries(STATUS_KINDS[kind] || {}).map(([value, [label]]) => ({ label, value }))
}

export function skillText(codes) {
  return String(codes || '')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)
    .map(code => SKILLS[code] || code)
    .join('、')
}

// 兼容已有调用（dispatch / dashboard）
export const orderStatusText = Object.fromEntries(Object.entries(ORDER).map(([key, [text]]) => [key, text]))

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
    const previousStamp = previous
      ? `${String(previous.createdAt || '').replace('T', ' ')}|${String(previous.id || '').padStart(24, '0')}`
      : ''
    if (!previous || stamp > previousStamp) candidates.set(key, score)
  }
  return [...candidates.values()].sort(
    (a, b) =>
      Number(b.isQualified) - Number(a.isQualified) ||
      Number(b.totalScore) - Number(a.totalScore) ||
      Number(a.travelMinutes || 0) - Number(b.travelMinutes || 0) ||
      String(a.staffId).localeCompare(String(b.staffId), 'en', { numeric: true })
  )
}
