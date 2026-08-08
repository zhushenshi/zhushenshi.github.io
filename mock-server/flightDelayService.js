import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createFlightDelayRows } from './flightDelayData.js'

const UPDATABLE_STATUSES = new Set(['DRAFT', 'REJECTED', 'PENDING'])
const SUBMITTABLE_STATUSES = new Set(['DRAFT', 'REJECTED'])
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const DATA_FIELDS = [
  'cardNo',
  'reportTime',
  'insuredName',
  'idCardNo',
  'policyNo',
  'flightNo',
  'delayReason',
  'incidentDescription',
  'scheduledDepartureTime',
  'actualDepartureTime',
  'reporterName',
  'reporterPhone',
  'reporterEmail',
  'recorderName',
]
const REQUIRED_FIELDS = DATA_FIELDS.filter((field) => field !== 'reporterEmail')

let rows = createFlightDelayRows()
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

const requireUser = (userId) => assert(userId, 401, '缺少当前操作人 userId')
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value)
const normalizeData = (source) => {
  assert(source && typeof source === 'object' && !Array.isArray(source), 400, 'data 不能为空')
  const data = Object.fromEntries(
    DATA_FIELDS.map((field) => [field, normalizeString(source[field]) ?? '']),
  )
  data.flightNo = String(data.flightNo).toUpperCase()
  data.idCardNo = String(data.idCardNo).toUpperCase()

  REQUIRED_FIELDS.forEach((field) => assert(data[field] !== '', 400, `${field} 不能为空`))
  assert(/^\d{13,19}$/.test(data.cardNo), 400, '信用卡号应为13～19位数字')
  assert(/^\d{17}[\dX]$/.test(data.idCardNo), 400, '身份证号应为18位')
  assert(/^[A-Z0-9]{2,10}$/.test(data.flightNo), 400, '航班号应为2～10位字母或数字')
  assert(data.delayReason.length <= 100, 400, '延误原因最多100个字符')
  assert(DATE_TIME_PATTERN.test(data.reportTime), 400, '报案时间格式不正确')
  assert(DATE_TIME_PATTERN.test(data.scheduledDepartureTime), 400, '原定起飞时间格式不正确')
  assert(DATE_TIME_PATTERN.test(data.actualDepartureTime), 400, '实际起飞时间格式不正确')
  assert(data.insuredName.length <= 100, 400, '被保险人最多100个字符')
  assert(data.policyNo.length <= 50, 400, '保单号最多50个字符')
  assert(data.incidentDescription.length <= 2000, 400, '事故经过最多2000个字符')
  return data
}

const findRow = (id) => {
  const row = rows.find((item) => String(item.id) === String(id ?? ''))
  assert(row, 404, '航班延误登记不存在')
  return row
}

const contains = (value, keyword) =>
  !keyword || String(value ?? '').includes(String(keyword).trim())
const equals = (value, expected) => !expected || String(value ?? '') === String(expected).trim()
const inRange = (value, start, end) => (!start || value >= start) && (!end || value <= end)

const filterRows = (query = {}) =>
  rows.filter(
    (row) =>
      equals(row.id, query.id) &&
      contains(row.reportNo, query.reportNo) &&
      inRange(row.reportTime, query.reportTimeStart, query.reportTimeEnd) &&
      contains(row.insuredName, query.insuredName) &&
      equals(row.idCardNo, query.idCardNo) &&
      contains(row.policyNo, query.policyNo) &&
      equals(row.flightNo, query.flightNo && String(query.flightNo).trim().toUpperCase()) &&
      equals(row.delayReason, query.delayReason) &&
      equals(row.approvalStatus, query.approvalStatus) &&
      contains(row.reporterName, query.reporterName) &&
      equals(row.reporterPhone, query.reporterPhone) &&
      contains(row.recorderName, query.recorderName) &&
      inRange(row.scheduledDepartureTime, query.scheduledTimeStart, query.scheduledTimeEnd),
  )

