import { createRescueCompanyRows } from './rescueCompanyData.js'
import { getOrganizationById } from './organizationService.js'

const STATUS_VALUES = new Set(['ENABLED', 'DISABLED'])
const FIELD_LIMITS = Object.freeze({
  companyName: 200,
  companyCode: 32,
  companyEmail: 254,
  companyPhone: 32,
  emergencyContactName: 100,
  emergencyContactPhone: 32,
  organizationCode: 64,
  organizationName: 200,
  status: 16,
})
const DATA_FIELDS = Object.keys(FIELD_LIMITS)
const BASE_ID = 1960301000000000000n

let rows = createRescueCompanyRows()
let sequence = rows.length

export class MockHttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.code = statusCode
  }
}

const assert = (condition, statusCode, message) => {
  if (!condition) throw new MockHttpError(statusCode, message)
}
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const requireUser = (userId) =>
  assert(typeof userId === 'string' && userId.trim(), 401, '缺少当前操作人 userId')

const normalizeId = (id, field = 'id') => {
  const value = typeof id === 'bigint' ? id.toString() : String(id ?? '').trim()
  assert(/^\d+$/.test(value) && BigInt(value) > 0n, 400, `${field} 必须为大于0的整数`)
  return value
}

const assertVersion = (version) => {
  const value = Number(version)
  assert(Number.isInteger(value) && value >= 0, 400, 'version 必须为大于等于0的整数')
  return value
}
const publicRow = (row) => {
  const data = { ...row }
  delete data.deleted
  return data
}
const findRow = (id) => {
  const normalizedId = normalizeId(id)
  const row = rows.find((item) => !item.deleted && item.id === normalizedId)
  assert(row, 404, '救援公司不存在或已删除')
  return row
}
const assertUniqueCode = (companyCode, excludedId = null) => {
  assert(
    !rows.some((row) => row.companyCode === companyCode && row.id !== excludedId),
    409,
    '救援公司代码已存在',
  )
}
const normalizeField = (field, value, required = false) => {
  assert(typeof value === 'string', 400, `${field} 必须为字符串`)
  const normalized = value.trim()
  if (required) assert(normalized, 400, `${field} 不能为空`)
  assert(normalized.length <= FIELD_LIMITS[field], 400, `${field} 最多${FIELD_LIMITS[field]}个字符`)
  return normalized
}
const validateStatus = (value) => {
  assert(STATUS_VALUES.has(value), 400, 'status 仅支持 ENABLED 或 DISABLED')
  return value
}
const validateEmail = (value) => {
  if (value) assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 400, 'companyEmail 格式不正确')
  return value
}
const validateCompanyCode = (value, excludedId = null) => {
  const code = normalizeField('companyCode', value, true)
  assert(/^[A-Za-z0-9_-]{1,32}$/.test(code), 400, 'companyCode 格式不正确')
  assertUniqueCode(code, excludedId)
  return code
}

const normalizeCreateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const data = {}
  DATA_FIELDS.forEach((field) => {
    if (field === 'status') return
    data[field] = normalizeField(
      field,
      source[field] ?? '',
      ['companyName', 'companyCode'].includes(field),
    )
  })
  data.companyCode = validateCompanyCode(source.companyCode)
  data.companyEmail = validateEmail(data.companyEmail)
  data.status = validateStatus(source.status ?? 'ENABLED')
  return data
}

const normalizePatch = (source, row) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const patch = {}
  DATA_FIELDS.forEach((field) => {
    if (!Object.hasOwn(source, field) || source[field] == null) return
    if (field === 'status') patch.status = validateStatus(source.status)
    else if (field === 'companyCode') patch.companyCode = validateCompanyCode(source[field], row.id)
    else {
      const required = field === 'companyName'
      patch[field] = normalizeField(field, source[field], required)
      if (field === 'companyEmail') validateEmail(patch[field])
    }
  })
  assert(Object.keys(patch).length > 0, 400, 'data 中没有可修改字段')
  return patch
}

