let nextId = 1963573200000000001

const pad = (n, len) => String(n).padStart(len, '0')

const now = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1, 2)
  const dd = pad(d.getDate(), 2)
  const hh = pad(d.getHours(), 2)
  const mi = pad(d.getMinutes(), 2)
  const ss = pad(d.getSeconds(), 2)
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}:${ss}`,
    datetime: `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`,
  }
}

const buildRow = (i) => {
  const ts = now()
  const idNum = nextId++
  return {
    id: idNum,
    policyNo: `P2026${pad(i, 6)}`,
    contractNo: `C2026${pad(i, 6)}`,
    riskName: ['企业财产综合险', '公众责任险', '雇主责任险', '产品责任险', '货物运输险'][i % 5],
    insuredName: `被保险人${pad(i, 3)}`,
    customerCode: `CUS${pad(i, 5)}`,
    policyholderName: `投保人${pad(i, 3)}`,
    insuredCertificateNo: `91430100MA4L${pad(i, 10)}`,
    documentSerialNo: `DOC${ts.date.replace(/-/g, '')}${pad(i, 5)}`,
    insuranceOrganizationCode: ['430100', '430200', '430300', '430400', '430500'][i % 5],
    reporterName: `报案人${pad(i, 3)}`,
    callerPhone: `138${pad(i, 8)}`,
    callDate: ts.date,
    callTime: ts.time,
    contactName: `联系人${pad(i, 3)}`,
    contactPhone: `139${pad(i, 8)}`,
    accidentLocationCode: ['430100', '430200', '430300', '430400', '430500'][i % 5],
    accidentProvinceCode: '430000',
    accidentDistrictCode: ['430102', '430202', '430302', '430402', '430502'][i % 5],
    accidentAddress: `示例地址${pad(i, 3)}号`,
    accidentTime: ts.datetime,
    insuranceTypeCode: ['PROPERTY', 'LIABILITY', 'EMPLOYER', 'PRODUCT', 'CARGO'][i % 5],
    customerCallback: i % 3 === 0 ? `客户回访记录第${i}条` : '',
    version: 0,
    createUser: 'demoUser',
    createTime: ts.datetime,
    updateUser: 'demoUser',
    updateTime: ts.datetime,
  }
}

export const createNonMotorRows = (count = 42) => {
  nextId = 1963573200000000001
  return Array.from({ length: count }, (_, i) => buildRow(i + 1))
}
