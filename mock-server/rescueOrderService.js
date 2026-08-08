import { Buffer } from 'node:buffer'

import ExcelJS from 'exceljs'

import { createRescueOrderRows } from './rescueOrderData.js'

const REQUIRED_FIELDS = [
  'accidentType',
  'rescueNo',
  'callerName',
  'callerPhone',
  'groupId',
  'reportNo',
  'insuredName',
  'seatNum',
  'newOrderFlag',
  'rescueObject',
  'linkmanName',
  'linkmanPhone',
  'provinceCode',
  'provinceName',
  'cityCode',
  'cityName',
  'districtCode',
  'districtName',
  'detailAddress',
  'dispatchTarget',
  'rescueType',
  'repairFlag',
  'reportRecorder',
]
const DATA_FIELDS = [
  'serviceTimes',
  'serviceMileage',
  'policyNo',
  ...REQUIRED_FIELDS,
  'callTime',
  'companyName',
  'identityNo',
  'policyStartDate',
  'policyEndDate',
  'carNo',
  'engineNo',
  'carType',
  'vehicleCategory',
  'carColor',
  'customerType',
  'rescueRule',
  'freeMileage',
  'rescueDate',
  'destAddress',
  'employeeNo',
  'orderDesc',
]
const EXACT_QUERY_FIELDS = [
  'rescueNo',
  'serviceNo',
  'reportNo',
  'policyNo',
  'carNo',
  'engineNo',
  'identityNo',
  'callerPhone',
  'linkmanPhone',
  'accidentType',
  'rescueType',
  'reportStatus',
]
const FUZZY_QUERY_FIELDS = ['callerName', 'insuredName', 'linkmanName', 'companyName']
const REGION_CODE_PATTERN = /^\d{6}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
const QUERY_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const YES_NO_FIELDS = ['newOrderFlag', 'repairFlag']
const initialRows = createRescueOrderRows()
let rows = initialRows.map((row, index) => ({
  ...row,
  remarks: row.orderDesc
    ? [
        {
          id: (2026080600000000000n + BigInt(index + 1)).toString(),
          rescueOrderId: row.id,
          remark: row.orderDesc,
          createUser: row.createUser,
          createTime: row.createTime,
        },
      ]
    : [],
  reminderRecords: [],
  statusChanges: [
    {
      id: (2026080600000000000n + BigInt(index + 1) + 1000000n).toString(),
      serviceStatus: row.serviceStatus,
      createTime: row.createTime,
    },
  ],
}))
let sequence = rows.length
let remarkSequence = rows.length

export class RescueOrderMockError extends Error {
  constructor(statusCode, message, payload) {
    super(message)
    this.statusCode = statusCode
    this.code = statusCode
    this.payload = payload
  }
}

const assert = (condition, statusCode, message) => {
  if (!condition) throw new RescueOrderMockError(statusCode, message)
}
const requireUser = (userId) => assert(userId, 401, '缺少当前操作人 userId')
const trim = (value) => (typeof value === 'string' ? value.trim() : value)
const pad = (value, length = 2) => String(value).padStart(length, '0')
const formatNow = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
const normalizeData = (source) => {
  assert(source && typeof source === 'object' && !Array.isArray(source), 400, 'data 不能为空')
  const data = Object.fromEntries(DATA_FIELDS.map((field) => [field, trim(source[field])]))
  REQUIRED_FIELDS.forEach((field) => {
    assert(
      data[field] !== '' && data[field] !== null && data[field] !== undefined,
      400,
      `${field} 不能为空`,
    )
  })
  ;['provinceCode', 'cityCode', 'districtCode'].forEach((field) => {
    assert(REGION_CODE_PATTERN.test(String(data[field])), 400, `${field} 必须为六位行政区划代码`)
  })
  YES_NO_FIELDS.forEach((field) => {
    assert(['YES', 'NO'].includes(data[field]), 400, `${field} 必须为 YES 或 NO`)
  })
  ;[
    ['serviceTimes', false],
    ['freeMileage', false],
    ['seatNum', true],
  ].forEach(([field, positive]) => {
    const value = data[field]
    if (value === '' || value === null || value === undefined) return
    assert(Number.isInteger(value), 400, `${field} 必须为整数`)
    assert(positive ? value > 0 : value >= 0, 400, `${field} 数值范围不正确`)
  })
  if (
    data.serviceMileage !== '' &&
    data.serviceMileage !== null &&
    data.serviceMileage !== undefined
  ) {
    assert(
      typeof data.serviceMileage === 'number' && Number.isFinite(data.serviceMileage),
      400,
      'serviceMileage 必须为数字',
    )
    assert(data.serviceMileage >= 0, 400, 'serviceMileage 不能小于 0')
  }
  assert(!data.callTime || DATETIME_PATTERN.test(data.callTime), 400, 'callTime 格式不正确')
  assert(!data.rescueDate || DATETIME_PATTERN.test(data.rescueDate), 400, 'rescueDate 格式不正确')
  ;['policyStartDate', 'policyEndDate'].forEach((field) => {
    assert(!data[field] || DATE_PATTERN.test(data[field]), 400, `${field} 格式不正确`)
  })
  assert(!data.identityNo || /^\d{17}[\dX]$/.test(data.identityNo), 400, 'identityNo 格式不正确')
  assert(data.dispatchTarget === 'ZHONGBAO', 400, 'dispatchTarget 必须为 ZHONGBAO')
  assert(['0303', '0304'].includes(data.rescueType), 400, 'rescueType 仅支持 0303 或 0304')
  return data
}

