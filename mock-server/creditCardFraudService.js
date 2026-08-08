import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createCreditCardFraudRows } from './creditCardFraudData.js'

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const SUBMITTABLE_STATUSES = new Set(['DRAFT', 'REJECTED'])
const DATA_FIELDS = [
  'cardNo',
  'reportTime',
  'policyNo',
  'reported',
  'insuredName',
  'idCardNo',
  'lossReportTime',
  'fraudTime',
  'fraudAmount',
  'currency',
  'fraudLocation',
  'fraudCount',
  'incidentDescription',
  'reporterName',
  'reporterPhone',
  'reporterEmail',
  'recorderName',
  'approvalStatus',
]
const STRING_LIMITS = {
  cardNo: 32,
  policyNo: 50,
  insuredName: 100,
  currency: 16,
  fraudLocation: 200,
  incidentDescription: 2000,
  reporterName: 100,
  reporterEmail: 254,
  recorderName: 100,
}
const QUERY_STRING_FIELDS = [
  'insuredName',
  'idCardNo',
  'cardNo',
  'approvalStatus',
  'reportTimeStart',
  'reportTimeEnd',
  'reporterName',
  'reporterPhone',
  'recorderName',
]

let rows = createCreditCardFraudRows()
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
const assertVersion = (version) => {
  assert(Number.isInteger(version) && version >= 0, 400, 'version 必须为大于等于0的整数')
  return version
}
const hasOwn = (object, field) => Object.prototype.hasOwnProperty.call(object, field)
const hasValue = (value) => value !== undefined && value !== null && value !== ''
const requireUser = (userId) =>
  assert(typeof userId === 'string' && userId.trim(), 401, '缺少当前操作人 userId')

const parseDateTime = (value, field) => {
  assert(typeof value === 'string' && DATE_TIME_PATTERN.test(value), 400, `${field} 格式不正确`)
  const [year, month, day, hour, minute, second] = value.split(/[- :]/).map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  assert(
    date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second,
    400,
    `${field} 格式不正确`,
  )
  return date
}

const validateString = (data, field, maxLength) => {
  if (!hasValue(data[field])) return
  assert(typeof data[field] === 'string', 400, `${field} 必须是字符串`)
  assert(data[field].length <= maxLength, 400, `${field} 最多${maxLength}个字符`)
}

const validateData = (data) => {
  Object.entries(STRING_LIMITS).forEach(([field, maxLength]) =>
    validateString(data, field, maxLength),
  )
  validateString(data, 'approvalStatus', Number.MAX_SAFE_INTEGER)

  if (hasValue(data.cardNo)) {
    assert(/^[A-Za-z0-9-]+$/.test(data.cardNo), 400, 'cardNo 仅支持字母、数字和连字符')
  }
  if (hasValue(data.idCardNo)) {
    assert(
      typeof data.idCardNo === 'string' && /^\d{17}[\dXx]$/.test(data.idCardNo),
      400,
      'idCardNo 应为18位身份证号',
    )
  }
  if (hasValue(data.reported)) {
    assert(typeof data.reported === 'boolean', 400, 'reported 只能是 Boolean')
  }
  if (hasValue(data.reporterPhone)) {
    assert(typeof data.reporterPhone === 'string', 400, 'reporterPhone 必须是字符串')
    assert(
      data.reporterPhone.length >= 7 && data.reporterPhone.length <= 20,
      400,
      'reporterPhone 长度应为7～20个字符',
    )
  }
  if (hasValue(data.fraudAmount)) {
    assert(
      typeof data.fraudAmount === 'number' &&
        Number.isFinite(data.fraudAmount) &&
        data.fraudAmount > 0,
      400,
      'fraudAmount 必须是大于0的有限 JSON Number',
    )
  }
  if (hasValue(data.fraudCount)) {
    assert(
      typeof data.fraudCount === 'number' &&
        Number.isInteger(data.fraudCount) &&
        data.fraudCount >= 1,
      400,
      'fraudCount 必须是大于等于1的 Integer',
    )
  }

  const reportTime = hasValue(data.reportTime) ? parseDateTime(data.reportTime, 'reportTime') : null
  const lossReportTime = hasValue(data.lossReportTime)
    ? parseDateTime(data.lossReportTime, 'lossReportTime')
    : null
  const fraudTime = hasValue(data.fraudTime) ? parseDateTime(data.fraudTime, 'fraudTime') : null

  if (reportTime) assert(reportTime.getTime() <= Date.now(), 400, 'reportTime 不能晚于当前时间')
  if (reportTime && lossReportTime) {
    assert(lossReportTime <= reportTime, 400, 'lossReportTime 不能晚于 reportTime')
  }
  if (reportTime && fraudTime) {
    assert(fraudTime <= reportTime, 400, 'fraudTime 不能晚于 reportTime')
  }
}

