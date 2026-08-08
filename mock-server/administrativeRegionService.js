import { createAdministrativeRegionRows } from './administrativeRegionData.js'

export class AdministrativeRegionHttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.code = statusCode
  }
}

const rows = createAdministrativeRegionRows()
const fail = (statusCode, message) => {
  throw new AdministrativeRegionHttpError(statusCode, message)
}
const publicRow = ({ deleted: _deleted, ...row }) => row
const activeRows = () => rows.filter((row) => row.status === 'ENABLED' && !row.deleted)

export const handleAdministrativeRegionAction = async (action, body = {}) => {
  if (action !== 'administrativeRegion.children') {
    fail(404, `不支持的 action：${action || ''}`)
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail(400, '请求参数必须为对象')
  }

  const rawParentCode = body.parentCode
  if (rawParentCode == null || rawParentCode === '') {
    return {
      data: activeRows()
        .filter((row) => row.regionLevel === 1)
        .sort((left, right) => left.sortNo - right.sortNo)
        .map(publicRow),
    }
  }
  if (typeof rawParentCode !== 'string' || !/^\d{6}$/.test(rawParentCode)) {
    fail(400, 'parentCode必须为6位数字')
  }
  const parent = activeRows().find((row) => row.regionCode === rawParentCode)
  if (!parent) fail(400, '上级地区不存在')
  return {
    data: activeRows()
      .filter((row) => row.parentId === parent.id)
      .sort((left, right) => left.sortNo - right.sortNo)
      .map(publicRow),
  }
}