const findRow = (id) => {
  const row = rows.find((item) => String(item.id) === String(id ?? ''))
  assert(row, 404, '救援工单不存在')
  return row
}
const equals = (value, expected) =>
  !String(expected ?? '').trim() || String(value ?? '') === String(expected).trim()
const contains = (value, keyword) =>
  !String(keyword ?? '').trim() || String(value ?? '').includes(String(keyword).trim())
const validateQuery = (query = {}) => {
  const start = trim(query.createTimeStart)
  const end = trim(query.createTimeEnd)
  if (start) assert(QUERY_DATETIME_PATTERN.test(start), 400, 'createTimeStart 格式不正确')
  if (end) assert(QUERY_DATETIME_PATTERN.test(end), 400, 'createTimeEnd 格式不正确')
  if (start && end) {
    const startTime = new Date(start.replace(' ', 'T')).getTime()
    const endTime = new Date(end.replace(' ', 'T')).getTime()
    assert(startTime <= endTime, 400, '工单创建开始时间不能晚于结束时间')
    assert(endTime - startTime <= 366 * 24 * 60 * 60 * 1000, 400, '查询时间范围不能超过366天')
  }
  return { ...query, createTimeStart: start, createTimeEnd: end }
}
const compareIdsDesc = (left, right) => {
  const a = String(left.id ?? '')
  const b = String(right.id ?? '')
  return b.length - a.length || b.localeCompare(a)
}
const filterRows = (source = {}) => {
  const query = validateQuery(source)
  return rows
    .filter(
      (row) =>
        EXACT_QUERY_FIELDS.every((field) => equals(row[field], query[field])) &&
        FUZZY_QUERY_FIELDS.every((field) => contains(row[field], query[field])) &&
        (!query.createTimeStart || row.createTime >= query.createTimeStart) &&
        (!query.createTimeEnd || row.createTime <= query.createTimeEnd),
    )
    .sort((a, b) => b.createTime.localeCompare(a.createTime) || compareIdsDesc(a, b))
}
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

const createExport = async (query = {}) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('救援工单清单')
  worksheet.columns = [
    { header: '工单号', key: 'rescueNo', width: 30 },
    { header: '被保险人', key: 'insuredName', width: 16 },
    { header: '保单号', key: 'policyNo', width: 26 },
    { header: '报案号', key: 'reportNo', width: 24 },
    { header: '车牌号', key: 'carNo', width: 14 },
    { header: '发动机号', key: 'engineNo', width: 20 },
    { header: '联系人', key: 'linkmanName', width: 16 },
    { header: '联系电话', key: 'linkmanPhone', width: 18 },
    { header: '事故类型', key: 'accidentType', width: 16 },
    { header: '服务类型', key: 'rescueType', width: 14 },
    { header: '所属机构', key: 'companyName', width: 24 },
    { header: '记录时间', key: 'createTime', width: 22 },
    { header: '上报状态', key: 'reportStatus', width: 14 },
    { header: '审核状态', key: 'auditStatus', width: 14 },
    { header: '救援费用', key: 'rescueFee', width: 14 },
    { header: '立案', key: 'filingStatus', width: 12 },
    { header: '备注', key: 'orderDesc', width: 36 },
  ]
  filterRows(query)
    .slice(0, 10000)
    .forEach((row) => worksheet.addRow(row))
  worksheet.getRow(1).font = { bold: true }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  const buffer = await workbook.xlsx.writeBuffer()
  const now = new Date()
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return { file: Buffer.from(buffer), filename: `救援报案查询列表-${timestamp}.xlsx` }
}

