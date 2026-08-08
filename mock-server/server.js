import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { handleAdministrativeRegionAction } from './administrativeRegionService.js'
import { handleBaggageLossAction } from './baggageLossService.js'
import { handleCreditCardFraudAction } from './creditCardFraudService.js'
import { handleFlightDelayAction } from './flightDelayService.js'
import { handleHealthInsuranceAction } from './healthInsuranceService.js'
import { handleOrganizationAction } from './organizationService.js'
import { handleOrganizationRescueProjectAction } from './organizationRescueProjectService.js'
import { createPolicyRows } from './policyData.js'
import { handlePolicyRescueAction } from './policyRescueService.js'
import { handleRescueCompanyAction } from './rescueCompanyService.js'
import { handleNonMotorTemporaryReportAction } from './nonMotorTemporaryReportService.js'
import { handleRescueOrderAction } from './rescueOrderService.js'

const host = '127.0.0.1'
const port = Number(process.env.MOCK_PORT || 3001)
const maxBodySize = 1024 * 1024
let policyRows = createPolicyRows()

const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type, Accept, action, userId',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Disposition',
}

// 演示模式：托管 dist/ 静态文件目录
const distDir = join(fileURLToPath(import.meta.url), '..', '..', 'dist')

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

const getMime = (filePath) =>
  mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream'

const serveStatic = (response, urlPath) => {
  const sanitized = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = join(distDir, sanitized || 'index.html')
  if (!existsSync(filePath)) return false
  try {
    const content = readFileSync(filePath)
    response.writeHead(200, {
      ...corsHeaders,
      'Content-Type': getMime(filePath),
      'Content-Length': content.length,
    })
    response.end(content)
    return true
  } catch {
    return false
  }
}

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(payload === null ? '' : JSON.stringify(payload))
}

const sendSuccess = (response, data) =>
  sendJson(response, 200, { code: 200, status: 'success', message: 'success', data })

const sendFile = (response, file, filename) => {
  response.writeHead(200, {
    ...corsHeaders,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Content-Length': file.length,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  response.end(file)
}

const readJson = (request) =>
  new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > maxBodySize) reject(new Error('请求体过大'))
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('请求体必须是有效的 JSON'))
      }
    })
    request.on('error', reject)
  })

const includes = (value, keyword) =>
  !keyword || String(value ?? '').includes(String(keyword).trim())

const queryPolicies = (query = {}) => {
  const pageNum = Math.max(1, Number.parseInt(query.pageNum, 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 10))
  const filtered = policyRows.filter(
    (row) =>
      (!query.policyNo ||
        includes(row.commercialPolicyNo, query.policyNo) ||
        includes(row.compulsoryPolicyNo, query.policyNo)) &&
      includes(row.vin, query.vin) &&
      includes(row.applicant, query.applicant) &&
      (!query.productType || row.productType === String(query.productType)) &&
      includes(row.insured, query.insured) &&
      includes(row.plateNo, query.plateNo) &&
      includes(row.engineNo, query.engineNo),
  )
  const start = (pageNum - 1) * pageSize
  return { data: filtered.slice(start, start + pageSize), total: filtered.length }
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders)
    response.end()
    return
  }

  // 演示模式：GET 请求返回 dist/ 静态文件
  if (request.method === 'GET') {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname
    if (serveStatic(response, pathname)) return
    // SPA 回退：非文件路径返回 index.html（支持 Vue Router）
    serveStatic(response, '/index.html')
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { code: 405, message: '仅支持 POST 请求' })
    return
  }

  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname
  const action = request.headers.action
  if (pathname !== '/mock-api/business') {
    sendJson(response, 404, { code: 404, message: '接口不存在' })
    return
  }

  try {
    const body = await readJson(request)
    if (String(action || '').startsWith('administrativeRegion.')) {
      const result = await handleAdministrativeRegionAction(action, body)
      sendSuccess(response, result.data)
      return
    }
    if (action === 'policy.page') {
      sendSuccess(response, queryPolicies(body.query))
      return
    }
    if (action === 'policy.batchDelete') {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        sendJson(response, 400, { code: 400, message: 'ids 不能为空' })
        return
      }
      const ids = new Set(body.ids.map(String))
      const before = policyRows.length
      policyRows = policyRows.filter((row) => !ids.has(String(row.id)))
      sendSuccess(response, { deleted: before - policyRows.length })
      return
    }
    if (String(action || '').startsWith('policyRescue.')) {
      const result = await handlePolicyRescueAction(action, body, request.headers.userid)
      sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('rescueOrder.')) {
      const result = await handleRescueOrderAction(action, body, request.headers.userid)
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('accidentHealth.')) {
      const result = await handleHealthInsuranceAction(action, body, request.headers.userid)
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('baggageLoss.')) {
      const result = await handleBaggageLossAction(action, body, request.headers.userid)
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('flightDelay.')) {
      const result = await handleFlightDelayAction(action, body, request.headers.userid)
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('organization.')) {
      const result = await handleOrganizationAction(action, body, request.headers.userid)
      sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('organizationRescueRule.')) {
      const { handleOrganizationRescueRuleAction } =
        await import('./organizationRescueRuleService.js')
      const result = await handleOrganizationRescueRuleAction(action, body, request.headers.userid)
      sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('organizationRescueProject.')) {
      const result = await handleOrganizationRescueProjectAction(
        action,
        body,
        request.headers.userid,
      )
      sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('rescueCompany.')) {
      const result = await handleRescueCompanyAction(action, body, request.headers.userid)
      sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('creditCardFraud.')) {
      const result = await handleCreditCardFraudAction(action, body, request.headers.userid)
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    if (String(action || '').startsWith('nonMotorTemporaryReport.')) {
      const result = await handleNonMotorTemporaryReportAction(
        action,
        body,
        request.headers.userid,
      )
      if (result.file) sendFile(response, result.file, result.filename)
      else sendSuccess(response, result.data)
      return
    }
    sendJson(response, 404, { code: 404, message: `不支持的 action：${action || ''}` })
  } catch (error) {
    const statusCode = Number(error.statusCode) || 400
    sendJson(response, statusCode, {
      code: Number(error.code) || statusCode,
      status: 'error',
      message: error.message || '请求处理失败',
      ...(error.payload?.data !== undefined ? { data: error.payload.data } : {}),
      ...(error.payload?.reportMessage ? { reportMessage: error.payload.reportMessage } : {}),
    })
  }
})

server.listen(port, host, () => {
  console.log(`演示服务已启动：http://${host}:${port}`)
  console.log(`模拟接口：http://${host}:${port}/mock-api/business`)
})
