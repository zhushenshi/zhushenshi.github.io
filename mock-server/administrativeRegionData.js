const BASE_ID = 2026080500000000000n

const createRow = (offset, data) => ({
  id: (BASE_ID + BigInt(offset)).toString(),
  deleted: false,
  status: 'ENABLED',
  ...data,
})

const province = (offset, regionCode, regionName, sortNo, regionType = 'PROVINCE') =>
  createRow(offset, {
    parentId: '0',
    regionCode,
    regionName,
    regionLevel: 1,
    regionType,
    sortNo,
  })

const child = (offset, parentOffset, regionCode, regionName, regionLevel, sortNo) =>
  createRow(offset, {
    parentId: (BASE_ID + BigInt(parentOffset)).toString(),
    regionCode,
    regionName,
    regionLevel,
    regionType: regionLevel === 2 ? 'PREFECTURE' : 'COUNTY',
    sortNo,
  })

export const createAdministrativeRegionRows = () => [
  province(1, '110000', '北京市', 10, 'MUNICIPALITY'),
  province(2, '310000', '上海市', 20, 'MUNICIPALITY'),
  province(3, '320000', '江苏省', 30),
  province(4, '330000', '浙江省', 40),
  province(5, '440000', '广东省', 50),
  child(101, 1, '110100', '北京市', 2, 10),
  child(102, 2, '310100', '上海市', 2, 10),
  child(103, 3, '320100', '南京市', 2, 10),
  child(104, 4, '330100', '杭州市', 2, 10),
  child(105, 5, '440100', '广州市', 2, 10),
  child(201, 101, '110105', '朝阳区', 3, 10),
  child(202, 101, '110108', '海淀区', 3, 20),
  child(203, 102, '310115', '浦东新区', 3, 10),
  child(204, 102, '310101', '黄浦区', 3, 20),
  child(205, 103, '320106', '鼓楼区', 3, 10),
  child(206, 103, '320102', '玄武区', 3, 20),
  child(207, 104, '330106', '西湖区', 3, 10),
  child(208, 104, '330102', '上城区', 3, 20),
  child(209, 105, '440106', '天河区', 3, 10),
  child(210, 105, '440104', '越秀区', 3, 20),
  createRow(301, {
    parentId: (BASE_ID + 5n).toString(),
    regionCode: '440200',
    regionName: '韶关市',
    regionLevel: 2,
    regionType: 'PREFECTURE',
    sortNo: 20,
    status: 'DISABLED',
  }),
  createRow(302, {
    parentId: (BASE_ID + 4n).toString(),
    regionCode: '330200',
    regionName: '宁波市',
    regionLevel: 2,
    regionType: 'PREFECTURE',
    sortNo: 20,
    deleted: true,
  }),
]
