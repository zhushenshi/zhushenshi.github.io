const names = [
  '郭小娟',
  '梁女士',
  '鲁景辰',
  '孔海迪',
  '盛野佳',
  '440301195707072971',
  '叶欢琪',
  '蒋丽娟',
]

const statuses = ['PENDING', 'APPROVED']

export const createHealthInsuranceRows = () =>
  names.map((name, index) => {
    const day = String(index + 10).padStart(2, '0')
    return {
      id: `19599123456789${String(index + 1).padStart(5, '0')}`,
      reportNo: `AH202603${day}140500${String(index + 1).padStart(6, '0')}`,
      insuredName: names[(index + 1) % names.length],
      idCardNo: `11010119900101${String(2000 + index)}`,
      reportTime: `2026-03-${day} 14:05:00`,
      policyNo: `AH-POLICY-2026${String(index + 1).padStart(4, '0')}`,
      accidentTime: `2026-03-${day} 09:30:00`,
      accidentLocation: index % 2 ? '上海市浦东新区' : '北京市朝阳区',
      reporterName: name,
      reporterPhone: `1537593${String(2185 + index)}`,
      reporterEmail: index % 2 ? `health${index + 1}@example.com` : '',
      incidentDescription: '被保险人发生意外事故，现提交意健险报案。',
      recorderName: String(7803413 - index * 313709),
      approvalStatus: statuses[index % statuses.length],
      version: 0,
      deleted: false,
    }
  })
