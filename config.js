// 部署后可直接修改此文件，无需重新构建前端应用。
// 此处配置会暴露给浏览器，请勿填写密码、密钥等敏感信息。
window.CONFIG = {
  coreReportUrl: 'openIE:http://22.8.129.45:6011/claim/index.jsp',
  selfServiceQueryUrl: 'http://22.8.129.45:6011/claim/index.jsp',
  // 模块权限开关：false 使用下方 permissions 全量权限，true 读取 URL ctpBusinessAuth / workbench resources
  permissionSwitch: false,
  // 自定义权限码（逗号分隔），不配置时默认放行 ctp 内所有模块
  permissions:'',
  permissions:
    // 'ReportBusAuth,CoreReportAuth,MotorTempReportAuth,NonMotorTempReportAuth,BankCardAuth,SelfServiceQueryAuth',
  // permissions: 'ReportBusAuth,BankCardAuth,CoreReportAuth',
}
