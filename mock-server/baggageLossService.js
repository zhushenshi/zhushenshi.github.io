import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createBaggageLossRows } from './baggageLossData.js'

const DATA_FIELDS = [
  'cardNo',
  'reportTime',
  'insuredName',
  'idCardNo',
  'flightNo',
  'policyNo',
  'lossTime',
  'lossReason',
  'incidentDescription',
  'reporterName',
  'reporterPhone',
  'reporterEmail',
  'recorderName',
]
const REQUIRED_FIELDS = DATA_FIELDS.filter(
  (field) => !['cardNo', 'policyNo', 'incidentDescription', 'reporterEmail'].includes(field),
)
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
let rows = createBaggageLossRows()
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
const assertVersion = (version) => {
  assert(Number.isInteger(version) && version >= 0, 400, 'version 必须为大于等于0的整数')
  return version
}
const normalizeData = (source) => {
  assert(source && typeof source === 'object' && !Array.isArray(source), 400, 'data 不能为空')
  const data = Object.fromEntries(
    DATA_FIELDS.map((field) => [field, String(source[field] ?? '').trim()]),
  )
  REQUIRED_FIELDS.forEach((field) => assert(data[field], 400, `${field} 不能为空`))
  data.idCardNo = data.idCardNo.toUpperCase()
  data.flightNo = data.flightNo.toUpperCase()
  if (data.cardNo) assert(/^\d{13,19}$/.test(data.cardNo), 400, '信用卡号应为13～19位数字')
  assert(/^\d{17}[\dX]$/.test(data.idCardNo), 400, '身份证号应为18位')
  assert(/^[A-Z0-9]{2,10}$/.test(data.flightNo), 400, '航班号应为2～10位字母或数字')
  assert(DATE_TIME_PATTERN.test(data.reportTime), 400, '报案时间格式不正确')
  assert(DATE_TIME_PATTERN.test(data.lossTime), 400, '出险时间格式不正确')
  assert(data.lossReason.length <= 100, 400, '行李损失原因最多100个字符')
  assert(data.insuredName.length <= 100, 400, '被保险人最多100个字符')
  assert(data.policyNo.length <= 50, 400, '保单号最多50个字符')
  assert(data.incidentDescription.length <= 2000, 400, '出险经过最多2000个字符')
  assert(data.reporterName.length <= 100, 400, '报案人最多100个字符')
  assert(data.reporterPhone.length <= 20, 400, '报案人电话最多20个字符')
  assert(data.recorderName.length <= 100, 400, '报案记录人最多100个字符')
  return data
}

const findRow = (id) => {
  const row = rows.find((item) => String(item.id) === String(id ?? ''))
  assert(row, 404, '行李损失报案不存在')
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
      contains(row.insuredName, query.insuredName) &&
      equals(row.idCardNo, query.idCardNo && String(query.idCardNo).trim().toUpperCase()) &&
      inRange(row.reportTime, query.reportTimeStart, query.reportTimeEnd) &&
      contains(row.reporterName, query.reporterName) &&
      equals(row.reporterPhone, query.reporterPhone) &&
      contains(row.recorderName, query.recorderName) &&
      equals(row.approvalStatus, query.approvalStatus),
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
    id: (1949912345678900000n + BigInt(sequence)).toString(),
    reportNo: `BL${stamp}${pad(sequence, 6)}`,
  }
}

const createExport = async (id) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('行李损失报案')
  worksheet.columns = [
    { header: '报案人', key: 'reporterName', width: 16 },
    { header: '报案时间', key: 'reportTime', width: 22 },
    { header: '报案人电话', key: 'reporterPhone', width: 18 },
    { header: '报案记录人', key: 'recorderName', width: 16 },
    { header: '被保险人', key: 'insuredName', width: 16 },
    { header: '身份证号', key: 'idCardNo', width: 22 },
    { header: '状态', key: 'approvalStatus', width: 14 },
  ]
  worksheet.addRow(findRow(id))
  worksheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  const now = new Date()
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return { file: Buffer.from(buffer), filename: `行李损失报案-${date}.xlsx` }
}

export const handleBaggageLossAction = async (action, body = {}, userId) => {
  assert(userId, 401, '缺少当前操作人 userId')
  if (action === 'baggageLoss.page') return { data: createPage(body.query) }
  if (action === 'baggageLoss.detail') return { data: { ...findRow(body.id) } }
  if (action === 'baggageLoss.create') {
    const row = {
      ...createIdentifiers(),
      ...normalizeData(body.data),
      approvalStatus: 'PENDING',
      version: 0,
    }
    rows.unshift(row)
    return { data: { id: row.id, reportNo: row.reportNo, approvalStatus: row.approvalStatus } }
  }
  if (action === 'baggageLoss.update') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    assert(row.approvalStatus === 'PENDING', 409, '仅未审核记录可修改或审核')
    const requestedStatus = body.data?.approvalStatus
    if (requestedStatus !== undefined) {
      assert(requestedStatus === 'APPROVED', 400, 'approvalStatus 仅支持 APPROVED')
    }
    Object.assign(row, normalizeData(body.data), {
      approvalStatus: requestedStatus ?? row.approvalStatus,
    })
    row.version += 1
    return {
      data: { id: row.id, version: row.version, approvalStatus: row.approvalStatus },
    }
  }
  if (action === 'baggageLoss.delete') {
    const row = findRow(body.id)
    rows = rows.filter((item) => item !== row)
    return { data: null }
  }
  if (action === 'baggageLoss.batchDelete') {
    assert(Array.isArray(body.ids) && body.ids.length, 400, 'ids 不能为空')
    assert(body.ids.length <= 100, 400, '单次最多删除100条数据')
    const ids = new Set(body.ids.map(String))
    rows = rows.filter((row) => !ids.has(String(row.id)))
    return { data: null }
  }
  if (action === 'baggageLoss.export') return createExport(body.id)
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
