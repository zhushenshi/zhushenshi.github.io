const names = [
  '张伟',
  '王芳',
  '李强',
  '刘洋',
  '陈静',
  '杨敏',
  '赵磊',
  '周洁',
  '吴涛',
  '徐丽',
  '孙浩',
  '胡雪',
]
const locations = ['北京市朝阳区', '上海市浦东新区', '广州市天河区', '深圳市南山区']
const currencies = ['人民币', '美元', '欧元', '港币']

export const createCreditCardFraudRows = () =>
  names.map((insuredName, index) => {
    const itemNo = index + 1
    const sequence = String(itemNo).padStart(2, '0')
    const day = String(itemNo).padStart(2, '0')

    return {
      id: `2939912345678900${String(itemNo).padStart(3, '0')}`,
      reportNo: `CCF202607${day}110000${String(itemNo).padStart(4, '0')}`,
      cardNo: `CARD-622202-${String(2000 + index)}`,
      reportTime: `2026-07-${day} 11:00:00`,
      policyNo: `CC-POLICY-202607${day}${String(itemNo).padStart(3, '0')}`,
      reported: index % 3 === 0 ? null : index % 2 === 0,
      insuredName,
      idCardNo: `11010119900101${String(2000 + index)}`,
      lossReportTime: `2026-07-${day} 10:30:00`,
      fraudTime: `2026-07-${day} 08:15:00`,
      fraudAmount: 1000.5 + index * 275,
      currency: currencies[index % currencies.length],
      fraudLocation: locations[index % locations.length],
      fraudCount: (index % 4) + 1,
      incidentDescription: `持卡人发现第${sequence}笔非本人信用卡交易并登记盗用情况。`,
      reporterName: names[(index + 3) % names.length],
      reporterPhone: `138-0013-${String(7000 + index)}`,
      reporterEmail: index % 3 === 0 ? '' : `fraud${itemNo}@example.com`,
      recorderName: `user${String(itemNo).padStart(3, '0')}`,
      approvalStatus: index % 2 === 0 ? 'PENDING' : 'APPROVED',
      version: 0,
    }
  })
