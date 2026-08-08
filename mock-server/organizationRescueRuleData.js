const BASE_ID = 1960601000000000000n
const ORGANIZATION_BASE_ID = 1960401000000000000n

const createRow = (offset, organizationOffset, data) => ({
  id: (BASE_ID + BigInt(offset)).toString(),
  organizationId: (ORGANIZATION_BASE_ID + BigInt(organizationOffset)).toString(),
  rescueTimes: data.rescueTimes,
  towingKilometers: data.towingKilometers,
  insuredPerson: data.insuredPerson,
  agent: data.agent,
  usageNature: data.usageNature,
  vehicleType: data.vehicleType,
  maxSeats: data.maxSeats,
  insuranceType: data.insuranceType,
  vipFlag: data.vipFlag,
  ruleDescription: data.ruleDescription,
  version: 0,
  updateTime: data.updateTime,
  deleted: false,
})

export const createOrganizationRescueRuleRows = () => [
  createRow(1, 3, {
    rescueTimes: 99,
    towingKilometers: 50,
    insuredPerson: '个人客户',
    agent: '',
    usageNature: '非营运',
    vehicleType: '所有车型',
    maxSeats: 7,
    insuranceType: '商业险',
    vipFlag: 'YES',
    ruleDescription: '满足规则条件时提供道路救援服务。',
    updateTime: '2026-08-05 09:30:00',
  }),
  createRow(2, 4, {
    rescueTimes: 5,
    towingKilometers: 100,
    insuredPerson: '企业客户',
    agent: '直营网点',
    usageNature: '非营运',
    vehicleType: '9座及以下非营运客车',
    maxSeats: 9,
    insuranceType: '商业险',
    vipFlag: 'NO',
    ruleDescription: '上海分公司道路救援规则。',
    updateTime: '2026-08-12 14:20:00',
  }),
]