const requireDataObject = (source) => {
  assert(source && typeof source === 'object' && !Array.isArray(source), 400, 'data 不能为空')
  return source
}

const createData = (source) => {
  requireDataObject(source)
  const data = Object.fromEntries(
    DATA_FIELDS.map((field) => {
      if (field === 'approvalStatus' && !hasOwn(source, field)) return [field, 'PENDING']
      return [field, hasOwn(source, field) ? source[field] : null]
    }),
  )
  validateData(data)
  return data
}

const createPatch = (source) => {
  requireDataObject(source)
  return Object.fromEntries(
    DATA_FIELDS.filter((field) => hasOwn(source, field) && source[field] !== null).map((field) => [
      field,
      source[field],
    ]),
  )
}

const requireId = (id) =>
  assert(id !== undefined && id !== null && String(id) !== '', 400, 'id 不能为空')
const findRow = (id) => {
  requireId(id)
  const row = rows.find((item) => String(item.id) === String(id))
  assert(row, 404, '信用卡盗用登记不存在')
  return row
}

const normalizeQuery = (source) => {
  if (source === undefined || source === null) return { pageNum: 1, pageSize: 20 }
  assert(typeof source === 'object' && !Array.isArray(source), 400, 'query 必须是对象')
  QUERY_STRING_FIELDS.forEach((field) => {
    if (hasValue(source[field])) {
      assert(typeof source[field] === 'string', 400, `${field} 必须是字符串`)
    }
  })

  const pageNum =
    source.pageNum === undefined || source.pageNum === null || source.pageNum === ''
      ? 1
      : source.pageNum
  const pageSize =
    source.pageSize === undefined || source.pageSize === null || source.pageSize === ''
      ? 20
      : source.pageSize
  assert(Number.isInteger(pageNum) && pageNum >= 1, 400, 'pageNum 必须是大于等于1的整数')
  assert(
    Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100,
    400,
    'pageSize 必须是1～100的整数',
  )

  const start = hasValue(source.reportTimeStart)
    ? parseDateTime(source.reportTimeStart, 'reportTimeStart')
    : null
  const end = hasValue(source.reportTimeEnd)
    ? parseDateTime(source.reportTimeEnd, 'reportTimeEnd')
    : null
  if (start && end) {
    assert(start <= end, 400, 'reportTimeStart 不能晚于 reportTimeEnd')
    assert(end - start <= 366 * DAY_IN_MILLISECONDS, 400, '报案时间查询范围不能超过366天')
  }
  return { ...source, pageNum, pageSize }
}

const queryHasValue = (query, field) => hasValue(query[field])
const contains = (value, query, field) =>
  !queryHasValue(query, field) || String(value ?? '').includes(query[field])
const equals = (value, query, field) => !queryHasValue(query, field) || value === query[field]
const inRange = (value, query) =>
  (!queryHasValue(query, 'reportTimeStart') || value >= query.reportTimeStart) &&
  (!queryHasValue(query, 'reportTimeEnd') || value <= query.reportTimeEnd)

const filterRows = (query) =>
  rows.filter(
    (row) =>
      contains(row.insuredName, query, 'insuredName') &&
      equals(row.idCardNo, query, 'idCardNo') &&
      equals(row.cardNo, query, 'cardNo') &&
      equals(row.approvalStatus, query, 'approvalStatus') &&
      inRange(row.reportTime, query) &&
      contains(row.reporterName, query, 'reporterName') &&
      equals(row.reporterPhone, query, 'reporterPhone') &&
      contains(row.recorderName, query, 'recorderName'),
  )

