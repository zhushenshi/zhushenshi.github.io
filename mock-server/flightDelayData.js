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
const reasons = [
  'FLIGHT_DELAY',
  'BAD_WEATHER',
  'FLIGHT_CANCEL',
  'MECHANICAL_FAILURE',
  'AIR_TRAFFIC_CONTROL',
  'OTHER',
]
const statuses = ['PENDING', 'APPROVED']

export const createFlightDelayRows = () =>
  names.map((name, index) => {
    const day = String(index + 1).padStart(2, '0')
    const status = statuses[index % statuses.length]
    return {
      id: `19399123456789${String(index + 1).padStart(5, '0')}`,
      reportNo: `FD202607${day}153600${String(index + 1).padStart(6, '0')}`,
      cardNo: `622202123456${String(1000 + index)}`,
      reportTime: `2026-07-${day} 15:36:00`,
      insuredName: name,
      idCardNo: `11010119900101${String(1000 + index)}`,
      policyNo: `POLICY-202607${day}${String(index + 1).padStart(3, '0')}`,
      flightNo: `CA${String(1200 + index)}`,
      delayReason: reasons[index % reasons.length],
      incidentDescription: `航班因${reasons[index % reasons.length]}发生延误，现进行临时登记。`,
      scheduledDepartureTime: `2026-07-${day} 14:00:00`,
      actualDepartureTime: index % 3 === 0 ? '' : `2026-07-${day} 18:30:00`,
      reporterName: names[(index + 2) % names.length],
      reporterPhone: `1380013${String(8000 + index)}`,
      reporterEmail: index % 3 === 0 ? '' : `reporter${index + 1}@example.com`,
      recorderName: `user${String(index + 1).padStart(3, '0')}`,
      approvalStatus: status,
      approvalRemark: status === 'REJECTED' ? '请补充航班延误证明。' : '',
      version: 0,
    }
  })