const validateQuery = (source) => {
  if (source == null) return { pageNum: 1, pageSize: 20 }
  assert(isPlainObject(source), 400, 'query 必须为对象')
  const query = { ...source }
  const pageNum = query.pageNum == null ? 1 : Number(query.pageNum)
  const pageSize = query.pageSize == null ? 20 : Number(query.pageSize)
  assert(Number.isInteger(pageNum) && pageNum >= 1, 400, 'pageNum 参数不正确')
  assert(Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100, 400, 'pageSize 参数不正确')
  query.pageNum = pageNum
  query.pageSize = pageSize
  DATA_FIELDS.forEach((field) => {
    if (query[field] == null || query[field] === '') return
    query[field] = normalizeField(field, query[field])
  })
  if (query.organizationId != null && query.organizationId !== '') {
    query.organizationId = normalizeId(query.organizationId, 'organizationId')
    query.organizationCode = getOrganizationById(query.organizationId).organizationCode
  }
  if (query.status) validateStatus(query.status)
  return query
}
const hasValue = (value) => value !== undefined && value !== null && value !== ''
const exact = (value, expected) => !hasValue(expected) || String(value ?? '') === expected
const fuzzy = (value, keyword) => !hasValue(keyword) || String(value ?? '').includes(keyword)
const compareIdsDesc = (left, right) => {
  const leftId = BigInt(left.id)
  const rightId = BigInt(right.id)
  return leftId === rightId ? 0 : leftId > rightId ? -1 : 1
}
const createPage = (source) => {
  const query = validateQuery(source)
  const filtered = rows
    .filter(
      (row) =>
        !row.deleted &&
        fuzzy(row.companyName, query.companyName) &&
        exact(row.companyCode, query.companyCode) &&
        fuzzy(row.companyPhone, query.companyPhone) &&
        exact(row.companyEmail, query.companyEmail) &&
        exact(row.organizationCode, query.organizationCode) &&
        fuzzy(row.organizationName, query.organizationName) &&
        exact(row.status, query.status),
    )
    .sort(compareIdsDesc)
  const start = (query.pageNum - 1) * query.pageSize
  return {
    page: query.pageNum,
    size: query.pageSize,
    total: filtered.length,
    totalSize: filtered.length,
    totalPage: Math.ceil(filtered.length / query.pageSize),
    data: filtered.slice(start, start + query.pageSize).map(publicRow),
  }
}

const deleteBatch = (ids) => {
  assert(Array.isArray(ids) && ids.length > 0, 400, 'ids 不能为空')
  assert(ids.length <= 100, 400, '单次最多删除100条数据')
  const normalizedIds = ids.map((id, index) => normalizeId(id, `ids[${index}]`))
  assert(new Set(normalizedIds).size === normalizedIds.length, 400, 'ids 不能重复')
  const targets = normalizedIds.map((id) => findRow(id))
  targets.forEach((row) => {
    row.deleted = true
  })
}

export const handleRescueCompanyAction = async (action, body = {}, userId) => {
  if (action === 'rescueCompany.page') return { data: createPage(body.query) }
  if (action === 'rescueCompany.detail') return { data: publicRow(findRow(body.id)) }

  requireUser(userId)
  if (action === 'rescueCompany.create') {
    sequence += 1
    const row = {
      id: (BASE_ID + BigInt(sequence)).toString(),
      ...normalizeCreateData(body.data),
      version: 0,
      deleted: false,
    }
    rows.push(row)
    return { data: { id: row.id, version: row.version, status: row.status } }
  }
  if (action === 'rescueCompany.update') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    Object.assign(row, normalizePatch(body.data, row))
    row.version += 1
    return { data: { id: row.id, version: row.version, status: row.status } }
  }
  if (action === 'rescueCompany.delete') {
    findRow(body.id).deleted = true
    return { data: null }
  }
  if (action === 'rescueCompany.batchDelete') {
    deleteBatch(body.ids)
    return { data: null }
  }
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
