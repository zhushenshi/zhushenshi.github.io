const names = ['张伟', '王芳', '李强', '刘洋', '陈静', '杨敏', '赵磊', '周洁', '吴涛', '徐丽']
const reasons = ['FIRE_EXPLOSION_TRAFFIC_ACCIDENT', 'THEFT', '航空公司托运过程中遗失']

export const createBaggageLossRows = () =>
  names.map((name, index) => {
    const day = String(index + 1).padStart(2, '0')
    const approvalStatus = index % 3 === 0 ? 'PENDING' : 'APPROVED'
    return {
      id: `19499123456789${String(index + 1).padStart(5, '0')}`,
      reportNo: `BL202607${day}125200${String(index + 1).padStart(6, '0')}`,
      cardNo: index % 2 ? `622202123456${String(1000 + index)}` : '',
      reportTime: `2026-07-${day} 12:52:00`,
      insuredName: name,
      idCardNo: `11010119900101${String(1000 + index)}`,
      flightNo: `CA${String(2200 + index)}`,
      policyNo: index % 2 ? `BL-POLICY-2026${String(index + 1).padStart(4, '0')}` : '',
      lossTime: `2026-07-${day} 10:30:00`,
      lossReason: reasons[index % reasons.length],
      incidentDescription: '乘机过程中发生行李损失，现提交报案。',
      reporterName: names[(index + 2) % names.length],
      reporterPhone: `1380013${String(8000 + index)}`,
      reporterEmail: index % 2 ? `baggage${index + 1}@example.com` : '',
      recorderName: String(4959181 + index * 345678),
      approvalStatus,
      version: 0,
    }
  })
