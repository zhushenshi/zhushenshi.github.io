import { createOrganizationRescueProjectRows } from './organizationRescueProjectData.js'
import { getOrganizationById, MockHttpError } from './organizationService.js'

const BASE_ID = 1960501000000000000n
let rows = createOrganizationRescueProjectRows()
let sequence = rows.length

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
const normalizeRescueProjects = (value) => {
  assert(typeof value === 'string' && value.trim(), 400, 'rescueProjects 不能为空')
  assert(value.length <= 4000, 400, 'rescueProjects 最多4000个字符')
  return value
}
const findRow = (id) => {
  const normalizedId = normalizeId(id)
  const row = rows.find((item) => !item.deleted && item.id === normalizedId)
  assert(row, 404, '机构救援项目配置不存在或已删除')
  return row
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
    '该机构已配置救援项目',
  )
const publicRow = (row) => {
  const organization = getOrganizationById(row.organizationId)
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationCode: organization.organizationCode,
    organizationName: organization.organizationName,
    rescueProjects: row.rescueProjects,
  }
}

const normalizeCreateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const organizationId = assertOrganization(source.organizationId)
  assertUniqueOrganization(organizationId)
  return {
    organizationId,
    rescueProjects: normalizeRescueProjects(source.rescueProjects),
  }
}

const normalizePatch = (source, row) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const patch = {}
  if (source.organizationId != null) {
    patch.organizationId = assertOrganization(source.organizationId)
    assertUniqueOrganization(patch.organizationId, row.id)
  }
  if (source.rescueProjects != null) {
    patch.rescueProjects = normalizeRescueProjects(source.rescueProjects)
  }
  assert(Object.keys(patch).length > 0, 400, 'data 中没有可修改字段')
  return patch
}

const createPage = (source) => {
  const query = source == null ? {} : source
  assert(isPlainObject(query), 400, 'query 必须为对象')
  const pageNum = query.pageNum == null ? 1 : Number(query.pageNum)
  const pageSize = query.pageSize == null ? 20 : Number(query.pageSize)
  assert(Number.isInteger(pageNum) && pageNum >= 1, 400, 'pageNum 参数不正确')
  assert(Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100, 400, 'pageSize 参数不正确')
  const organizationCode = String(query.organizationCode ?? '').trim()
  const organizationName = String(query.organizationName ?? '').trim()
  const filtered = rows
    .filter((row) => !row.deleted)
    .map(publicRow)
    .filter(
      (row) =>
        (!organizationCode || row.organizationCode === organizationCode) &&
        (!organizationName || row.organizationName.includes(organizationName)),
    )
    .sort((left, right) => (BigInt(left.id) > BigInt(right.id) ? -1 : 1))
  const start = (pageNum - 1) * pageSize
  return {
    page: pageNum,
    size: pageSize,
    total: filtered.length,
    totalSize: filtered.length,
    totalPage: Math.ceil(filtered.length / pageSize),
    data: filtered.slice(start, start + pageSize),
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

export const handleOrganizationRescueProjectAction = async (action, body = {}, userId) => {
  if (action === 'organizationRescueProject.page') return { data: createPage(body.query) }
  if (action === 'organizationRescueProject.detail') return { data: publicRow(findRow(body.id)) }

  requireUser(userId)
  if (action === 'organizationRescueProject.create') {
    sequence += 1
    const row = {
      id: (BASE_ID + BigInt(sequence)).toString(),
      ...normalizeCreateData(body.data),
      deleted: false,
    }
    rows.push(row)
    return { data: { id: row.id } }
  }
  if (action === 'organizationRescueProject.update') {
    const row = findRow(body.id)
    Object.assign(row, normalizePatch(body.data, row))
    return { data: { id: row.id } }
  }
  if (action === 'organizationRescueProject.delete') {
    findRow(body.id).deleted = true
    return { data: null }
  }
  if (action === 'organizationRescueProject.batchDelete') {
    deleteBatch(body.ids)
    return { data: null }
  }
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
