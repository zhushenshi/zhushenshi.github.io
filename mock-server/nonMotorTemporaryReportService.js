import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createNonMotorRows } from './nonMotorTemporaryReportData.js'

const STRING_FIELDS = [
  'policyNo',
  'contractNo',
  'riskName',
  'insuredName',
  'customerCode',
  'policyholderName',
  'insuredCertificateNo',
  'documentSerialNo',
  'insuranceOrganizationCode',
  'reporterName',
  'callerPhone',
  'callDate',
  'callTime',
  'contactName',
  'contactPhone',
  'accidentLocationCode',
  'accidentProvinceCode',
  'accidentDistrictCode',
  'accidentAddress',
  'accidentTime',
  'insuranceTypeCode',
  'customerCallback',
]

const EXACT_FIELDS = [
  'policyNo',
  'contractNo',
  'customerCode',
  'documentSerialNo',
  'insuranceOrganizationCode',
  'accidentProvinceCode',
  'accidentDistrictCode',
  'insuranceTypeCode',
]

const FUZZY_FIELDS = ['riskName', 'insuredName', 'policyholderName', 'reporterName', 'contactName']

let rows = createNonMotorRows()

const clone = (row) => JSON.parse(JSON.stringify(row))

const includes = (value, keyword) =>
  !keyword || String(value ?? '').toLowerCase().includes(String(keyword).toLowerCase().trim())

const queryPage = (query = {}) => {
  const pageNum = Math.max(1, Number.parseInt(query.pageNum, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20))

  const filtered = rows.filter((row) => {
    // 精确匹配字段
    for (const field of EXACT_FIELDS) {
      if (query[field] && String(row[field]) !== String(query[field])) return false
    }
    // 模糊匹配字段
    for (const field of FUZZY_FIELDS) {
      if (!includes(row[field], query[field])) return false
    }
    // 时间范围
    if (query.callDateStart && row.callDate < query.callDateStart) return false
    if (query.callDateEnd && row.callDate > query.callDateEnd) return false
    if (query.accidentTimeStart && row.accidentTime < query.accidentTimeStart) return false
    if (query.accidentTimeEnd && row.accidentTime > query.accidentTimeEnd) return false
    return true
  })

  const total = filtered.length
  const start = (pageNum - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

  return {
    page: pageNum,
    size: pageSize,
    total,
    totalSize: total,
    totalPage: Math.ceil(total / pageSize),
    data,
  }
}

const findById = (id) => {
  const index = rows.findIndex((r) => String(r.id) === String(id))
  return index === -1 ? null : { row: rows[index], index }
}

const sanitizeData = (data) =>
  Object.fromEntries(
    STRING_FIELDS.map((field) => [
      field,
      data[field] !== undefined ? String(data[field] ?? '').trim() : '',
    ]),
  )

const stamp = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const handleNonMotorTemporaryReportAction = async (action, body, userId) => {
  const now = stamp()

  if (action === 'nonMotorTemporaryReport.page') {
    return { data: queryPage(body.query) }
  }

  if (action === 'nonMotorTemporaryReport.detail') {
    const found = findById(body.id)
    if (!found) throw Object.assign(new Error('记录不存在或已删除'), { statusCode: 400 })
    return { data: clone(found.row) }
  }

  if (action === 'nonMotorTemporaryReport.create') {
    if (!userId) throw Object.assign(new Error('缺少操作人 userId'), { statusCode: 400 })
    const maxId = rows.reduce((max, r) => Math.max(max, Number(r.id)), 1963573200000000000)
    const newRow = {
      id: maxId + 1,
      ...sanitizeData(body.data || {}),
      version: 0,
      createUser: userId,
      createTime: now,
      updateUser: userId,
      updateTime: now,
    }
    rows.push(newRow)
    return { data: clone(newRow) }
  }

  if (action === 'nonMotorTemporaryReport.update') {
    if (!userId) throw Object.assign(new Error('缺少操作人 userId'), { statusCode: 400 })
    const found = findById(body.id)
    if (!found) throw Object.assign(new Error('记录不存在或已删除'), { statusCode: 400 })
    if (Number(found.row.version) !== Number(body.version)) {
      throw Object.assign(new Error('数据已发生变化，请刷新后重试'), { statusCode: 409 })
    }
    const updated = {
      ...found.row,
      ...sanitizeData(body.data || {}),
      version: found.row.version + 1,
      updateUser: userId,
      updateTime: now,
    }
    rows[found.index] = updated
    return { data: clone(updated) }
  }

  if (action === 'nonMotorTemporaryReport.delete') {
    if (!userId) throw Object.assign(new Error('缺少操作人 userId'), { statusCode: 400 })
    const found = findById(body.id)
    if (!found) throw Object.assign(new Error('记录不存在或已删除'), { statusCode: 400 })
    rows.splice(found.index, 1)
    return { data: null }
  }

  if (action === 'nonMotorTemporaryReport.batchDelete') {
    if (!userId) throw Object.assign(new Error('缺少操作人 userId'), { statusCode: 400 })
    if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 100) {
      throw Object.assign(new Error('ids 不能为空且每次最多100个'), { statusCode: 400 })
    }
    const idSet = new Set(body.ids.map(String))
    const before = rows.length
    rows = rows.filter((r) => !idSet.has(String(r.id)))
    return { data: { deleted: before - rows.length } }
  }

  if (action === 'nonMotorTemporaryReport.export') {
    const result = queryPage(body.query || {})
    const items = result.data
    if (items.length > 10000) {
      throw Object.assign(new Error('单次导出不能超过10000条，请缩小查询范围'), { statusCode: 400 })
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('非车险临时报案')

    const headers = [
      '保单号', '合同号', '险种名称', '被保险人', '客户编码', '投保人名称',
      '被保险人证件号', '单证流水号', '保险机构', '报案人', '来电号码',
      '来电日期', '来电时间', '联系人', '联系人电话', '出险所在地',
      '出险所在省', '出险所在区', '出险地址', '出险时间', '险种类型', '客户回答',
    ]
    const cols = [
      'policyNo', 'contractNo', 'riskName', 'insuredName', 'customerCode', 'policyholderName',
      'insuredCertificateNo', 'documentSerialNo', 'insuranceOrganizationCode', 'reporterName', 'callerPhone',
      'callDate', 'callTime', 'contactName', 'contactPhone', 'accidentLocationCode',
      'accidentProvinceCode', 'accidentDistrictCode', 'accidentAddress', 'accidentTime', 'insuranceTypeCode', 'customerCallback',
    ]

    ws.addRow(headers)
    for (const item of items) {
      ws.addRow(cols.map((c) => item[c] ?? ''))
    }

    const buf = await wb.xlsx.writeBuffer()
    const ts = new Date()
    const tsStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
    return {
      file: Buffer.from(buf),
      filename: `非车险临时报案查询列表-${tsStr}.xlsx`,
    }
  }

  throw Object.assign(new Error(`不支持的 action：${action}`), { statusCode: 404 })
}