const createResult = (row) => ({
  id: row.id,
  rescueNo: row.rescueNo,
  reportStatus: row.reportStatus,
  serviceNo: row.serviceNo,
  trackUrl: row.trackUrl,
})

export const handleRescueOrderAction = async (action, body = {}, userId) => {
  if (action === 'rescueOrder.page') return { data: createPage(body.query) }
  if (action === 'rescueOrder.detail') return { data: { ...findRow(body.id) } }
  if (action === 'rescueOrder.reminder') {
    requireUser(userId)
    const rescueNo = String(body.data?.rescueNo ?? '')
    assert(rescueNo, 400, 'rescueNo 不能为空')
    const row = rows.find((r) => r.rescueNo === rescueNo)
    assert(row, 404, '救援工单不存在')
    const remark = body.data?.remark ? String(body.data.remark).trim() : ''
    const now = formatNow()
    const record = {
      id: (2026080600000000000n + BigInt(++remarkSequence)).toString(),
      rescueNo,
      remark: remark || undefined,
      reminderNo: body.data?.reminderNo,
      channelReminderType: body.data?.channelReminderType || 'commonReminder',
      callStatus: 'SUCCESS',
      responseMessage: '模拟催办成功',
      createUser: String(userId),
      createTime: now,
    }
    row.reminderRecords = [
      record,
      ...(Array.isArray(row.reminderRecords) ? row.reminderRecords : []),
    ]
    row.updateUser = String(userId)
    row.updateTime = now
    row.version = Number(row.version || 0) + 1
    return { data: {} }
  }
  if (action === 'rescueOrder.addRemark') {
    requireUser(userId)
    const row = findRow(body.id)
    const remark = String(body.data?.remark ?? '').trim()
    assert(remark, 400, '备注不能为空')
    assert(remark.length <= 1000, 400, '备注最多1000个字符')
    remarkSequence += 1
    const now = formatNow()
    const record = {
      id: (2026080600000000000n + BigInt(remarkSequence)).toString(),
      rescueOrderId: row.id,
      remark,
      createUser: String(userId),
      createTime: now,
    }
    row.remarks = [record, ...(Array.isArray(row.remarks) ? row.remarks : [])]
    row.updateUser = String(userId)
    row.updateTime = now
    row.version = Number(row.version || 0) + 1
    return { data: record }
  }
  if (action === 'rescueOrder.export') {
    requireUser(userId)
    return createExport(body.query)
  }
  if (action !== 'rescueOrder.create') {
    throw new RescueOrderMockError(404, `不支持的 action：${action || ''}`)
  }
  requireUser(userId)
  const data = normalizeData(body.data)
  assert(!rows.some((row) => row.rescueNo === data.rescueNo), 409, 'rescueNo 已存在')
  sequence += 1
  const id = (2026080400000000000n + BigInt(sequence)).toString()
  const shouldFail = String(data.orderDesc || '').includes('模拟上报失败')
  const now = formatNow()
  const row = {
    ...data,
    id,
    rescueAddr: `${data.provinceName}${data.cityName}${data.districtName}${data.detailAddress}`,
    createdBy: String(userId),
    createUser: String(userId),
    updateUser: String(userId),
    createTime: now,
    updateTime: now,
    version: 0,
    remarks: data.orderDesc
      ? [
          {
            id: (2026080600000000000n + BigInt(++remarkSequence)).toString(),
            rescueOrderId: id,
            remark: data.orderDesc,
            createUser: String(userId),
            createTime: now,
          },
        ]
      : [],
    reminderRecords: [],
    statusChanges: [
      {
        id: (2026080600000000000n + BigInt(++remarkSequence)).toString(),
        serviceStatus: '00',
        createTime: now,
      },
    ],
    serviceStatus: '00',
    orderStatus: shouldFail ? 'REPORT_FAILED' : 'DISPATCHED',
    auditStatus: 'PENDING',
    filingStatus: 'NO',
    rescueFee: null,
    reportStatus: shouldFail ? 'FAILED' : 'SUCCESS',
    reportMessage: shouldFail ? '模拟中保车服上报失败' : '',
    serviceNo: shouldFail ? '' : `OD${String(sequence).padStart(9, '0')}`,
    trackUrl: shouldFail ? '' : `http://example.com/track/${encodeURIComponent(data.rescueNo)}`,
  }
  rows.unshift(row)
  const result = createResult(row)
  if (shouldFail) {
    throw new RescueOrderMockError(502, '工单已保存，但中保上报失败', {
      data: { ...result, reportMessage: row.reportMessage },
      reportMessage: row.reportMessage,
    })
  }
  return { data: result }
}
