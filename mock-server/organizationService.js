import { createOrganizationRows } from './organizationData.js'

const ORGANIZATION_TYPES = new Set(['ROOT', 'HEAD_OFFICE', 'BRANCH', 'SUB_BRANCH'])
const STATUSES = new Set(['ENABLED', 'DISABLED'])
const DATA_FIELDS = new Set([
  'parentId',
  'organizationCode',
  'organizationName',
  'organizationType',
  'sortNo',
  'status',
  'rescueProjects',
])
const BASE_ID = 1960401000000000000n

let rows = createOrganizationRows()
let sequence = Math.max(...rows.map((row) => Number(BigInt(row.id) - BASE_ID)))

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

const normalizeId = (id, field = 'id', allowZero = false) => {
  const value = typeof id === 'bigint' ? id.toString() : String(id ?? '').trim()
  assert(/^\d+$/.test(value), 400, `${field} 必须为整数`)
  const number = BigInt(value)
  assert(allowZero ? number >= 0n : number > 0n, 400, `${field} 参数不正确`)
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
  assert(row, 404, '机构不存在或已删除')
  return row
}

export const getOrganizationById = (id) => publicRow(findRow(id))
const findParent = (parentId) => {
  const normalizedId = normalizeId(parentId, 'parentId', true)
  return normalizedId === '0' ? null : findRow(normalizedId)
}
const assertUniqueCode = (code, excludedId = null) => {
  assert(
    !rows.some((row) => row.organizationCode === code && row.id !== excludedId),
    409,
    '机构代码已存在',
  )
}
const assertText = (value, field, required = true) => {
  assert(typeof value === 'string', 400, `${field} 必须为字符串`)
  const result = value.trim()
  if (required) assert(result, 400, `${field} 不能为空`)
  return result
}
const assertRescueProjects = (value) => {
  assert(typeof value === 'string', 400, 'rescueProjects 必须为字符串')
  assert(value.length <= 4000, 400, 'rescueProjects 最多4000个字符')
  return value
}
const assertSortNo = (value) => {
  const number = Number(value)
  assert(Number.isInteger(number) && number >= 0, 400, 'sortNo 必须为非负整数')
  return number
}
const assertType = (value) => {
  assert(ORGANIZATION_TYPES.has(value), 400, 'organizationType 参数不正确')
  return value
}
const assertStatus = (value) => {
  assert(STATUSES.has(value), 400, 'status 仅支持 ENABLED 或 DISABLED')
  return value
}

const normalizeCreateData = (source) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const parent = findParent(source.parentId)
  const organizationCode = assertText(source.organizationCode, 'organizationCode')
  assertUniqueCode(organizationCode)
  return {
    parentId: parent?.id ?? '0',
    organizationCode,
    organizationName: assertText(source.organizationName, 'organizationName'),
    organizationType: assertType(source.organizationType),
    sortNo: assertSortNo(source.sortNo),
    treeLevel: parent ? parent.treeLevel + 1 : 0,
    status: assertStatus(source.status ?? 'ENABLED'),
    rescueProjects:
      source.rescueProjects == null ? null : assertRescueProjects(source.rescueProjects),
  }
}

const normalizePatch = (source, row) => {
  assert(isPlainObject(source), 400, 'data 不能为空')
  const patch = {}
  Object.entries(source).forEach(([field, value]) => {
    if (!DATA_FIELDS.has(field) || value == null) return
    if (field === 'parentId') patch.parentId = normalizeId(value, 'parentId', true)
    else if (field === 'organizationCode') {
      patch.organizationCode = assertText(value, field)
      assertUniqueCode(patch.organizationCode, row.id)
    } else if (field === 'organizationName') patch.organizationName = assertText(value, field)
    else if (field === 'organizationType') patch.organizationType = assertType(value)
    else if (field === 'sortNo') patch.sortNo = assertSortNo(value)
    else if (field === 'status') patch.status = assertStatus(value)
    else if (field === 'rescueProjects') patch.rescueProjects = assertRescueProjects(value)
  })
  assert(Object.keys(patch).length > 0, 400, 'data 中没有可修改字段')
  return patch
}