const createPage = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.pageNum, 10) || 1)
  const size = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20))
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
    id: (1939912345678900000n + BigInt(sequence)).toString(),
    reportNo: `FD${stamp}${pad(sequence, 6)}`,
  }
}
const createExport = async (query = {}) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('航班延误登记')
  worksheet.columns = [
    { header: '报案号', key: 'reportNo', width: 28 },
    { header: '航班号', key: 'flightNo', width: 14 },
    { header: '报案时间', key: 'reportTime', width: 22 },
    { header: '被保险人', key: 'insuredName', width: 16 },
    { header: '身份证号', key: 'idCardNo', width: 22 },
    { header: '保单号', key: 'policyNo', width: 24 },
    { header: '信用卡号', key: 'cardNo', width: 22 },
    { header: '延误原因', key: 'delayReason', width: 24 },
    { header: '审批状态', key: 'approvalStatus', width: 14 },
    { header: '报案人', key: 'reporterName', width: 16 },
    { header: '报案人电话', key: 'reporterPhone', width: 18 },
    { header: '报案记录人', key: 'recorderName', width: 16 },
    { header: '原定起飞时间', key: 'scheduledDepartureTime', width: 22 },
    { header: '实际起飞时间', key: 'actualDepartureTime', width: 22 },
    { header: '事故经过', key: 'incidentDescription', width: 45 },
    { header: '审批意见', key: 'approvalRemark', width: 35 },
  ]
  filterRows(query).forEach((row) => worksheet.addRow(row))
  worksheet.getRow(1).font = { bold: true }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  const buffer = await workbook.xlsx.writeBuffer()
  const now = new Date()
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return { file: Buffer.from(buffer), filename: `航班延误登记-${date}.xlsx` }
}

export const handleFlightDelayAction = async (action, body = {}, userId) => {
  requireUser(userId)

  if (action === 'flightDelay.page') return { data: createPage(body.query) }
  if (action === 'flightDelay.detail') return { data: { ...findRow(body.id) } }
  if (action === 'flightDelay.create') {
    const data = normalizeData(body.data)
    const identifiers = createIdentifiers()
    const row = {
      ...identifiers,
      ...data,
      approvalStatus: 'PENDING',
      approvalRemark: '',
      version: 0,
    }
    rows.unshift(row)
    return {
      data: { id: row.id, reportNo: row.reportNo, approvalStatus: row.approvalStatus },
    }
  }
  if (action === 'flightDelay.update') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    assert(UPDATABLE_STATUSES.has(row.approvalStatus), 409, '当前状态不允许修改')
    const requestedStatus = body.data?.approvalStatus
    if (requestedStatus !== undefined) {
      assert(
        ['PENDING', 'APPROVED'].includes(requestedStatus),
        400,
        'approvalStatus 仅支持 PENDING 或 APPROVED',
      )
      if (requestedStatus === 'APPROVED') {
        assert(row.approvalStatus === 'PENDING', 409, '仅未审核记录可审核')
      }
    }
    const wasPending = row.approvalStatus === 'PENDING'
    const approvalRemark = row.approvalRemark
    Object.assign(row, normalizeData(body.data), {
      approvalStatus: requestedStatus ?? (wasPending ? 'PENDING' : 'DRAFT'),
      approvalRemark: wasPending ? approvalRemark : '',
    })
    row.version += 1
    return {
      data: { id: row.id, version: row.version, approvalStatus: row.approvalStatus },
    }
  }
  if (action === 'flightDelay.delete') {
    const row = findRow(body.id)
    rows = rows.filter((item) => item !== row)
    return { data: null }
  }
  if (action === 'flightDelay.batchDelete') {
    assert(Array.isArray(body.ids) && body.ids.length > 0, 400, 'ids 不能为空')
    assert(body.ids.length <= 100, 400, '单次最多删除100条数据')
    const ids = new Set(body.ids.map(String))
    rows = rows.filter((row) => !ids.has(String(row.id)))
    return { data: null }
  }
  if (action === 'flightDelay.export') {
    assert(body.id !== undefined && body.id !== null && String(body.id).trim(), 400, 'id 不能为空')
    return createExport({ id: body.id })
  }
  if (action === 'flightDelay.submit') {
    const row = findRow(body.id)
    assert(SUBMITTABLE_STATUSES.has(row.approvalStatus), 409, '当前状态不允许提交审批')
    row.approvalStatus = 'PENDING'
    row.approvalRemark = ''
    return { data: null }
  }
  if (action === 'flightDelay.approve' || action === 'flightDelay.reject') {
    const row = findRow(body.id)
    assert(row.approvalStatus === 'PENDING', 409, '仅待审批记录可以审核')
    const remark = String(body.remark ?? '').trim()
    assert(remark.length <= 500, 400, '审批意见最多500个字符')
    if (action === 'flightDelay.reject') assert(remark, 400, '驳回原因不能为空')
    row.approvalStatus = action === 'flightDelay.approve' ? 'APPROVED' : 'REJECTED'
    row.approvalRemark = remark
    return { data: null }
  }

  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
