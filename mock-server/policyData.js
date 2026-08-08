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

export const createPolicyRows = () =>
  names.map((name, index) => ({
    id: index + 1,
    commercialPolicyNo: `SY2026${String(28610 + index * 13).padStart(8, '0')}`,
    compulsoryPolicyNo: `JQ2026${String(41020 + index * 17).padStart(8, '0')}`,
    applicant: name,
    insured: index % 3 === 0 ? '中银保险有限公司' : name,
    plateNo: `京A${String(23680 + index * 97).slice(-5)}`,
    vin: `LZWADAGA${String(10000000 + index * 739).slice(-8)}`,
    engineNo: `EN${String(62840 + index * 29).padStart(8, '0')}`,
    productType: String((index % 3) + 1),
    status: ['有效', '失效', '待生效'][index % 3],
    startDate: `2026-0${(index % 7) + 1}-01`,
    endDate: `2027-0${(index % 7) + 1}-01`,
    premium: (2860 + index * 137.5).toFixed(2),
  }))
