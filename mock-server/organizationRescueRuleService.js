import { createOrganizationRescueRuleRows } from './organizationRescueRuleData.js'
import { getOrganizationById, MockHttpError } from './organizationService.js'

const BASE_ID = 1960601000000000000n
const DATA_FIELDS = new Set([
  'organizationId',
  'rescueTimes',
  'towingKilometers',
  'insuredPerson',
  'agent',
  'usageNature',
  'vehicleType',
  'maxSeats',
  'insuranceType',
  'vipFlag',
  'ruleDescription',
])
const OPTIONAL_STRING_FIELDS = [
  'insuredPerson',
  'agent',
  'usageNature',
  'vehicleType',
  'insuranceType',
  'vipFlag',
]
const STRING_LIMITS = Object.freeze({ insuredPerson: 200, agent: 200, ruleDescription: 2000 })
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
const MAX_QUERY_RANGE = 366 * 24 * 60 * 60 * 1000

let rows = createOrganizationRescueRuleRows()
let sequence = Math.max(...rows.map((row) => Number(BigInt(row.id) - BASE_ID)))

const assert = (condition, statusCode, message) => {
  if (!condition) throw new MockHttpError(statusCode, message)
}
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const requireUser = (userId) =>
  assert(typeof userId === 'string' && userId.trim(), 401, '缺少当前操作人 userId')
const normalizeId = (id, field = 'id') => {
  const value = typeof id === 'bigint' ? id.toString() : String(id ?? '').trim()
  assert(/^\d+$/.test(value) && BigInt(value) > 0n, 400, `${field} 参数不正确`)
  return value
}
const assertVersion = (version) => {
  const value = Number(version)
  assert(Number.isInteger(value) && value >= 0, 400, 'version 必须为大于等于0的整数')
  return value
}
const assertInteger = (value, field, minimum, maximum) => {
  const number = Number(value)
  assert(
    Number.isInteger(number) && number >= minimum && number <= maximum,
    400,
    `${field} 必须为${minimum}～${maximum}的整数`,
  )
  return number
}
const assertString = (value, field, required = false) => {
  assert(typeof value === 'string', 400, `${field} 必须为字符串`)
  if (required) assert(value.trim(), 400, `${field} 不能为空`)
  const limit = STRING_LIMITS[field]
  if (limit != null) assert(value.length <= limit, 400, `${field} 最多${limit}个字符`)
  return value
}
const assertOrganization = (organizationId) => {
  const id = normalizeId(organizationId, 'organizationId')
  getOrganizationById(id)
  return id
}
const assertUniqueOrganization = (organizationId, currentId = null) =>
  assert(
    !rows.some(
      (row) => !row.deleted && row.organizationId === organizationId && row.id !== currentId,
    ),
    409,
    '该机构已配置救援规则',
  )
const findRow = (id) => {
  const normalizedId = normalizeId(id)
  const row = rows.find((item) => !item.deleted && item.id === normalizedId)
  assert(row, 404, '机构救援规则不存在或已删除')
  return row
}
const publicRow = (row) => {
  const organization = getOrganizationById(row.organizationId)
  const data = { ...row, organizationCode: organization.organizationCode }
  data.organizationName = organization.organizationName
  delete data.deleted
  return data
}
const parseDateTime = (value, field) => {
  assert(typeof value === 'string', 400, `${field} 格式不正确`)
  const match = DATE_TIME_PATTERN.exec(value)
  assert(match, 400, `${field} 格式必须为 YYYY-MM-DD HH:mm:ss`)
  const parts = match.slice(1).map(Number)
  const timestamp = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
  const date = new Date(timestamp)
  assert(
    date.getUTCFullYear() === parts[0] &&
      date.getUTCMonth() === parts[1] - 1 &&
      date.getUTCDate() === parts[2] &&
      date.getUTCHours() === parts[3] &&
      date.getUTCMinutes() === parts[4] &&
      date.getUTCSeconds() === parts[5],
    400,
    `${field} 格式不正确`,
  )
  return { text: value, timestamp }
}
const currentDateTime = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

const normalizeCreateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const organizationId = assertOrganization(source.organizationId)
  assertUniqueOrganization(organizationId)
  const data = {
    organizationId,
    rescueTimes: assertInteger(source.rescueTimes, 'rescueTimes', 1, 99),
    towingKilometers: assertInteger(source.towingKilometers, 'towingKilometers', 0, 100000),
    maxSeats: source.maxSeats == null ? null : assertInteger(source.maxSeats, 'maxSeats', 1, 999),
    ruleDescription: assertString(source.ruleDescription, 'ruleDescription', true),
  }
  OPTIONAL_STRING_FIELDS.forEach((field) => {
    data[field] = assertString(source[field] ?? '', field)
  })
  return data
}
const normalizePatch = (source, row) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const patch = {}
  Object.entries(source).forEach(([field, value]) => {
    if (!DATA_FIELDS.has(field) || value == null) return
    if (field === 'organizationId') {
      patch.organizationId = assertOrganization(value)
      assertUniqueOrganization(patch.organizationId, row.id)
    } else if (field === 'rescueTimes') {
      patch.rescueTimes = assertInteger(value, field, 1, 99)
    } else if (field === 'towingKilometers') {
      patch.towingKilometers = assertInteger(value, field, 0, 100000)
    } else if (field === 'maxSeats') {
      patch.maxSeats = assertInteger(value, field, 1, 999)
    } else if (field === 'ruleDescription') {
      patch.ruleDescription = assertString(value, field, true)
    } else {
      patch[field] = assertString(value, field)
    }
  })
  assert(Object.keys(patch).length > 0, 400, 'data 中没有可修改字段')
  return patch
}

