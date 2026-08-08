import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createHealthInsuranceRows } from './healthInsuranceData.js'

const DATA_FIELDS = [
  'insuredName',
  'idCardNo',
  'reportTime',
  'policyNo',
  'accidentTime',
  'accidentLocation',
  'incidentDescription',
  'reporterName',
  'reporterPhone',
  'reporterEmail',
  'recorderName',
  'approvalStatus',
]
const FIELD_LIMITS = {
  insuredName: 100,
  accidentLocation: 500,
  incidentDescription: 2000,
  reporterName: 100,
  reporterEmail: 254,
  recorderName: 100,
}
const QUERY_LIMITS = {
  reportNo: 32,
  insuredName: 100,
  idCardNo: 18,
  policyNo: 50,
  reporterName: 100,
  reporterPhone: 20,
  recorderName: 100,
}
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const ID_CARD_PATTERN = /^\d{17}[\dXx]$/
const POLICY_PATTERN = /^[A-Za-z0-9-]{1,50}$/
const PHONE_PATTERN = /^[0-9 +()-]{7,20}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GMT8_OFFSET = 8 * 60 * 60 * 1000
const MAX_QUERY_RANGE = 366 * 24 * 60 * 60 * 1000
const WRITE_ACTIONS = new Set([
  'accidentHealth.create',
  'accidentHealth.update',
  'accidentHealth.delete',
  'accidentHealth.batchDelete',
])

let rows = createHealthInsuranceRows()
let sequence = rows.length

class MockHttpError extends Error {
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

const normalizeId = (id, field = 'id') => {
  const value = typeof id === 'bigint' ? id.toString() : String(id ?? '')
  assert(/^\d+$/.test(value) && BigInt(value) > 0n, 400, `${field} 必须为大于0的整数`)
  return value
}

const parseDateTime = (value, label) => {
  assert(DATE_TIME_PATTERN.test(value), 400, `${label}格式不正确`)
  const [year, month, day, hour, minute, second] = value.split(/[- :]/).map(Number)
  const timestamp = Date.UTC(year, month - 1, day, hour - 8, minute, second)
  const local = new Date(timestamp + GMT8_OFFSET)
  const valid =
    local.getUTCFullYear() === year &&
    local.getUTCMonth() === month - 1 &&
    local.getUTCDate() === day &&
    local.getUTCHours() === hour &&
    local.getUTCMinutes() === minute &&
    local.getUTCSeconds() === second
  assert(valid, 400, `${label}格式不正确`)
  return timestamp
}

const validateField = (field, value) => {
  assert(typeof value === 'string', 400, `${field} 必须为字符串`)
  if (!value) return
  if (FIELD_LIMITS[field]) {
    assert(value.length <= FIELD_LIMITS[field], 400, `${field} 最多${FIELD_LIMITS[field]}个字符`)
  }
  if (field === 'idCardNo') assert(ID_CARD_PATTERN.test(value), 400, '身份证号应为18位')
  if (field === 'policyNo') {
    assert(POLICY_PATTERN.test(value), 400, '保单号仅支持字母、数字和连字符')
  }
  if (field === 'reporterPhone') {
    assert(PHONE_PATTERN.test(value), 400, '报案人电话格式不正确')
  }
  if (field === 'reporterEmail') {
    assert(value.length <= 254 && EMAIL_PATTERN.test(value), 400, '报案人邮箱格式不正确')
  }
  if (field === 'reportTime' || field === 'accidentTime') {
    const label = field === 'reportTime' ? '报案时间' : '出险时间'
    const timestamp = parseDateTime(value, label)
    assert(timestamp <= Date.now(), 400, `${label}不能晚于当前时间`)
  }
}

const assertTimeOrder = (data) => {
  if (!data.reportTime || !data.accidentTime) return
  assert(
    parseDateTime(data.accidentTime, '出险时间') <= parseDateTime(data.reportTime, '报案时间'),
    400,
    '出险时间不能晚于报案时间',
  )
}

const normalizeCreateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  assert(!Object.hasOwn(source, 'reportNo'), 400, 'reportNo 由服务端生成，不可指定')
  const data = {}
  DATA_FIELDS.forEach((field) => {
    const value =
      field === 'approvalStatus' && source[field] == null
        ? 'PENDING'
        : source[field] == null
          ? ''
          : source[field]
    validateField(field, value)
    data[field] = value
  })
  assertTimeOrder(data)
  return data
}

const normalizeUpdateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  assert(!Object.hasOwn(source, 'reportNo'), 400, 'reportNo 不可修改')
  const unsupported = Object.keys(source).find((field) => !DATA_FIELDS.includes(field))
  assert(!unsupported, 400, `不支持修改字段：${unsupported}`)
  const data = {}
  DATA_FIELDS.forEach((field) => {
    if (Object.hasOwn(source, field) && source[field] !== null) {
      validateField(field, source[field])
      data[field] = source[field]
    }
  })
  if (Object.hasOwn(data, 'reportTime') && Object.hasOwn(data, 'accidentTime')) {
    assertTimeOrder(data)
  }
  return data
}

const publicRow = (row) => {
  const data = { ...row }
  delete data.deleted
  return data
}

const findRow = (id) => {
  const normalizedId = normalizeId(id)
  const row = rows.find((item) => !item.deleted && String(item.id) === normalizedId)
  assert(row, 404, '意健险报案不存在或已删除')
  return row
}

const validateQuery = (source) => {
  if (source == null) return { pageNum: 1, pageSize: 20 }
  assert(isPlainObject(source), 400, 'query 必须为对象')
  const query = { ...source }

  const parsePageValue = (field, defaultValue, min, max = Number.MAX_SAFE_INTEGER) => {
    if (query[field] == null) return defaultValue
    const value = Number(query[field])
    assert(Number.isInteger(value) && value >= min && value <= max, 400, `${field} 参数不正确`)
    return value
  }
  query.pageNum = parsePageValue('pageNum', 1, 1)
  query.pageSize = parsePageValue('pageSize', 20, 1, 100)

  Object.entries(QUERY_LIMITS).forEach(([field, maxLength]) => {
    if (query[field] == null) return
    assert(typeof query[field] === 'string', 400, `${field} 必须为字符串`)
    assert(query[field].length <= maxLength, 400, `${field} 最多${maxLength}个字符`)
  })
  if (query.approvalStatus !== undefined && query.approvalStatus !== null) {
    assert(typeof query.approvalStatus === 'string', 400, 'approvalStatus 必须为字符串')
  }

  const start = query.reportTimeStart ? parseDateTime(query.reportTimeStart, '报案开始时间') : null
  const end = query.reportTimeEnd ? parseDateTime(query.reportTimeEnd, '报案结束时间') : null
  if (start !== null && end !== null) {
    assert(start <= end, 400, '报案开始时间不能晚于结束时间')
    assert(end - start <= MAX_QUERY_RANGE, 400, '报案时间范围不能超过366天')
  }
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
        exact(row.reportNo, query.reportNo) &&
        fuzzy(row.insuredName, query.insuredName) &&
        exact(row.idCardNo, query.idCardNo) &&
        exact(row.policyNo, query.policyNo) &&
        (query.approvalStatus == null || row.approvalStatus === query.approvalStatus) &&
        (!query.reportTimeStart || row.reportTime >= query.reportTimeStart) &&
        (!query.reportTimeEnd || row.reportTime <= query.reportTimeEnd) &&
        fuzzy(row.reporterName, query.reporterName) &&
        exact(row.reporterPhone, query.reporterPhone) &&
        fuzzy(row.recorderName, query.recorderName),
    )
    .sort((left, right) => {
      const byTime = String(right.reportTime ?? '').localeCompare(String(left.reportTime ?? ''))
      return byTime || compareIdsDesc(left, right)
    })

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