const createPage = (source) => {
  const query = normalizeQuery(source)
  const filtered = filterRows(query)
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

const pad = (value, length = 2) => String(value).padStart(length, '0')
const createIdentifiers = () => {
  sequence += 1
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return {
    id: (2939912345678900000n + BigInt(sequence)).toString(),
    reportNo: `CCF${stamp}${pad(sequence, 6)}`,
  }
}

const createExport = async (source) => {
  const query = normalizeQuery(source)
  const exportRows = filterRows(query).slice(0, 10000)
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('信用卡盗用登记')
  worksheet.columns = [
    { header: '登记ID', key: 'id', width: 22 },
    { header: '报案号', key: 'reportNo', width: 28 },
    { header: '信用卡号', key: 'cardNo', width: 24 },
    { header: '报案时间', key: 'reportTime', width: 22 },
    { header: '保单号', key: 'policyNo', width: 28 },
    { header: '是否报案', key: 'reported', width: 12 },
    { header: '被保险人', key: 'insuredName', width: 16 },
    { header: '身份证号', key: 'idCardNo', width: 22 },
    { header: '挂失时间', key: 'lossReportTime', width: 22 },
    { header: '盗用时间', key: 'fraudTime', width: 22 },
    { header: '盗用金额', key: 'fraudAmount', width: 16 },
    { header: '盗用币种', key: 'currency', width: 12 },
    { header: '盗用地点', key: 'fraudLocation', width: 24 },
    { header: '盗用次数', key: 'fraudCount', width: 12 },
    { header: '事故经过', key: 'incidentDescription', width: 45 },
    { header: '报案人', key: 'reporterName', width: 16 },
    { header: '报案人电话', key: 'reporterPhone', width: 20 },
    { header: '报案人邮箱', key: 'reporterEmail', width: 28 },
    { header: '报案记录人', key: 'recorderName', width: 16 },
    { header: '审核状态', key: 'approvalStatus', width: 16 },
  ]
  worksheet.addRows(exportRows)
  worksheet.getRow(1).font = { bold: true }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  const buffer = await workbook.xlsx.writeBuffer()
  return { file: Buffer.from(buffer), filename: '信用卡盗用登记.xlsx' }
}

export const handleCreditCardFraudAction = async (action, body = {}, userId) => {
  if (action === 'creditCardFraud.page') return { data: createPage(body.query) }
  if (action === 'creditCardFraud.detail') return { data: { ...findRow(body.id) } }
  if (action === 'creditCardFraud.export') {
    assert(body.id !== undefined && body.id !== null && String(body.id).trim(), 400, 'id 不能为空')
    return createExport({ id: body.id })
  }

  if (action === 'creditCardFraud.create') {
    requireUser(userId)
    const data = createData(body.data)
    const row = { ...createIdentifiers(), ...data, version: 0 }
    rows.unshift(row)
    return { data: { id: row.id, reportNo: row.reportNo, approvalStatus: row.approvalStatus } }
  }
  if (action === 'creditCardFraud.update') {
    requireUser(userId)
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    const patch = createPatch(body.data)
    validateData({ ...row, ...patch })
    Object.assign(row, patch)
    row.version += 1
    return {
      data: { id: row.id, version: row.version, approvalStatus: row.approvalStatus },
    }
  }
  if (action === 'creditCardFraud.delete') {
    requireUser(userId)
    const row = findRow(body.id)
    rows = rows.filter((item) => item !== row)
    return { data: null }
  }
  if (action === 'creditCardFraud.batchDelete') {
    requireUser(userId)
    assert(Array.isArray(body.ids) && body.ids.length > 0, 400, 'ids 不能为空')
    assert(body.ids.length <= 100, 400, '单次最多删除100条数据')
    const ids = new Set(body.ids.map(String))
    rows = rows.filter((row) => !ids.has(String(row.id)))
    return { data: null }
  }
  if (action === 'creditCardFraud.submit') {
    requireUser(userId)
    const row = findRow(body.id)
    assert(SUBMITTABLE_STATUSES.has(row.approvalStatus), 409, '当前状态不允许提交审批')
    row.approvalStatus = 'PENDING'
    row.approvalRemark = ''
    return { data: null }
  }
  if (action === 'creditCardFraud.approve' || action === 'creditCardFraud.reject') {
    requireUser(userId)
    const row = findRow(body.id)
    assert(row.approvalStatus === 'PENDING', 409, '仅待审批记录可以审核')
    const remark = String(body.remark ?? '').trim()
    assert(remark.length <= 500, 400, '审批意见最多500个字符')
    if (action === 'creditCardFraud.reject') assert(remark, 400, '驳回原因不能为空')
    row.approvalStatus = action === 'creditCardFraud.approve' ? 'APPROVED' : 'REJECTED'
    row.approvalRemark = remark
    return { data: null }
  }

  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