const validateQuery = (source) => {
  if (source == null) return { pageNum: 1, pageSize: 20 }
  assert(isPlainObject(source), 400, 'query 必须为对象')
  const query = { ...source }
  query.pageNum = query.pageNum == null ? 1 : Number(query.pageNum)
  query.pageSize = query.pageSize == null ? 20 : Number(query.pageSize)
  assert(Number.isInteger(query.pageNum) && query.pageNum >= 1, 400, 'pageNum 参数不正确')
  assert(
    Number.isInteger(query.pageSize) && query.pageSize >= 1 && query.pageSize <= 100,
    400,
    'pageSize 参数不正确',
  )
  ;['organizationCode', 'organizationName'].forEach((field) => {
    if (query[field] != null) query[field] = assertString(query[field], field)
  })
  const start =
    query.updateTimeStart == null || query.updateTimeStart === ''
      ? null
      : parseDateTime(query.updateTimeStart, 'updateTimeStart')
  const end =
    query.updateTimeEnd == null || query.updateTimeEnd === ''
      ? null
      : parseDateTime(query.updateTimeEnd, 'updateTimeEnd')
  if (start && end) {
    assert(end.timestamp >= start.timestamp, 400, 'updateTimeEnd 不能早于 updateTimeStart')
    assert(end.timestamp - start.timestamp <= MAX_QUERY_RANGE, 400, '修改时间范围最多366天')
  }
  query.updateTimeStart = start?.text
  query.updateTimeEnd = end?.text
  return query
}
const hasValue = (value) => value !== undefined && value !== null && value !== ''
const compareRows = (left, right) => {
  const byTime = right.updateTime.localeCompare(left.updateTime)
  if (byTime) return byTime
  const leftId = BigInt(left.id)
  const rightId = BigInt(right.id)
  return leftId === rightId ? 0 : leftId > rightId ? -1 : 1
}
const createPage = (source) => {
  const query = validateQuery(source)
  const filtered = rows
    .filter((row) => !row.deleted)
    .map(publicRow)
    .filter(
      (row) =>
        (!hasValue(query.organizationCode) || row.organizationCode === query.organizationCode) &&
        (!hasValue(query.organizationName) ||
          row.organizationName.includes(query.organizationName)) &&
        (!query.updateTimeStart || row.updateTime >= query.updateTimeStart) &&
        (!query.updateTimeEnd || row.updateTime <= query.updateTimeEnd),
    )
    .sort(compareRows)
  const start = (query.pageNum - 1) * query.pageSize
  return {
    page: query.pageNum,
    size: query.pageSize,
    total: filtered.length,
    totalSize: filtered.length,
    totalPage: Math.ceil(filtered.length / query.pageSize),
    data: filtered.slice(start, start + query.pageSize),
  }
}

const deleteBatch = (ids) => {
  assert(Array.isArray(ids) && ids.length > 0, 400, 'ids 不能为空')
  assert(ids.length <= 100, 400, '单次最多删除100条数据')
  const normalizedIds = ids.map((id, index) => normalizeId(id, `ids[${index}]`))
  assert(new Set(normalizedIds).size === normalizedIds.length, 400, 'ids 不能重复')
  const targets = normalizedIds.map(findRow)
  targets.forEach((row) => {
    row.deleted = true
  })
}

export const handleOrganizationRescueRuleAction = async (action, body = {}, userId) => {
  if (action === 'organizationRescueRule.page') return { data: createPage(body.query) }
  if (action === 'organizationRescueRule.detail') {
    if (body.organizationId != null) {
      const organizationId = normalizeId(body.organizationId, 'organizationId')
      const row = rows.find((item) => !item.deleted && item.organizationId === organizationId)
      assert(row, 404, '该机构未配置救援规则')
      return { data: publicRow(row) }
    }
    return { data: publicRow(findRow(body.id)) }
  }

  requireUser(userId)
  if (action === 'organizationRescueRule.create') {
    const data = normalizeCreateData(body.data)
    sequence += 1
    const row = {
      id: (BASE_ID + BigInt(sequence)).toString(),
      ...data,
      version: 0,
      updateTime: currentDateTime(),
      deleted: false,
    }
    rows.push(row)
    return { data: { id: row.id, version: row.version } }
  }
  if (action === 'organizationRescueRule.update') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    Object.assign(row, normalizePatch(body.data, row))
    row.version += 1
    row.updateTime = currentDateTime()
    return { data: { id: row.id, version: row.version } }
  }
  if (action === 'organizationRescueRule.delete') {
    findRow(body.id).deleted = true
    return { data: null }
  }
  if (action === 'organizationRescueRule.batchDelete') {
    deleteBatch(body.ids)
    return { data: null }
  }
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
