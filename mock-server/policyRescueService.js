import { createPolicyRescueRows } from './policyRescueData.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const DATA_FIELDS = [
  'serviceCount',
  'serviceMileage',
  'accidentType',
  'workOrderNo',
  'callTime',
  'callerName',
  'callerPhone',
  'policyNo',
  'organization',
  'reportNo',
  'insuredName',
  'idCardNo',
  'policyStartDate',
  'policyEndDate',
  'plateNo',
  'engineNo',
  'vehicleModel',
  'vehicleType',
  'seatCount',
  'vehicleColor',
  'customerType',
  'isNewOrder',
  'rescueObject',
  'contactName',
  'contactPhone',
  'rescueRules',
  'rescueProvince',
  'rescueCity',
  'rescueDistrict',
  'detailedAddress',
  'freeMileage',
  'dispatcher',
  'serviceType',
  'rescueDate',
  'repairRequired',
  'serviceDestination',
  'recorderName',
  'employeeNo',
  'remark',
]

const REQUIRED_FIELDS = [
  'accidentType',
  'callerName',
  'callerPhone',
  'policyNo',
  'organization',
  'reportNo',
  'insuredName',

  'seatCount',
  'isNewOrder',
  'rescueObject',
  'contactName',
  'contactPhone',
  'rescueProvince',
  'rescueCity',
  'rescueDistrict',
  'detailedAddress',
  'dispatcher',
  'serviceType',
  'repairRequired',
]

let rows = createPolicyRescueRows()
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
const requireUser = (userId) => assert(userId, 401, '缺少当前操作人 userId')
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value)

const normalizeData = (source) => {
  assert(source && typeof source === 'object' && !Array.isArray(source), 400, 'data 不能为空')
  const data = Object.fromEntries(
    DATA_FIELDS.map((field) => [field, normalizeString(source[field]) ?? '']),
  )
  data.plateNo = String(data.plateNo).toUpperCase()
  data.idCardNo = String(data.idCardNo).toUpperCase()
  REQUIRED_FIELDS.forEach((field) => assert(data[field] !== '', 400, `${field} 不能为空`))
  assert(!data.callTime || DATETIME_PATTERN.test(data.callTime), 400, '来电时间格式不正确')
  ;['policyStartDate', 'policyEndDate', 'rescueDate'].forEach((field) => {
    assert(!data[field] || DATE_PATTERN.test(data[field]), 400, `${field} 格式不正确`)
  })
  assert(!data.idCardNo || /^\d{17}[\dX]$/.test(data.idCardNo), 400, '身份证号格式不正确')
  assert(/^1\d{10}$|^[\d-]{7,20}$/.test(data.callerPhone), 400, '来电号码格式不正确')
  assert(/^1\d{10}$|^[\d-]{7,20}$/.test(data.contactPhone), 400, '联系电话格式不正确')
  assert(data.remark.length <= 500, 400, '备注最多500个字符')
  assert(data.rescueRules.length <= 1000, 400, '救援规则最多1000个字符')
  return data
}

const findRow = (id) => {
  const row = rows.find((item) => String(item.id) === String(id ?? ''))
  assert(row, 404, '救援登记不存在')
  return row
}
const contains = (value, keyword) =>
  !keyword || String(value ?? '').includes(String(keyword).trim())
const inRange = (value, start, end) => (!start || value >= start) && (!end || value <= end)

const filterRows = (query = {}) =>
  rows.filter(
    (row) =>
      contains(row.plateNo, query.plateNo && String(query.plateNo).toUpperCase()) &&
      contains(row.engineNo, query.engineNo) &&
      contains(row.insuredName, query.insuredName) &&
      contains(row.idCardNo, query.idCardNo && String(query.idCardNo).toUpperCase()) &&
      contains(row.policyNo, query.policyNo) &&
      contains(row.callerPhone, query.callerPhone) &&
      inRange(row.rescueDate, query.rescueStartDate, query.rescueEndDate),
  )

const createPage = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.pageNum, 10) || 1)
  const size = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 10))
  const filtered = filterRows(query)
  const start = (page - 1) * size
  return {
    page,
    size,
    total: filtered.length,
    totalSize: filtered.length,
    totalPage: Math.ceil(filtered.length / size),
    data: filtered.slice(start, start + size),
  }
}

const pad = (value, length = 2) => String(value).padStart(length, '0')
const createIdentifiers = () => {
  sequence += 1
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return {
    id: (1948812345678900000n + BigInt(sequence)).toString(),
    workOrderNo: `救援${stamp}${pad(sequence, 4)}`,
  }
}

export const handlePolicyRescueAction = async (action, body = {}, userId) => {
  if (action === 'policyRescue.page') return { data: createPage(body.query) }
  if (action === 'policyRescue.detail') return { data: { ...findRow(body.id) } }

  requireUser(userId)
  if (action === 'policyRescue.create') {
    const data = normalizeData(body.data)
    const identifiers = createIdentifiers()
    const row = { ...data, ...identifiers, version: 0 }
    rows.unshift(row)
    return { data: { id: row.id, workOrderNo: row.workOrderNo, version: row.version } }
  }
  if (action === 'policyRescue.update') {
    const row = findRow(body.id)
    const version = Number(body.version)
    assert(Number.isInteger(version) && version >= 0, 400, 'version 必须为大于等于0的整数')
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    Object.assign(row, normalizeData(body.data))
    row.version += 1
    return { data: { id: row.id, version: row.version } }
  }
  if (action === 'policyRescue.delete') {
    const row = findRow(body.id)
    rows = rows.filter((item) => item !== row)
    return { data: null }
  }
  if (action === 'policyRescue.batchDelete') {
    assert(Array.isArray(body.ids) && body.ids.length > 0, 400, 'ids 不能为空')
    assert(body.ids.length <= 100, 400, '单次最多删除100条数据')
    const ids = new Set(body.ids.map(String))
    body.ids.forEach((id) => findRow(id))
    rows = rows.filter((row) => !ids.has(String(row.id)))
    return { data: null }
  }
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