const pad = (value, length = 2) => String(value).padStart(length, '0')
const getGmt8DateParts = () => {
  const date = new Date(Date.now() + GMT8_OFFSET)
  return {
    year: date.getUTCFullYear(),
    month: pad(date.getUTCMonth() + 1),
    day: pad(date.getUTCDate()),
    hour: pad(date.getUTCHours()),
    minute: pad(date.getUTCMinutes()),
    second: pad(date.getUTCSeconds()),
  }
}

const createIdentifiers = () => {
  sequence += 1
  const part = getGmt8DateParts()
  const stamp = `${part.year}${part.month}${part.day}${part.hour}${part.minute}${part.second}`
  return {
    id: (1959912345678900000n + BigInt(sequence)).toString(),
    reportNo: `AH${stamp}${pad(sequence, 6)}`,
  }
}

const createExport = async (id) => {
  const row = findRow(id)
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('意健险报案登记表')
  worksheet.columns = [
    { header: '报案号', key: 'reportNo', width: 28 },
    { header: '被保险人', key: 'insuredName', width: 16 },
    { header: '身份证号', key: 'idCardNo', width: 22 },
    { header: '报案时间', key: 'reportTime', width: 22 },
    { header: '保单号', key: 'policyNo', width: 24 },
    { header: '出险时间', key: 'accidentTime', width: 22 },
    { header: '出险地点', key: 'accidentLocation', width: 30 },
    { header: '出险经过', key: 'incidentDescription', width: 45 },
    { header: '报案人', key: 'reporterName', width: 16 },
    { header: '报案人电话', key: 'reporterPhone', width: 18 },
    { header: '报案人邮箱', key: 'reporterEmail', width: 28 },
    { header: '报案记录人', key: 'recorderName', width: 16 },
    { header: '状态', key: 'approvalStatus', width: 14 },
  ]
  worksheet.addRow(publicRow(row))
  worksheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return {
    file: Buffer.from(buffer),
    filename: `意健险报案-${row.reportNo}.xlsx`,
  }
}

const assertVersion = (version) => {
  const value = Number(version)
  assert(Number.isInteger(value) && value >= 0, 400, 'version 必须为大于等于0的整数')
  return value
}

const deleteBatch = (ids) => {
  assert(Array.isArray(ids) && ids.length >= 1 && ids.length <= 100, 400, 'ids 每次需传1～100个')
  const normalizedIds = ids.map((id) => normalizeId(id, 'ids'))
  assert(new Set(normalizedIds).size === normalizedIds.length, 400, 'ids 不得重复')
  const targetRows = normalizedIds.map((id) => findRow(id))
  targetRows.forEach((row) => {
    row.deleted = true
  })
}

export const handleHealthInsuranceAction = async (action, body = {}, userId) => {
  if (WRITE_ACTIONS.has(action)) assert(userId, 401, '缺少当前操作人 userId')

  if (action === 'accidentHealth.page') return { data: createPage(body.query) }
  if (action === 'accidentHealth.detail') return { data: publicRow(findRow(body.id)) }
  if (action === 'accidentHealth.create') {
    const row = {
      ...createIdentifiers(),
      ...normalizeCreateData(body.data),
      version: 0,
      deleted: false,
    }
    rows.push(row)
    return { data: { id: row.id, reportNo: row.reportNo, approvalStatus: row.approvalStatus } }
  }
  if (action === 'accidentHealth.update') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    Object.assign(row, normalizeUpdateData(body.data))
    row.version += 1
    return { data: { id: row.id, version: row.version, approvalStatus: row.approvalStatus } }
  }
  if (action === 'accidentHealth.delete') {
    findRow(body.id).deleted = true
    return { data: null }
  }
  if (action === 'accidentHealth.batchDelete') {
    deleteBatch(body.ids)
    return { data: null }
  }
  if (action === 'accidentHealth.export') return createExport(body.id)
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