const resolveNewParent = (row, parentId) => {
  const parent = findParent(parentId)
  let ancestor = parent
  while (ancestor) {
    assert(ancestor.id !== row.id, 409, '禁止将机构移动到自身或其下级机构中')
    ancestor = ancestor.parentId === '0' ? null : findRow(ancestor.parentId)
  }
  return parent
}
const refreshDescendantTreeLevels = (parent) => {
  rows
    .filter((row) => !row.deleted && row.parentId === parent.id)
    .forEach((child) => {
      child.treeLevel = parent.treeLevel + 1
      refreshDescendantTreeLevels(child)
    })
}
const compareRows = (left, right) => {
  const bySort = left.sortNo - right.sortNo
  if (bySort) return bySort
  const leftId = BigInt(left.id)
  const rightId = BigInt(right.id)
  return leftId === rightId ? 0 : leftId < rightId ? -1 : 1
}
const buildTreeNode = (row, maxTreeLevel = null) => ({
  ...publicRow(row),
  children: rows
    .filter(
      (child) =>
        !child.deleted &&
        child.parentId === row.id &&
        (maxTreeLevel == null || child.treeLevel <= maxTreeLevel),
    )
    .sort(compareRows)
    .map((child) => buildTreeNode(child, maxTreeLevel)),
})
const validateTreeRequest = (source) => {
  assert(isPlainObject(source), 400, '机构树请求参数必须为对象')
  ;['pageNum', 'pageSize', 'query'].forEach((field) => {
    assert(!Object.hasOwn(source, field), 400, `organization.tree 不支持 ${field} 参数`)
  })
  const request = {}
  if (source.rootId != null && source.rootId !== '') {
    request.rootId = normalizeId(source.rootId, 'rootId')
  }
  if (source.treeLevel != null && source.treeLevel !== '') {
    const treeLevel = Number(source.treeLevel)
    assert(Number.isInteger(treeLevel) && treeLevel >= 0, 400, 'treeLevel 必须为非负整数')
    request.treeLevel = treeLevel
  }
  return request
}
const createTree = (source) => {
  const request = validateTreeRequest(source)
  if (request.rootId) {
    const root = findRow(request.rootId)
    assert(
      request.treeLevel == null || request.treeLevel >= root.treeLevel,
      400,
      'treeLevel 不得小于根机构自身层级',
    )
    return [buildTreeNode(root, request.treeLevel)]
  }
  return rows
    .filter((row) => !row.deleted && row.parentId === '0')
    .sort(compareRows)
    .map((row) => buildTreeNode(row, request.treeLevel))
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
  if (query.parentId != null && query.parentId !== '') {
    query.parentId = normalizeId(query.parentId, 'parentId', true)
  }
  ;['organizationCode', 'organizationName'].forEach((field) => {
    if (query[field] != null) query[field] = assertText(query[field], field, false)
  })
  if (query.organizationType) assertType(query.organizationType)
  if (query.status) assertStatus(query.status)
  return query
}

const hasValue = (value) => value !== undefined && value !== null && value !== ''
const exact = (value, expected) => !hasValue(expected) || String(value ?? '') === expected
const fuzzy = (value, keyword) => !hasValue(keyword) || String(value ?? '').includes(keyword)
const createPage = (source) => {
  const query = validateQuery(source)
  const filtered = rows
    .filter(
      (row) =>
        !row.deleted &&
        exact(row.parentId, query.parentId) &&
        exact(row.organizationCode, query.organizationCode) &&
        fuzzy(row.organizationName, query.organizationName) &&
        exact(row.organizationType, query.organizationType) &&
        exact(row.status, query.status),
    )
    .sort(compareRows)
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

const updateOrganization = (body) => {
  const row = findRow(body.id)
  const version = assertVersion(body.version)
  assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
  const patch = normalizePatch(body.data, row)
  let parent
  if (Object.hasOwn(patch, 'parentId')) parent = resolveNewParent(row, patch.parentId)
  Object.assign(row, patch)
  if (Object.hasOwn(patch, 'parentId')) {
    row.parentId = parent?.id ?? '0'
    row.treeLevel = parent ? parent.treeLevel + 1 : 0
    refreshDescendantTreeLevels(row)
  }
  row.version += 1
  return { id: row.id, version: row.version }
}

export const handleOrganizationAction = async (action, body = {}, userId) => {
  if (action === 'organization.tree') return { data: createTree(body) }
  if (action === 'organization.page') return { data: createPage(body.query) }
  if (action === 'organization.detail') return { data: publicRow(findRow(body.id)) }

  requireUser(userId)
  if (action === 'organization.create') {
    sequence += 1
    const row = {
      id: (BASE_ID + BigInt(sequence)).toString(),
      version: 0,
      deleted: false,
      ...normalizeCreateData(body.data),
    }
    rows.push(row)
    return { data: { id: row.id, version: row.version } }
  }
  if (action === 'organization.update') return { data: updateOrganization(body) }
  if (action === 'organization.configureRescueProjects') {
    const row = findRow(body.id)
    const version = assertVersion(body.version)
    assert(row.version === version, 409, '数据已发生变化，请刷新后重试')
    assert(isPlainObject(body.data), 400, 'data 不能为空')
    row.rescueProjects = assertRescueProjects(body.data.rescueProjects)
    row.version += 1
    return { data: { id: row.id, version: row.version } }
  }
  if (action === 'organization.delete') {
    const row = findRow(body.id)
    const hasChildren = rows.some((item) => !item.deleted && item.parentId === row.id)
    assert(!hasChildren, 409, '存在下级机构，无法删除')
    row.deleted = true
    return { data: null }
  }
  throw new MockHttpError(404, `不支持的 action：${action || ''}`)
}
