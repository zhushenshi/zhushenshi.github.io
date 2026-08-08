const organizations = [
  ['BJ', '北京分公司'],
  ['SH', '上海分公司'],
  ['GD', '广东分公司'],
  ['ZJ', '浙江分公司'],
  ['JS', '江苏分公司'],
]

const companyNames = [
  '安援道路救援有限公司',
  '大陆汽车救援服务有限公司',
  '中联道路救援有限公司',
  '华东汽车救援有限公司',
  '京城道路救援有限公司',
  '南方汽车服务有限公司',
  '快捷道路救援有限公司',
  '平安行汽车救援有限公司',
  '远程道路救援有限公司',
  '城市道路救援有限公司',
  '联合汽车服务有限公司',
  '及时达道路救援有限公司',
]

export const createRescueCompanyRows = () =>
  companyNames.map((companyName, index) => {
    const number = String(index + 1).padStart(4, '0')
    const [organizationCode, organizationName] = organizations[index % organizations.length]
    return {
      id: (1960301000000000000n + BigInt(index + 1)).toString(),
      companyName,
      companyCode: `RC${number}`,
      companyEmail: `rescue${index + 1}@example.com`,
      companyPhone: index % 2 === 0 ? `010-6689${number}` : `1380013${String(8100 + index)}`,
      emergencyContactName: ['张伟', '王芳', '李强', '刘洋'][index % 4],
      emergencyContactPhone: `1390013${String(8200 + index)}`,
      organizationCode,
      organizationName,
      status: index % 4 === 3 ? 'DISABLED' : 'ENABLED',
      version: 0,
      deleted: false,
    }
  })
