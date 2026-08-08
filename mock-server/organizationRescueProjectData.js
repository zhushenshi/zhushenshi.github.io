const BASE_ID = 1960501000000000000n
const ORGANIZATION_BASE_ID = 1960401000000000000n

const createRow = (offset, organizationOffset, rescueProjects) => ({
  id: (BASE_ID + BigInt(offset)).toString(),
  organizationId: (ORGANIZATION_BASE_ID + BigInt(organizationOffset)).toString(),
  rescueProjects,
  deleted: false,
})

export const createOrganizationRescueProjectRows = () => [
  createRow(1, 3, '接电服务\n紧急送油\n更换轮胎\n拖车牵引'),
  createRow(2, 4, '接电服务\n现场抢修\n拖车牵引'),
  createRow(3, 5, '接电服务\n紧急加水\n更换轮胎\n拖车牵引'),
  createRow(4, 6, '接电服务\n现场抢修\n拖车牵引'),
  createRow(5, 7, '接电服务\n更换轮胎\n拖车牵引'),
]
