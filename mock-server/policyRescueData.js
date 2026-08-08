const names = ['张伟', '王芳', '李强', '刘洋', '陈静', '杨敏', '赵磊', '周洁', '吴涛', '徐丽']
const provinces = [
  ['北京市', '北京市', '朝阳区'],
  ['上海市', '上海市', '浦东新区'],
  ['广东省', '广州市', '天河区'],
  ['浙江省', '杭州市', '西湖区'],
  ['江苏省', '南京市', '鼓楼区'],
]
const serviceTypes = ['拖车', '搭电', '换胎', '送油', '现场快修']

export const createPolicyRescueRows = () =>
  names.map((name, index) => {
    const number = String(index + 1).padStart(2, '0')
    const [rescueProvince, rescueCity, rescueDistrict] = provinces[index % provinces.length]
    return {
      id: `19488123456789000${number}`,
      version: 0,
      serviceCount: String((index % 3) + 1),
      serviceMileage: String(10 + index * 5),
      accidentType: '事故救援',
      workOrderNo: `救援202608${number}000${number}`,
      callTime: `2026-08-${number} ${String(8 + (index % 9)).padStart(2, '0')}:30:00`,
      callerName: names[(index + 1) % names.length],
      callerPhone: `1380013${String(8100 + index)}`,
      policyNo: `P202608${number}${String(1000 + index)}`,
      organization: `中国保险${rescueCity}分公司`,
      reportNo: `RA202608${number}${String(100000 + index)}`,
      insuredName: name,
      idCardNo: `11010119900101${String(1100 + index)}`,
      policyStartDate: '2026-01-01',
      policyEndDate: '2026-12-31',
      plateNo: `京A${String(12000 + index)}`,
      engineNo: `ENG2026${String(10000 + index)}`,
      vehicleModel: `示例车型${(index % 4) + 1}`,
      vehicleType: index % 3 === 0 ? 'TRUCK' : 'PASSENGER',
      seatCount: index % 3 === 0 ? '2' : '5',
      vehicleColor: ['黑色', '白色', '银色'][index % 3],
      customerType: index % 4 === 0 ? 'VIP' : 'NORMAL',
      isNewOrder: index % 2 === 0 ? 'YES' : 'NO',
      rescueObject: index % 3 === 0 ? 'THIRD_PARTY' : 'INSURED',

      contactName: names[(index + 2) % names.length],
      contactPhone: `1390013${String(8200 + index)}`,
      rescueRules: '保险期内可享受一次免费道路救援服务。',
      rescueProvince,
      rescueCity,
      rescueDistrict,
      detailedAddress: `${rescueDistrict}示范路${index + 1}号`,
      freeMileage: ['10', '20', '30', '50'][index % 4],
      dispatcher: ['安援道路救援有限公司', '大陆汽车救援服务有限公司', '中联道路救援有限公司'][
        index % 3
      ],
      serviceType: serviceTypes[index % serviceTypes.length],
      rescueDate: `2026-08-${number}`,
      repairRequired: index % 2 === 0 ? 'YES' : 'NO',
      serviceDestination: `${rescueCity}示范维修中心`,
      recorderName: `user${String(index + 1).padStart(3, '0')}`,
      employeeNo: `EMP${String(1000 + index)}`,
      remark: index % 3 === 0 ? '客户要求尽快到达现场。' : '',
    }
  })
